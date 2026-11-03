const ansi = /\x1b\[[0-9;]*m/g;
export const strip = s => s.replace(ansi, '');
const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
export function cellWidth(s) {
  let n = 0;
  for (const { segment } of segments.segment(strip(s))) {
    const cp = segment.codePointAt(0);
    if (/^\p{Mark}+$/u.test(segment)) continue;
    n += /\p{Extended_Pictographic}/u.test(segment) || cp >= 0x1100 && (
      cp <= 0x115f || cp >= 0x2e80 && cp <= 0xa4cf || cp >= 0xac00 && cp <= 0xd7a3 ||
      cp >= 0xf900 && cp <= 0xfaff || cp >= 0xfe10 && cp <= 0xfe6f ||
      cp >= 0xff01 && cp <= 0xff60 || cp >= 0xffe0 && cp <= 0xffe6 || cp >= 0x20000) ? 2 : 1;
  }
  return n;
}
export function fit(s, width) {
  if (cellWidth(s) <= width) return s;
  let result = '', count = 0;
  for (const { segment } of segments.segment(strip(s))) {
    const n = cellWidth(segment);
    if (count + n > width - 1) break;
    result += segment; count += n;
  }
  return result + '…';
}
export function pack(items, width) {
  const lines = []; let row = '';
  for (const item of items.filter(Boolean)) {
    if (row && cellWidth(row + ' │ ' + item) > width) { lines.push(fit(row, width)); row = ''; }
    row = row ? row + ' │ ' + item : item;
  }
  if (row) lines.push(fit(row, width));
  return lines;
}
export const color = (s, code, enabled) => enabled ? `\x1b[${code}m${s}\x1b[0m` : s;
export function quotaPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  if (value > 0 && rounded === 0) return '<0.1%';
  if (value < 100 && rounded === 100) return '>99.9%';
  return `${rounded}%`;
}
export function bar(value, remaining, enabled) {
  if (value === null) return '░░░░░░░░░░ --';
  const filled = Math.round(value / 10);
  const danger = remaining ? 100 - value : value;
  return color('█'.repeat(filled) + '░'.repeat(10 - filled), danger >= 90 ? 31 : danger >= 70 ? 33 : 32, enabled) + ` ${remaining ? quotaPercent(value) : Math.round(value) + '%'}`;
}
export function duration(seconds) {
  if (seconds === null) return 'reset unknown';
  if (seconds <= 0) return 'await refresh';
  let minutes = Math.ceil(seconds / 60), days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60); minutes %= 60;
  return 'reset ' + (days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`);
}
