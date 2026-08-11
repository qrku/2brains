import { safeUrl } from './safeUrl';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\wа-яёa-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

/* ─── Inline parser ────────────────────────────────────────────────────────── */

export function parseInline(raw: string): string {
  // 1. Extract inline code spans first — prevent inner formatting
  const spans: string[] = [];
  let s = raw.replace(/`([^`]+)`/g, (_, code) => {
    spans.push(`<code class="md-code">${esc(code)}</code>`);
    return `\x00${spans.length - 1}\x00`;
  });

  // 2. Escape HTML in non-code parts
  s = s.replace(/[&<>"']/g, (c) => esc(c));

  // 3. Images (must come before links)
  s = s.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:[^)]*?)?\)/g,
    (_, alt, src) =>
      `<img src="${safeUrl(src, '')}" alt="${esc(alt)}" class="md-img" loading="lazy">`,
  );

  // 4. Links  [text](url) and [text](url "title")
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_, text, href) =>
      `<a href="${safeUrl(href)}" target="_blank" rel="noopener noreferrer" class="md-link">${text}</a>`,
  );

  // 5. Bold + italic
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');

  // 6. Bold
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');

  // 7. Italic
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<em>$1</em>');

  // 8. Strikethrough
  s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

  // 9. Highlight  ==text==
  s = s.replace(/==([^=\n]+)==/g, '<mark class="md-mark">$1</mark>');

  // 10. Hard line break: two trailing spaces or backslash before newline
  s = s.replace(/(?:  |\\)$/, '<br>');

  // 11. Restore code spans
  s = s.replace(/\x00(\d+)\x00/g, (_, i) => spans[+i]);

  return s;
}

/* ─── Table parser ─────────────────────────────────────────────────────────── */

function parseTable(lines: string[]): string {
  const splitRow = (l: string) =>
    l
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());

  const headers = splitRow(lines[0]);
  const aligns = splitRow(lines[1]).map((c) => {
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.endsWith(':')) return 'right';
    if (c.startsWith(':')) return 'left';
    return '';
  });

  const style = (i: number) => (aligns[i] ? ` style="text-align:${aligns[i]}"` : '');

  const thead = `<tr>${headers.map((h, i) => `<th class="md-th"${style(i)}>${parseInline(h)}</th>`).join('')}</tr>`;
  const tbody = lines
    .slice(2)
    .map(
      (row) =>
        `<tr>${splitRow(row)
          .map((c, i) => `<td class="md-td"${style(i)}>${parseInline(c)}</td>`)
          .join('')}</tr>`,
    )
    .join('');

  return `<div class="md-table-wrap"><table class="md-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;
}

/* ─── List helpers ─────────────────────────────────────────────────────────── */

function isULI(s: string): boolean {
  return /^[-*+]\s/.test(s.trimStart());
}
function isOLI(s: string): boolean {
  return /^\d+[.)]\s/.test(s.trimStart());
}
function getIndent(s: string): number {
  return s.match(/^(\s*)/)?.[1].length ?? 0;
}

function stripULI(s: string): string {
  return s.trimStart().replace(/^[-*+]\s/, '');
}
function stripOLI(s: string): string {
  return s.trimStart().replace(/^\d+[.)]\s/, '');
}

