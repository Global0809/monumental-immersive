/** Word boundaries use UTF-16 offsets, like DOM Range and caretPositionFromPoint. */
export function typeWordAt(text: string, offset: number): [number, number] | null {
  if (offset < 0 || offset > text.length) return null;
  for (const match of text.matchAll(/[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*/gu)) {
    const start = match.index, end = start + match[0].length;
    if (offset >= start && offset < end) return [start, end];
    if (offset === end && (offset === text.length || /\s/.test(text[offset]))) return [start, end];
  }
  return null;
}

export function typePressure(x: number, y: number, width: number, height: number) {
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  const px = clamp(x / Math.max(width, 1) * 2 - 1);
  const py = clamp(y / Math.max(height, 1) * 2 - 1);
  return { x: px * 5, y: py * 3, angle: px * 3.5 };
}
