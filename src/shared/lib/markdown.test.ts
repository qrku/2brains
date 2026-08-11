import { parseInline, parseMarkdown } from './markdown';

describe('parseInline — схемы ссылок', () => {
  it('оставляет http/https/mailto как есть', () => {
    expect(parseInline('[x](https://example.com/a?b=1)')).toContain(
      'href="https://example.com/a?b=1"',
    );
    expect(parseInline('[x](mailto:a@b.co)')).toContain('href="mailto:a@b.co"');
  });

  it('пропускает относительные ссылки и якоря', () => {
    expect(parseInline('[x](/space)')).toContain('href="/space"');
    expect(parseInline('[x](#anchor)')).toContain('href="#anchor"');
    expect(parseInline('[x](./file.md)')).toContain('href="./file.md"');
  });

  it('режет javascript: — в том числе percent- и регистр-обфускацию', () => {
    for (const url of [
      'javascript:alert%281%29',
      'JaVaScRiPt:alert%281%29',
      'vbscript:msgbox%281%29',
      'data:text/html;base64,PHNjcmlwdD4=',
    ]) {
      const html = parseInline(`[x](${url})`);
      expect(html).toContain('href="#"');
      expect(html).not.toContain(url.trim());
    }
  });

  it('режет javascript: в src изображения', () => {
    const html = parseInline('![a](javascript:alert%281%29)');
    expect(html).toContain('src=""');
    expect(html).not.toContain('javascript:');
  });

  it('экранирует кавычки, чтобы нельзя было выйти из атрибута', () => {
    expect(parseInline('a "b" <c> & \'d\'')).toBe('a &quot;b&quot; &lt;c&gt; &amp; &#39;d&#39;');
  });
});

describe('parseMarkdown — блокквоты', () => {
  it('не зацикливается на маркере без пробела', () => {
    expect(parseMarkdown('>foo')).toContain('foo');
    expect(parseMarkdown('>foo')).toContain('<blockquote');
  });

  it('обрабатывает вложенную цитату', () => {
    const html = parseMarkdown('>>a');
    expect(html).toContain('a');
    expect((html.match(/<blockquote/g) ?? []).length).toBe(2);
  });

  it('обычная цитата с пробелом работает по-прежнему', () => {
    const html = parseMarkdown('> hello\n> world');
    expect(html).toContain('<blockquote');
    expect(html).toContain('hello world');
  });

  it('выходит из цитаты на обычной строке', () => {
    const html = parseMarkdown('>a\ntail');
    expect(html).toContain('<blockquote');
    expect(html).toContain('tail');
  });
});
