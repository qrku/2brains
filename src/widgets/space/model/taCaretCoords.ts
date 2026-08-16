/* ─── Textarea caret coords (mirror-div) ──────────────────────────────────── */
export function taCaretCoords(ta: HTMLTextAreaElement, pos: number): { top: number; left: number } {
  const div = document.createElement('div');
  const cs = window.getComputedStyle(ta);
  (
    [
      'fontFamily',
      'fontSize',
      'fontWeight',
      'letterSpacing',
      'lineHeight',
      'paddingTop',
      'paddingLeft',
      'paddingRight',
      'paddingBottom',
      'borderTopWidth',
      'borderLeftWidth',
      'boxSizing',
      'width',
      'whiteSpace',
      'wordWrap',
      'overflowWrap',
    ] as const
  ).forEach((p) => {
    div.style[p] = cs[p];
  });
  div.style.position = 'fixed';
  div.style.visibility = 'hidden';
  div.style.top = '0';
  div.style.left = '0';
  div.style.height = 'auto';
  div.style.overflow = 'hidden';
  div.textContent = ta.value.slice(0, pos);
  const span = document.createElement('span');
  span.textContent = ta.value[pos] ?? '​';
  div.appendChild(span);
  document.body.appendChild(div);
  const rect = ta.getBoundingClientRect();
  const res = {
    top: rect.top + span.offsetTop - ta.scrollTop + span.offsetHeight + 4,
    left: rect.left + span.offsetLeft - ta.scrollLeft,
  };
  document.body.removeChild(div);
  return res;
}
