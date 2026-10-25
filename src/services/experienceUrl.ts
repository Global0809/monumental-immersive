/** Retire old experience-mode links without changing their destination. */
export function immersiveExperienceUrl(pathname: string, search: string, hash: string): string | null {
  const params = new URLSearchParams(search);
  if (!params.has('experience')) return null;
  params.delete('experience');
  return `${pathname}${params.size ? '?' + params.toString() : ''}${hash}`;
}
