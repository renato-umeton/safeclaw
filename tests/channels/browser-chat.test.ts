import { BrowserChatChannel } from '../../src/channels/browser-chat';

describe('BrowserChatChannel', () => {
  let channel: BrowserChatChannel;

  beforeEach(() => {
    channel = new BrowserChatChannel();
  });

  it('has type "browser"', () => {
    expect(channel.type).toBe('browser');
  });

  it('start and stop are no-ops', () => {
    channel.start();
    channel.stop();
    // No errors
  });

  describe('submit', () => {
    it('fires message callback with correct InboundMessage', () => {
      const callback = vi.fn();
      channel.onMessage(callback);

      channel.submit('hello world');

      expect(callback).toHaveBeenCalledTimes(1);
      const msg = callback.mock.calls[0][0];
      expect(msg.content).toBe('hello world');
      expect(msg.sender).toBe('You');
      expect(msg.channel).toBe('browser');
      expect(msg.groupId).toBe('br:main');
      expect(msg.id).toBeTruthy();
    });

    it('uses custom groupId when provided', () => {
      const callback = vi.fn();
      channel.onMessage(callback);

      channel.submit('test', 'br:custom');

      expect(callback.mock.calls[0][0].groupId).toBe('br:custom');
    });

    it('uses active group when no groupId provided', () => {
      const callback = vi.fn();
      channel.onMessage(callback);

      channel.setActiveGroup('br:other');
      channel.submit('test');

      expect(callback.mock.calls[0][0].groupId).toBe('br:other');
    });

    it('does nothing if no callback registered', () => {
      // Should not throw
      channel.submit('test');
    });
  });

  describe('send', () => {
    it('fires display callback', async () => {
      const callback = vi.fn();
      channel.onDisplay(callback);

      await channel.send('br:main', 'response text');

      expect(callback).toHaveBeenCalledWith('br:main', 'response text', true);
    });

    it('does nothing if no display callback', async () => {
      await channel.send('br:main', 'test');
      // No error
    });
  });

  describe('setTyping', () => {
    it('fires typing callback', () => {
      const callback = vi.fn();
      channel.onTyping(callback);

      channel.setTyping('br:main', true);

      expect(callback).toHaveBeenCalledWith('br:main', true);
    });
  });

  describe('active group', () => {
    it('defaults to br:main', () => {
      expect(channel.getActiveGroup()).toBe('br:main');
    });

    it('can be changed', () => {
      channel.setActiveGroup('br:test');
      expect(channel.getActiveGroup()).toBe('br:test');
    });
  });
});
