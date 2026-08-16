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
    const html =
      '<pre class="md-pre"><code><div>line 1</div><div>  line 2</div><div>line 3</div></code></pre>';
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

describe('nested lists', () => {
  const roundTrip = (md: string) => htmlToMarkdown(parseMarkdown(md));

  it('keeps nested unordered items instead of merging them into the parent', () => {
    expect(roundTrip('- a\n  - b\n  - c')).toBe('- a\n  - b\n  - c');
  });

  it('keeps two levels of nesting', () => {
    expect(roundTrip('- a\n  - b\n    - c')).toBe('- a\n  - b\n    - c');
  });

  it('keeps a nested ordered list under an unordered item', () => {
    expect(roundTrip('- a\n  1. one\n  2. two')).toBe('- a\n  1. one\n  2. two');
  });

  it('keeps task-list markers', () => {
    expect(roundTrip('- [x] done\n- [ ] todo')).toBe('- [x] done\n- [ ] todo');
  });

  it('leaves a flat list untouched', () => {
    expect(roundTrip('- a\n- b')).toBe('- a\n- b');
  });

  it('reads the checked state from the attribute the editor toggles', () => {
    const html =
      '<ul class="md-ul"><li class="md-li md-task-item">' +
      '<input type="checkbox" checked class="md-checkbox"> сделано</li></ul>';
    expect(htmlToMarkdown(html)).toBe('- [x] сделано');
  });
});

describe('zero-width spaces', () => {
  it('drops the ZWSP the editor uses to park the caret outside <mark>', () => {
    const html = '<p class="md-p"><mark class="md-mark">важно</mark>​ дальше</p>';
    expect(htmlToMarkdown(html)).toBe('==важно== дальше');
  });
});