function buildListItems(lines: string[], baseIndent: number, ordered: boolean): string {
  const items: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const indent = getIndent(line);
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      i++;
      continue;
    } // shouldn't happen if called correctly

    const strip = ordered ? stripOLI(line) : stripULI(line);
    // Check for task list marker
    const taskM = strip.match(/^\[([ xX])\]\s+([\s\S]*)/);
    let content: string;
    let taskHtml = '';

    if (taskM) {
      const checked = taskM[1].toLowerCase() === 'x';
      taskHtml = `<input type="checkbox" ${checked ? 'checked' : ''} disabled class="md-checkbox"> `;
      content = taskM[2];
    } else {
      content = strip;
    }

    // Collect sub-lines (more indented)
    i++;
    const subLines: string[] = [];
    while (i < lines.length && getIndent(lines[i]) > baseIndent) {
      subLines.push(lines[i]);
      i++;
    }

    let inner = taskHtml + parseInline(content);
    if (subLines.length > 0) {
      // Detect if sub-lines form a nested list
      const first = subLines[0]?.trimStart() ?? '';
      if (isULI(first) || isOLI(first)) {
        const subIndent = getIndent(subLines[0]);
        const subOrdered = isOLI(first);
        inner += subOrdered
          ? `<ol class="md-ol">${buildListItems(subLines, subIndent, true)}</ol>`
          : `<ul class="md-ul">${buildListItems(subLines, subIndent, false)}</ul>`;
      }
    }

    const liClass = taskM ? 'md-li md-task-item' : 'md-li';
    items.push(`<li class="${liClass}">${inner}</li>`);
  }

  return items.join('');
}

/* ─── Block parser ─────────────────────────────────────────────────────────── */

