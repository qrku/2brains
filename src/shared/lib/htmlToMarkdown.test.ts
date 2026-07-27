/** @jest-environment jsdom */
import { htmlToMarkdown } from './htmlToMarkdown';
import { parseMarkdown } from './markdown';

describe('htmlToMarkdown — code blocks', () => {
  it('keeps fences for a code block (was lost: md-pre matched md-p as substring)', () => {
    const html = '<pre class="md-pre"><code>const x = 1;</code></pre>';
    expect(htmlToMarkdown(html)).toBe('```\nconst x = 1;\n```');
  });

  it('preserves the language class', () => {
    const html = '<pre class="md-pre"><code class="language-js">a</code></pre>';
    expect(htmlToMarkdown(html)).toBe('```js\na\n```');
  });

  it('keeps a multi-line code block (single text node with \\n)', () => {
    const html = '<pre class="md-pre"><code>┌──┐\n│  │\n└──┘</code></pre>';
    expect(htmlToMarkdown(html)).toBe('```\n┌──┐\n│  │\n└──┘\n```');
  });

  it('rebuilds line breaks that contentEditable turned into per-line <div>s', () => {
    const html = '<pre class="md-pre"><code><div>line 1</div><div>  line 2</div><div>line 3</div></code></pre>';
    expect(htmlToMarkdown(html)).toBe('```\nline 1\n  line 2\nline 3\n```');
  });

  it('rebuilds line breaks stored as <br>', () => {
    const html = '<pre class="md-pre"><code>a<br>b<br>c</code></pre>';
    expect(htmlToMarkdown(html)).toBe('```\na\nb\nc\n```');
  });

  it('round-trips markdown → html → markdown for a multi-line block', () => {
    const md = '```js\nconst a = 1;\nconst b = 2;\n```';
    expect(htmlToMarkdown(parseMarkdown(md))).toBe(md);
  });

  it('does not treat a real paragraph as a code block', () => {
    const html = '<p class="md-p">just text</p>';
    expect(htmlToMarkdown(html)).toBe('just text');
  });
});
