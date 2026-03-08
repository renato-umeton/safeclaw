import { renderMarkdown } from '../src/markdown';

describe('renderMarkdown', () => {
  describe('headings', () => {
    it('renders h1-h6', () => {
      expect(renderMarkdown('# Hello')).toContain('<h1>Hello</h1>');
      expect(renderMarkdown('## Hello')).toContain('<h2>Hello</h2>');
      expect(renderMarkdown('### Hello')).toContain('<h3>Hello</h3>');
      expect(renderMarkdown('#### Hello')).toContain('<h4>Hello</h4>');
    });

    it('applies inline formatting within headings', () => {
      expect(renderMarkdown('# **bold** heading')).toContain('<h1><strong>bold</strong> heading</h1>');
    });
  });

  describe('inline formatting', () => {
    it('renders bold text with **', () => {
      expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
    });

    it('renders bold text with __', () => {
      expect(renderMarkdown('__bold__')).toContain('<strong>bold</strong>');
    });

    it('renders italic text with *', () => {
      expect(renderMarkdown('*italic*')).toContain('<em>italic</em>');
    });

    it('renders italic text with _', () => {
      expect(renderMarkdown('_italic_')).toContain('<em>italic</em>');
    });

    it('renders bold-italic with ***', () => {
      expect(renderMarkdown('***text***')).toContain('<strong><em>text</em></strong>');
    });

    it('renders strikethrough with ~~', () => {
      expect(renderMarkdown('~~deleted~~')).toContain('<del>deleted</del>');
    });

    it('renders inline code', () => {
      expect(renderMarkdown('use `console.log`')).toContain('<code>console.log</code>');
    });
  });

  describe('code blocks', () => {
    it('renders fenced code blocks', () => {
      const md = '```js\nconst x = 1;\n```';
      const html = renderMarkdown(md);
      expect(html).toContain('<pre><code class="language-js">');
      expect(html).toContain('const x = 1;');
    });

    it('renders code blocks without language', () => {
      const md = '```\nhello\n```';
      const html = renderMarkdown(md);
      expect(html).toContain('<pre><code>hello</code></pre>');
    });

    it('escapes HTML inside code blocks', () => {
      const md = '```\n<script>alert("xss")</script>\n```';
      const html = renderMarkdown(md);
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('renders code block with python language', () => {
      const md = '```python\ndef foo():\n    pass\n```';
      const html = renderMarkdown(md);
      expect(html).toContain('<pre><code class="language-python">');
      expect(html).toContain('def foo():');
    });

    it('renders code block with typescript language', () => {
      const md = '```typescript\nconst x: number = 1;\n```';
      const html = renderMarkdown(md);
      expect(html).toContain('class="language-typescript"');
    });

    it('preserves whitespace inside code blocks', () => {
      const md = '```\n  indented\n    more\n```';
      const html = renderMarkdown(md);
      expect(html).toContain('  indented');
      expect(html).toContain('    more');
    });

    it('handles multiple code blocks', () => {
      const md = '```js\na\n```\n\ntext\n\n```py\nb\n```';
      const html = renderMarkdown(md);
      expect(html).toContain('language-js');
      expect(html).toContain('language-py');
    });
  });

  describe('lists', () => {
    it('renders unordered lists', () => {
      const md = '- item 1\n- item 2\n- item 3';
      const html = renderMarkdown(md);
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>item 1</li>');
      expect(html).toContain('<li>item 2</li>');
    });

    it('renders ordered lists', () => {
      const md = '1. first\n2. second\n3. third';
      const html = renderMarkdown(md);
      expect(html).toContain('<ol>');
      expect(html).toContain('<li>first</li>');
    });

    it('renders unordered lists with * marker', () => {
      const md = '* item a\n* item b';
      const html = renderMarkdown(md);
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>item a</li>');
      expect(html).toContain('<li>item b</li>');
    });

    it('renders unordered lists with + marker', () => {
      const md = '+ item x\n+ item y';
      const html = renderMarkdown(md);
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>item x</li>');
    });

    it('handles list items with inline formatting', () => {
      const md = '- **bold** item\n- *italic* item';
      const html = renderMarkdown(md);
      expect(html).toContain('<li><strong>bold</strong> item</li>');
      expect(html).toContain('<li><em>italic</em> item</li>');
    });

    it('handles list continuation lines (indented)', () => {
      const md = '- first item\n  continued line\n- second item';
      const html = renderMarkdown(md);
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>');
      expect(html).toContain('second item');
    });

    it('handles list with blank line between items that continues', () => {
      const md = '- item 1\n\n- item 2';
      const html = renderMarkdown(md);
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>item 1</li>');
      expect(html).toContain('<li>item 2</li>');
    });
  });

  describe('blockquotes', () => {
    it('renders blockquotes', () => {
      const html = renderMarkdown('> quoted text');
      expect(html).toContain('<blockquote>');
      expect(html).toContain('quoted text');
    });
  });

  describe('horizontal rules', () => {
    it('renders --- as <hr>', () => {
      expect(renderMarkdown('---')).toContain('<hr>');
    });

    it('renders *** as <hr>', () => {
      expect(renderMarkdown('***')).toContain('<hr>');
    });
  });

  describe('links and images', () => {
    it('renders links', () => {
      const html = renderMarkdown('[Click](https://example.com)');
      expect(html).toContain('<a href="https://example.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener"');
      expect(html).toContain('Click</a>');
    });

    it('renders images', () => {
      const html = renderMarkdown('![Alt text](image.png)');
      expect(html).toContain('<img src="image.png"');
      expect(html).toContain('alt="Alt text"');
      expect(html).toContain('loading="lazy"');
    });

    it('renders links with special characters in URL', () => {
      const html = renderMarkdown('[Search](https://example.com/search?q=hello&lang=en)');
      // restoreHtmlEntities restores the & so the href has the raw &
      expect(html).toContain('<a href="https://example.com/search?q=hello&lang=en"');
    });

    it('renders images with empty alt text', () => {
      const html = renderMarkdown('![](photo.jpg)');
      expect(html).toContain('<img src="photo.jpg"');
      expect(html).toContain('alt=""');
    });

    it('renders SVG images', () => {
      const html = renderMarkdown('![diagram](chart.svg)');
      expect(html).toContain('<img src="chart.svg"');
    });

    it('renders images with data URI', () => {
      const html = renderMarkdown('![pic](data:image/png;base64,abc)');
      expect(html).toContain('src="data:image/png;base64,abc"');
    });

    it('renders multiple links in same line', () => {
      const html = renderMarkdown('[A](http://a.com) and [B](http://b.com)');
      expect(html).toContain('<a href="http://a.com"');
      expect(html).toContain('<a href="http://b.com"');
    });
  });

  describe('tables', () => {
    it('renders GFM pipe tables', () => {
      const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |';
      const html = renderMarkdown(md);
      expect(html).toContain('<table>');
      expect(html).toContain('<th');
      expect(html).toContain('Name');
      expect(html).toContain('<td');
      expect(html).toContain('Alice');
    });

    it('supports alignment', () => {
      const md = '| Left | Center | Right |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |';
      const html = renderMarkdown(md);
      expect(html).toContain('text-align:left');
      expect(html).toContain('text-align:center');
      expect(html).toContain('text-align:right');
    });

    it('renders table with multiple data rows', () => {
      const md = '| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |';
      const html = renderMarkdown(md);
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('<th');
      // Two body rows
      const tdMatches = html.match(/<tr>/g);
      expect(tdMatches!.length).toBe(3); // 1 header + 2 body
    });

    it('handles table row with fewer cells than headers', () => {
      const md = '| A | B | C |\n| --- | --- | --- |\n| 1 |';
      const html = renderMarkdown(md);
      expect(html).toContain('<table>');
      // Missing cells should render as empty <td>
      expect(html).toContain('<td');
    });

    it('renders inline formatting in table cells', () => {
      const md = '| Name |\n| --- |\n| **bold** |';
      const html = renderMarkdown(md);
      expect(html).toContain('<strong>bold</strong>');
    });

    it('handles table without leading/trailing pipes', () => {
      const md = 'A | B\n--- | ---\n1 | 2';
      const html = renderMarkdown(md);
      expect(html).toContain('<table>');
      expect(html).toContain('A');
      expect(html).toContain('1');
    });
  });

  describe('paragraphs', () => {
    it('wraps plain text in <p>', () => {
      expect(renderMarkdown('hello world')).toContain('<p>hello world</p>');
    });

    it('handles line breaks', () => {
      const html = renderMarkdown('line 1\nline 2');
      expect(html).toContain('<br>');
    });
  });

  describe('security', () => {
    it('escapes HTML entities', () => {
      const html = renderMarkdown('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('sanitizes SVG event handlers', () => {
      const md = '<svg onclick="alert(1)" width="100" height="100"><circle /></svg>';
      const html = renderMarkdown(md);
      expect(html).not.toContain('onclick');
    });

    it('removes javascript: URLs from SVG', () => {
      const md = '<svg><a href="javascript:alert(1)"><text>click</text></a></svg>';
      const html = renderMarkdown(md);
      expect(html).not.toContain('javascript:');
    });

    it('removes script elements from SVG', () => {
      const md = '<svg><script>alert(1)</script></svg>';
      const html = renderMarkdown(md);
      expect(html).not.toContain('<script>');
    });
  });

  describe('SVG handling', () => {
    it('wraps SVG in md-svg container', () => {
      const md = '<svg width="100" height="100"><rect /></svg>';
      const html = renderMarkdown(md);
      expect(html).toContain('<div class="md-svg">');
      expect(html).toContain('<svg');
    });

    it('adds viewBox when missing but width/height present', () => {
      const md = '<svg width="200" height="100"><rect /></svg>';
      const html = renderMarkdown(md);
      expect(html).toContain('viewBox="0 0 200 100"');
    });

    it('removes fixed width/height attributes for responsive sizing', () => {
      const md = '<svg width="200" height="100"><rect /></svg>';
      const html = renderMarkdown(md);
      // width and height should be stripped so CSS controls sizing
      expect(html).not.toMatch(/width="200"/);
      expect(html).not.toMatch(/height="100"/);
    });

    it('preserves existing viewBox and does not duplicate', () => {
      const md = '<svg viewBox="0 0 50 50" width="100" height="100"><rect /></svg>';
      const html = renderMarkdown(md);
      expect(html).toContain('viewBox="0 0 50 50"');
      // Should not add a second viewBox
      const viewBoxCount = (html.match(/viewBox/g) || []).length;
      expect(viewBoxCount).toBe(1);
    });

    it('handles multi-line SVG', () => {
      const md = '<svg width="100" height="100">\n  <circle cx="50" cy="50" r="40" />\n</svg>';
      const html = renderMarkdown(md);
      expect(html).toContain('<div class="md-svg">');
      expect(html).toContain('<circle');
    });

    it('removes xlink:href javascript: URLs', () => {
      const md = '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>';
      const html = renderMarkdown(md);
      expect(html).not.toContain('javascript:');
    });

    it('removes multiple event handlers', () => {
      const md = '<svg onload="alert(1)" onmouseover="alert(2)"><rect /></svg>';
      const html = renderMarkdown(md);
      expect(html).not.toContain('onload');
      expect(html).not.toContain('onmouseover');
    });
  });

  describe('line endings', () => {
    it('normalizes \\r\\n to \\n', () => {
      const html = renderMarkdown('# Hello\r\n\r\nWorld');
      expect(html).toContain('<h1>Hello</h1>');
      expect(html).toContain('<p>World</p>');
    });

    it('normalizes bare \\r to \\n', () => {
      const html = renderMarkdown('# Hello\r\rWorld');
      expect(html).toContain('<h1>Hello</h1>');
      expect(html).toContain('<p>World</p>');
    });
  });

  describe('blockquotes (extended)', () => {
    it('renders multi-line blockquotes', () => {
      const md = '> line 1\n> line 2';
      const html = renderMarkdown(md);
      expect(html).toContain('<blockquote>');
      expect(html).toContain('line 1');
      expect(html).toContain('line 2');
    });

    it('handles nested content inside blockquote', () => {
      const md = '> **bold** in quote';
      const html = renderMarkdown(md);
      expect(html).toContain('<blockquote>');
      expect(html).toContain('<strong>bold</strong>');
    });
  });

  describe('horizontal rules (extended)', () => {
    it('renders ___ as <hr>', () => {
      expect(renderMarkdown('___')).toContain('<hr>');
    });

    it('renders long --- as <hr>', () => {
      expect(renderMarkdown('------')).toContain('<hr>');
    });
  });

  describe('paragraphs (extended)', () => {
    it('handles double-space line breaks', () => {
      const html = renderMarkdown('line 1  \nline 2');
      expect(html).toContain('<br>');
    });

    it('handles multiple paragraphs separated by blank lines', () => {
      const html = renderMarkdown('para 1\n\npara 2');
      expect(html).toContain('<p>para 1</p>');
      expect(html).toContain('<p>para 2</p>');
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      expect(renderMarkdown('')).toBe('');
    });

    it('handles input with only whitespace', () => {
      expect(renderMarkdown('   \n   \n   ')).toBe('');
    });

    it('escapes quotes in HTML', () => {
      const html = renderMarkdown('He said "hello"');
      expect(html).toContain('&quot;hello&quot;');
    });

    it('escapes ampersands', () => {
      const html = renderMarkdown('A & B');
      expect(html).toContain('A &amp; B');
    });

    it('handles heading with inline code', () => {
      const html = renderMarkdown('## Use `console.log`');
      expect(html).toContain('<h2>');
      expect(html).toContain('<code>console.log</code>');
    });

    it('blockquote followed by non-quote non-blank line breaks', () => {
      const html = renderMarkdown('> quote\nplain text');
      expect(html).toContain('<blockquote>');
      expect(html).toContain('plain text');
    });

    it('list ends at blank line not followed by list item', () => {
      const html = renderMarkdown('- item 1\n- item 2\n\nParagraph after');
      expect(html).toContain('<li>item 1</li>');
      expect(html).toContain('<li>item 2</li>');
      expect(html).toContain('<p>Paragraph after</p>');
    });

    it('list ends at non-list non-indented line', () => {
      const html = renderMarkdown('- item 1\nRegular text');
      expect(html).toContain('<li>item 1</li>');
      expect(html).toContain('Regular text');
    });

    it('handles empty paragraph between blocks', () => {
      const html = renderMarkdown('# Heading\n\n# Another');
      expect(html).toContain('<h1>Heading</h1>');
      expect(html).toContain('<h1>Another</h1>');
    });
  });
});
