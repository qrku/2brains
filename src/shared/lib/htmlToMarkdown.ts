/* Converts our parsed-markdown HTML back to markdown source.
   Handles both our known CSS classes and browser-injected elements
   (contentEditable wraps new lines in <div> on Chrome, <br> on Firefox). */

function textContent(el: Element): string {
  return Array.from(el.childNodes).map((n): string => {
    if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? '').replace(/ /g, ' ');
    if (n.nodeType !== Node.ELEMENT_NODE) return '';
    const e = n as Element;
    const t = e.tagName.toLowerCase();
    const inner = textContent(e);
    if (t === 'strong' || t === 'b')  return `**${inner}**`;
    if (t === 'em'     || t === 'i')  return `*${inner}*`;
    if (t === 'del'    || t === 's')  return `~~${inner}~~`;
    if (t === 'mark')                 return `==${inner}==`;
    if (t === 'a')   return `[${inner}](${e.getAttribute('href') ?? ''})`;
    if (t === 'img') return `![${e.getAttribute('alt') ?? ''}](${e.getAttribute('src') ?? ''})`;
    if (t === 'br')  return '\n';
    if (t === 'input') return '';        // checkbox in task list
    if (t === 'code' && e.parentElement?.tagName.toLowerCase() !== 'pre') return `\`${inner}\``;
    return inner;
  }).join('');
}

function nodeToMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '').replace(/ /g, ' ');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el  = node as Element;
  const tag = el.tagName.toLowerCase();
  const cls = el.className ?? '';

  // Headings
  for (let lvl = 1; lvl <= 6; lvl++) {
    if (cls.includes(`md-h${lvl}`) || tag === `h${lvl}`) {
      return `${'#'.repeat(lvl)} ${textContent(el)}\n\n`;
    }
  }

  // Paragraph (skip trailing-only <br> placeholders)
  if (cls.includes('md-p') || tag === 'p') {
    const t = textContent(el).replace(/^\n+|\n+$/g, '').trim();
    return t ? `${t}\n\n` : '';
  }

  // Horizontal rule
  if (cls.includes('md-hr') || tag === 'hr') return `---\n\n`;

  // Fenced code block
  if (cls.includes('md-pre') || tag === 'pre') {
    const code = el.querySelector('code');
    const lang = (code?.className ?? '').replace('language-', '');
    return `\`\`\`${lang}\n${code?.textContent ?? el.textContent ?? ''}\n\`\`\`\n\n`;
  }

  // Blockquote
  if (cls.includes('md-blockquote') || tag === 'blockquote') {
    const inner = Array.from(el.childNodes).map(nodeToMd).join('').trim();
    return inner.split('\n').map((l) => `> ${l}`).join('\n') + '\n\n';
  }

  // Unordered list
  if (cls.includes('md-ul') || (tag === 'ul' && !cls.includes('md-ol'))) {
    const items = Array.from(el.querySelectorAll(':scope > li')).map((li) => {
      const cb   = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      const text = textContent(li as Element).trim();
      return cb ? `- [${cb.checked ? 'x' : ' '}] ${text}` : `- ${text}`;
    });
    return items.join('\n') + '\n\n';
  }

  // Ordered list
  if (cls.includes('md-ol') || tag === 'ol') {
    const items = Array.from(el.querySelectorAll(':scope > li')).map((li, i) =>
      `${i + 1}. ${textContent(li as Element).trim()}`
    );
    return items.join('\n') + '\n\n';
  }

  // Details / summary
  if (cls.includes('md-details') || tag === 'details') {
    const sumEl  = el.querySelector('.md-summary, summary');
    const bodyEl = el.querySelector('.md-details-body');
    const sumText = sumEl ? textContent(sumEl as Element) : '';
    const bodyMd  = bodyEl
      ? Array.from(bodyEl.childNodes).map(nodeToMd).join('').trim()
      : '';
    const openAttr = (el as HTMLDetailsElement).open ? ' open' : '';
    return `<details${openAttr}>\n<summary>${sumText}</summary>\n\n${bodyMd}\n\n</details>\n\n`;
  }

  // Table
  if (cls.includes('md-table-wrap') || tag === 'table') {
    const rows = Array.from(el.querySelectorAll('tr'));
    if (!rows.length) return '';
    const getRow = (row: Element) =>
      Array.from(row.querySelectorAll('th, td')).map((c) => textContent(c as Element).trim());
    const first = getRow(rows[0]);
    const sep   = `| ${first.map(() => '---').join(' | ')} |`;
    const head  = `| ${first.join(' | ')} |`;
    const body  = rows.slice(1).map((r) => `| ${getRow(r).join(' | ')} |`).join('\n');
    return `${head}\n${sep}\n${body}\n\n`;
  }

  // Browser-injected <div> (contentEditable new-line on Chrome)
  if (tag === 'div') {
    // Skip our own wrapper divs — their children are already handled above
    if (cls.includes('md-details-body') || cls.includes('md-table-wrap')) {
      return Array.from(el.childNodes).map(nodeToMd).join('');
    }
    const inner = textContent(el);
    if (!inner.trim()) return '\n\n';
    return `${inner}\n\n`;
  }

  // Inline / unknown — recurse
  return Array.from(el.childNodes).map(nodeToMd).join('');
}

export function htmlToMarkdown(html: string): string {
  if (typeof document === 'undefined') return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('.vc-placeholder').forEach((e) => e.remove());
  const md = Array.from(div.childNodes).map(nodeToMd).join('');
  return md.replace(/\n{3,}/g, '\n\n').trim();
}
