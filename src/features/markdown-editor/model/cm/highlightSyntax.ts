import type { MarkdownConfig } from '@lezer/markdown';
import { tags } from '@lezer/highlight';

/**
 * `==выделение==` — расширение синтаксиса, которого нет ни в CommonMark, ни в GFM.
 * Наш `parseMarkdown` его поддерживает (`.md-mark`), значит парсер редактора обязан
 * знать о нём тоже: иначе `==` осталось бы обычным текстом и не подсвечивалось.
 *
 * Построено по образцу `Strikethrough` из @lezer/markdown — та же схема с парными
 * ограничителями, только символ другой.
 */
const HighlightDelim = { resolve: 'Highlight', mark: 'HighlightMark' };

const PUNCTUATION = /[!-/:-@[-`{-~\xA1\xA7\xAB\xB6\xB7\xBB\xBF‐-‧‰-⁞⸀-⹿]/;

export const Highlight: MarkdownConfig = {
  defineNodes: [
    { name: 'Highlight', style: { 'Highlight/...': tags.special(tags.emphasis) } },
    { name: 'HighlightMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'Highlight',
      parse(cx, next, pos) {
        // 61 === '='. Три подряд — это уже не выделение, а, например, setext-подчёркивание.
        if (next !== 61 || cx.char(pos + 1) !== 61 || cx.char(pos + 2) === 61) return -1;
        const before = cx.slice(pos - 1, pos);
        const after = cx.slice(pos + 2, pos + 3);
        const sBefore = /\s|^$/.test(before);
        const sAfter = /\s|^$/.test(after);
        const pBefore = PUNCTUATION.test(before);
        const pAfter = PUNCTUATION.test(after);
        return cx.addDelimiter(
          HighlightDelim,
          pos,
          pos + 2,
          !sAfter && (!pAfter || sBefore || pBefore),
          !sBefore && (!pBefore || sAfter || pAfter),
        );
      },
      after: 'Emphasis',
    },
  ],
};
