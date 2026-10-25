/** User-initiated choices stay with their controls; history returns to reading. */
export function routeScrollPosition(from: string, to: string, current: number, saved: number | undefined, intentional: boolean) {
  const samePage = from.split('?')[0] === to.split('?')[0];
  if (intentional) return samePage ? current : 0;
  return saved ?? (samePage ? current : 0);
}
