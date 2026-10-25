export type DragAxis = 'pending' | 'horizontal' | 'vertical';

/** Lock intent once, so a page scroll cannot turn into an orbit or era change. */
export function resolveDragAxis(dx: number, dy: number, previous: DragAxis = 'pending'): DragAxis {
  if (previous !== 'pending') return previous;
  const x = Math.abs(dx), y = Math.abs(dy);
  if (Math.max(x, y) < 8) return 'pending';
  if (x > y * 1.15) return 'horizontal';
  if (y > x * 1.15) return 'vertical';
  return 'pending';
}
