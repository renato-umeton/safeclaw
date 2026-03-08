import { TelegramChannel } from '../../src/channels/telegram';
import { mockFetchResponse } from '../helpers';

describe('TelegramChannel', () => {
  let channel: TelegramChannel;

  beforeEach(() => {
    channel = new TelegramChannel();
    vi.restoreAllMocks();
  });

  it('has type "telegram"', () => {
    expect(channel.type).toBe('telegram');
  });

  describe('configure', () => {
    it('sets token and chat IDs', () => {
      channel.configure('bot-token', ['123', '456']);
      expect(channel.isConfigured()).toBe(true);
    });
  });

  describe('isConfigured', () => {
    it('returns false when no token', () => {
      expect(channel.isConfigured()).toBe(false);
    });

    it('returns true when token is set', () => {
      channel.configure('token', []);
      expect(channel.isConfigured()).toBe(true);
    });
  });

  describe('registerChatId', () => {
    it('adds chat ID to registered set', () => {
      channel.configure('token', []);
      channel.registerChatId('789');
      // No direct way to check, but it should be used in handleUpdate
    });
  });

  describe('start / stop', () => {
    it('does not start without token', () => {
      channel.start(); // no-op
      channel.stop(); // no-op
    });

    it('starts and stops with token', () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({ ok: true, result: [] })
      );
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('token', []);
      channel.start();
      // Start again is idempotent
      channel.start();
      channel.stop();
    });

    it('stop is safe to call when not running', () => {
      channel.configure('token', []);
      channel.stop(); // should not throw
    });
  });

  describe('send', () => {
    it('sends message via API', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({ ok: true })
      );
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('bot-token', []);
      await channel.send('tg:123', 'Hello!');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('bot-token/sendMessage');
      const body = JSON.parse(opts.body);
      expect(body.chat_id).toBe('123');
      expect(body.text).toBe('Hello!');
    });

    it('splits long messages', async () => {
      // Each call needs a fresh Response (body can only be consumed once)
      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve(mockFetchResponse({ ok: true }))
      );
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('bot-token', []);
      const longText = 'x'.repeat(5000);
      await channel.send('tg:123', longText);

      // Should send 2 chunks (5000 > 4096)
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws on API error', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse('Forbidden', 403)
      );
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('bot-token', []);
      await expect(channel.send('tg:123', 'test')).rejects.toThrow('403');
    });

    it('sends with Markdown parse_mode', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({ ok: true })
      );
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('bot-token', []);
      await channel.send('tg:123', 'Hello');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.parse_mode).toBe('Markdown');
    });

    it('splits long message at newline boundary when possible', async () => {
      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve(mockFetchResponse({ ok: true }))
      );
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('bot-token', []);
      // Create text with newlines near the 4096 boundary
      const lines = Array(100).fill('x'.repeat(80)).join('\n');
      await channel.send('tg:123', lines);

      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('setTyping', () => {
    it('sends typing action for typing=true', () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({ ok: true })
      );
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('bot-token', []);
      channel.setTyping('tg:123', true);

      // Fire-and-forget, just verify fetch was called
      expect(fetchMock).toHaveBeenCalled();
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('sendChatAction');
      const body = JSON.parse(opts.body);
      expect(body.action).toBe('typing');
    });

    it('does nothing for typing=false', () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('bot-token', []);
      channel.setTyping('tg:123', false);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('handles typing API failure silently', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('bot-token', []);
      // Should not throw (fire-and-forget with .catch)
      channel.setTyping('tg:123', true);
    });
  });

  describe('onMessage', () => {
    it('registers callback', () => {
      const callback = vi.fn();
      channel.onMessage(callback);
      // No direct way to test; will be tested via handleUpdate
    });
  });

  describe('handleUpdate (via poll)', () => {
    // Helper to simulate updates arriving via poll
    function setupPollWithUpdates(updates: unknown[]) {
      let callCount = 0;
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('getUpdates')) {
          if (callCount === 0) {
            callCount++;
            return Promise.resolve(mockFetchResponse({ ok: true, result: updates }));
          }
          // Second call: return empty so poll doesn't loop infinitely, then abort
          return new Promise((resolve) => {
            // This will hang until abort
            setTimeout(() => resolve(mockFetchResponse({ ok: true, result: [] })), 100000);
          });
        }
        // sendMessage or other API calls
        return Promise.resolve(mockFetchResponse({ ok: true, result: {} }));
      });
      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    }

    it('handles text message from registered chat', async () => {
      const callback = vi.fn();
      const fetchMock = setupPollWithUpdates([{
        update_id: 1,
        message: {
          message_id: 100,
          chat: { id: 123, type: 'private' },
          from: { id: 1, first_name: 'Alice' },
          date: 1700000000,
          text: 'Hello bot',
        },
      }]);

      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      // Wait for poll to process
      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '100',
          groupId: 'tg:123',
          sender: 'Alice',
          content: 'Hello bot',
          channel: 'telegram',
        }),
      );
    });

    it('handles photo message', async () => {
      const callback = vi.fn();
      setupPollWithUpdates([{
        update_id: 2,
        message: {
          message_id: 101,
          chat: { id: 123, type: 'private' },
          from: { id: 1, first_name: 'Bob' },
          date: 1700000001,
          photo: [{ file_id: 'abc' }],
        },
      }]);

      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ content: '[Photo]' }),
      );
    });

    it('handles voice message', async () => {
      const callback = vi.fn();
      setupPollWithUpdates([{
        update_id: 3,
        message: {
          message_id: 102,
          chat: { id: 123, type: 'private' },
          from: { id: 1, first_name: 'Bob' },
          date: 1700000002,
          voice: { file_id: 'voice123' },
        },
      }]);

      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ content: '[Voice message]' }),
      );
    });

    it('handles document message', async () => {
      const callback = vi.fn();
      setupPollWithUpdates([{
        update_id: 4,
        message: {
          message_id: 103,
          chat: { id: 123, type: 'private' },
          from: { id: 1, first_name: 'Bob' },
          date: 1700000003,
          document: { file_name: 'report.pdf' },
        },
      }]);

      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ content: '[Document: report.pdf]' }),
      );
    });

    it('handles sticker message', async () => {
      const callback = vi.fn();
      setupPollWithUpdates([{
        update_id: 5,
        message: {
          message_id: 104,
          chat: { id: 123, type: 'private' },
          from: { id: 1, first_name: 'Bob' },
          date: 1700000004,
          sticker: { emoji: '😀' },
        },
      }]);

      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('[Sticker:') }),
      );
    });

    it('handles location message', async () => {
      const callback = vi.fn();
      setupPollWithUpdates([{
        update_id: 6,
        message: {
          message_id: 105,
          chat: { id: 123, type: 'private' },
          from: { id: 1, first_name: 'Bob' },
          date: 1700000005,
          location: { latitude: 40.7128, longitude: -74.006 },
        },
      }]);

      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ content: '[Location: 40.7128, -74.006]' }),
      );
    });

    it('handles contact message', async () => {
      const callback = vi.fn();
      setupPollWithUpdates([{
        update_id: 7,
        message: {
          message_id: 106,
          chat: { id: 123, type: 'private' },
          from: { id: 1, first_name: 'Bob' },
          date: 1700000006,
          contact: { first_name: 'Charlie' },
        },
      }]);

      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ content: '[Contact: Charlie]' }),
      );
    });

    it('handles /chatid command from any chat', async () => {
      const fetchMock = setupPollWithUpdates([{
        update_id: 8,
        message: {
          message_id: 107,
          chat: { id: 999, type: 'private' },
          from: { id: 1, first_name: 'Unknown' },
          date: 1700000007,
          text: '/chatid',
        },
      }]);

      const callback = vi.fn();
      channel.configure('bot-token', ['123']); // 999 is NOT registered
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      // /chatid should respond even to unregistered chats
      const sendCalls = fetchMock.mock.calls.filter(
        (args: any[]) => (args[0] as string).includes('sendMessage')
      );
      expect(sendCalls.length).toBeGreaterThanOrEqual(1);
      const body = JSON.parse(sendCalls[0][1].body);
      expect(body.text).toContain('Chat ID:');
      expect(body.text).toContain('999');

      // Should NOT trigger the normal message callback
      expect(callback).not.toHaveBeenCalled();
    });

    it('handles /ping command', async () => {
      const fetchMock = setupPollWithUpdates([{
        update_id: 9,
        message: {
          message_id: 108,
          chat: { id: 123, type: 'private' },
          from: { id: 1, first_name: 'Alice' },
          date: 1700000008,
          text: '/ping',
        },
      }]);

      const callback = vi.fn();
      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      const sendCalls = fetchMock.mock.calls.filter(
        (args: any[]) => (args[0] as string).includes('sendMessage')
      );
      expect(sendCalls.length).toBeGreaterThanOrEqual(1);
      const body = JSON.parse(sendCalls[0][1].body);
      expect(body.text).toContain('Pong!');

      // Should NOT trigger the normal message callback
      expect(callback).not.toHaveBeenCalled();
    });

    it('ignores messages from unregistered chats', async () => {
      const callback = vi.fn();
      setupPollWithUpdates([{
        update_id: 10,
        message: {
          message_id: 109,
          chat: { id: 999, type: 'private' },
          from: { id: 1, first_name: 'Stranger' },
          date: 1700000009,
          text: 'hello',
        },
      }]);

      channel.configure('bot-token', ['123']); // 999 not registered
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).not.toHaveBeenCalled();
    });

    it('ignores updates without message', async () => {
      const callback = vi.fn();
      setupPollWithUpdates([{
        update_id: 11,
        // no message field
      }]);

      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).not.toHaveBeenCalled();
    });

    it('falls back to username when first_name missing', async () => {
      const callback = vi.fn();
      setupPollWithUpdates([{
        update_id: 12,
        message: {
          message_id: 110,
          chat: { id: 123, type: 'private' },
          from: { id: 1, username: 'johndoe' },
          date: 1700000010,
          text: 'hi',
        },
      }]);

      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ sender: 'johndoe' }),
      );
    });

    it('uses "Unknown" when from is missing', async () => {
      const callback = vi.fn();
      setupPollWithUpdates([{
        update_id: 13,
        message: {
          message_id: 111,
          chat: { id: 123, type: 'private' },
          date: 1700000011,
          text: 'anonymous',
        },
      }]);

      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ sender: 'Unknown' }),
      );
    });

    it('handles unsupported message type', async () => {
      const callback = vi.fn();
      setupPollWithUpdates([{
        update_id: 14,
        message: {
          message_id: 112,
          chat: { id: 123, type: 'private' },
          from: { id: 1, first_name: 'Bob' },
          date: 1700000012,
          // No text, photo, voice, document, sticker, location, or contact
        },
      }]);

      channel.configure('bot-token', ['123']);
      channel.onMessage(callback);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ content: '[Unsupported message type]' }),
      );
    });
  });

  describe('poll error handling', () => {
    it('handles non-ok HTTP response in poll', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let callCount = 0;
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('getUpdates')) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(mockFetchResponse('Server Error', 500));
          }
          // Return a pending promise on second call to avoid tight loop
          return new Promise(() => {});
        }
        return Promise.resolve(mockFetchResponse({ ok: true }));
      });
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('bot-token', ['123']);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('poll error'));
      consoleSpy.mockRestore();
    });

    it('handles non-ok data response in poll', async () => {
      let callCount = 0;
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('getUpdates')) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(mockFetchResponse({ ok: false }));
          }
          return new Promise(() => {});
        }
        return Promise.resolve(mockFetchResponse({ ok: true }));
      });
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('bot-token', ['123']);
      channel.start();

      await new Promise((r) => setTimeout(r, 50));
      channel.stop();
      // Should not crash
    });

    it('handles AbortError when stopping', async () => {
      const fetchMock = vi.fn().mockImplementation((url: string, opts?: { signal?: AbortSignal }) => {
        if (url.includes('getUpdates')) {
          return new Promise((_, reject) => {
            if (opts?.signal) {
              opts.signal.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'));
              });
            }
          });
        }
        return Promise.resolve(mockFetchResponse({ ok: true }));
      });
      vi.stubGlobal('fetch', fetchMock);

      channel.configure('bot-token', ['123']);
      channel.start();

      await new Promise((r) => setTimeout(r, 10));
      channel.stop(); // triggers abort

      await new Promise((r) => setTimeout(r, 50));
      // Should exit cleanly without error
    });
  });
});
