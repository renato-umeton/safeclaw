import { Router } from '../src/router';
import { BrowserChatChannel } from '../src/channels/browser-chat';
import { TelegramChannel } from '../src/channels/telegram';

describe('Router', () => {
  let browserChat: BrowserChatChannel;
  let telegram: TelegramChannel;
  let router: Router;

  beforeEach(() => {
    browserChat = new BrowserChatChannel();
    telegram = new TelegramChannel();
    router = new Router(browserChat, telegram);
  });

  describe('send', () => {
    it('routes "br:" prefixed messages to browser chat', async () => {
      const sendSpy = vi.spyOn(browserChat, 'send');
      await router.send('br:main', 'hello');
      expect(sendSpy).toHaveBeenCalledWith('br:main', 'hello');
    });

    it('routes "tg:" prefixed messages to telegram', async () => {
      telegram.configure('fake-token', ['123']);
      const sendSpy = vi.spyOn(telegram, 'send').mockResolvedValue();
      await router.send('tg:123', 'hello');
      expect(sendSpy).toHaveBeenCalledWith('tg:123', 'hello');
    });

    it('falls back to browser chat for unknown prefixes', async () => {
      const sendSpy = vi.spyOn(browserChat, 'send');
      await router.send('unknown:123', 'hello');
      expect(sendSpy).toHaveBeenCalledWith('unknown:123', 'hello');
    });

    it('warns on no channel match (telegram null)', async () => {
      const routerNoTg = new Router(browserChat, null);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await routerNoTg.send('tg:123', 'hello');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('setTyping', () => {
    it('forwards typing to browser chat for "br:" groups', () => {
      const typingSpy = vi.spyOn(browserChat, 'setTyping');
      router.setTyping('br:main', true);
      expect(typingSpy).toHaveBeenCalledWith('br:main', true);
    });

    it('forwards typing to telegram for "tg:" groups', () => {
      telegram.configure('fake-token', ['123']);
      const typingSpy = vi.spyOn(telegram, 'setTyping');
      router.setTyping('tg:123', true);
      expect(typingSpy).toHaveBeenCalledWith('tg:123', true);
    });
  });

  describe('formatOutbound', () => {
    it('strips <internal> tags from text', () => {
      const raw = 'Hello <internal>thinking here</internal> World';
      expect(Router.formatOutbound(raw)).toBe('Hello  World');
    });

    it('handles multiline internal tags', () => {
      const raw = 'Start <internal>\nline1\nline2\n</internal> End';
      expect(Router.formatOutbound(raw)).toBe('Start  End');
    });

    it('returns trimmed text when no tags', () => {
      expect(Router.formatOutbound('  hello  ')).toBe('hello');
    });
  });

  describe('formatMessagesXml', () => {
    it('produces valid XML structure', () => {
      const messages = [
        { sender: 'Alice', content: 'Hello', timestamp: 1000 },
        { sender: 'Bob', content: 'World', timestamp: 2000 },
      ];
      const xml = Router.formatMessagesXml(messages);
      expect(xml).toContain('<messages>');
      expect(xml).toContain('</messages>');
      expect(xml).toContain('sender="Alice"');
      expect(xml).toContain('sender="Bob"');
    });

    it('escapes XML special characters', () => {
      const messages = [
        { sender: 'A<B', content: 'x&y"z', timestamp: 1000 },
      ];
      const xml = Router.formatMessagesXml(messages);
      expect(xml).toContain('&lt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;');
    });
  });
});