export function parseMarkdown(raw: string): string {
  if (!raw.trim()) return '';

  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trim = line.trim();

    // ── Blank line ──────────────────────────────────────────────────────────
    if (!trim) {
      i++;
      continue;
    }

    // ── <details> / <summary> collapsible block ─────────────────────────────
    if (/^<details(\s[^>]*)?>$/i.test(trim)) {
      const openAttr = /\bopen\b/i.test(trim) ? ' open' : '';
      let summaryText = '';
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length && !/^<\/details>$/i.test(lines[i].trim())) {
        const sumM = lines[i].trim().match(/^<summary>(.*?)<\/summary>$/i);
        if (sumM && !summaryText) {
          summaryText = sumM[1];
        } else {
          bodyLines.push(lines[i]);
        }
        i++;
      }
      i++; // consume </details>
      const sumHtml = parseInline(summaryText || 'Подробнее');
      const bodyHtml = parseMarkdown(bodyLines.join('\n'));
      out.push(
        `<details${openAttr} class="md-details">` +
          `<summary class="md-summary">${sumHtml}</summary>` +
          `<div class="md-details-body">${bodyHtml}</div>` +
          `</details>`,
      );
      continue;
    }

    // ── Fenced code block (``` or ~~~) ──────────────────────────────────────
    const fenceM = line.match(/^(`{3,}|~{3,})(.*)/);
    if (fenceM) {
      const fence = fenceM[1];
      const lang = fenceM[2].trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence[0].repeat(3))) {
        code.push(esc(lines[i]));
        i++;
      }
      i++;
      const langClass = lang ? ` class="language-${esc(lang)}"` : '';
      out.push(`<pre class="md-pre"><code${langClass}>${code.join('\n')}</code></pre>`);
      continue;
    }

    // ── ATX Headings  # … ###### ────────────────────────────────────────────
    const hM = trim.match(/^(#{1,6})\s+(.*?)(?:\s+#+)?$/);
    if (hM) {
      const lvl = hM[1].length;
      const txt = hM[2];
      out.push(`<h${lvl} class="md-h${lvl}" id="${slug(txt)}">${parseInline(txt)}</h${lvl}>`);
      i++;
      continue;
    }

    // ── Setext headings (text then === or ---) ───────────────────────────────
    if (i + 1 < lines.length && trim && !trim.match(/^[#>|`~*\-+\d\[]/)) {
      const nextTrim = lines[i + 1].trim();
      if (/^=+$/.test(nextTrim)) {
        out.push(`<h1 class="md-h1" id="${slug(trim)}">${parseInline(trim)}</h1>`);
        i += 2;
        continue;
      }
      if (/^-{2,}$/.test(nextTrim)) {
        out.push(`<h2 class="md-h2" id="${slug(trim)}">${parseInline(trim)}</h2>`);
        i += 2;
        continue;
      }
    }

    // ── Horizontal rule  --- or *** or ___ (3+ chars, optional spaces) ──────
    if (/^([-*_])(\s*\1){2,}\s*$/.test(trim)) {
      out.push('<hr class="md-hr">');
      i++;
      continue;
    }

    // ── Blockquote ──────────────────────────────────────────────────────────
    if (line.startsWith('>')) {
      const bq: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l.startsWith('> ')) bq.push(l.slice(2));
        else if (l.trimStart() === '>') bq.push('');
        // `>foo`, `>>nested` — marker without a space, still part of the quote
        else if (l.startsWith('>')) bq.push(l.slice(1));
        else if (l.trim() === '' && bq.length) bq.push('');
        else break;
        i++;
      }
      // Remove trailing blank
      while (bq.length && bq[bq.length - 1] === '') bq.pop();
      out.push(`<blockquote class="md-blockquote">${parseMarkdown(bq.join('\n'))}</blockquote>`);
      continue;
    }

    // ── Table (GFM) ─────────────────────────────────────────────────────────
    if ((trim.startsWith('|') || trim.includes('|')) && i + 1 < lines.length) {
      const sep = lines[i + 1].trim();
      if (/^\|?[-:|\s]+\|/.test(sep)) {
        const tbl: string[] = [];
        while (i < lines.length && lines[i].trim().includes('|')) {
          tbl.push(lines[i]);
          i++;
        }
        if (tbl.length >= 2) {
          out.push(parseTable(tbl));
          continue;
        }
        // Not a valid table — fall through by re-winding
        i -= tbl.length;
      }
    }

    // ── Unordered list  ─, *, + ─────────────────────────────────────────────
    if (isULI(trim)) {
      const baseIndent = getIndent(line);
      const listLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const ind = getIndent(l);
        // Accept same-or-deeper-indented lines; stop at blank or shallower non-list
        if (l.trim() === '') {
          i++;
          break;
        }
        if (ind < baseIndent) break;
        listLines.push(l);
        i++;
      }
      out.push(`<ul class="md-ul">${buildListItems(listLines, baseIndent, false)}</ul>`);
      continue;
    }

    // ── Ordered list  1. / 1) ───────────────────────────────────────────────
    if (isOLI(trim)) {
      const baseIndent = getIndent(line);
      const startM = trim.match(/^(\d+)/);
      const start = startM ? parseInt(startM[1]) : 1;
      const listLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const ind = getIndent(l);
        if (l.trim() === '') {
          i++;
          break;
        }
        if (ind < baseIndent) break;
        listLines.push(l);
        i++;
      }
      const startAttr = start !== 1 ? ` start="${start}"` : '';
      out.push(`<ol class="md-ol"${startAttr}>${buildListItems(listLines, baseIndent, true)}</ol>`);
      continue;
    }

    // ── Paragraph (consecutive non-special lines) ────────────────────────────
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      const lt = l.trim();
      if (!lt) break;
      if (lt.match(/^#{1,6}\s/)) break;
      if (lt.match(/^(`{3,}|~{3,})/)) break;
      if (/^([-*_])(\s*\1){2,}\s*$/.test(lt)) break;
      if (l.startsWith('>')) break;
      if (isULI(lt) || isOLI(lt)) break;
      // Setext underline on next line
      if (i + 1 < lines.length) {
        const nl = lines[i + 1].trim();
        if (/^=+$/.test(nl) || /^-{2,}$/.test(nl)) {
          para.push(l);
          i++;
          break;
        }
      }
      para.push(l);
      i++;
    }

    if (para.length) {
      // Soft line breaks → single space; hard line break (  \ at end) → <br>
      const content = para
        .map((l) => {
          if (l.endsWith('  ') || l.endsWith('\\')) {
            return parseInline(l.replace(/(?:  |\\)$/, '')) + '<br>';
          }
          return parseInline(l);
        })
        .join(' ');
      out.push(`<p class="md-p">${content}</p>`);
    }
  }

  return out.join('\n');
}
