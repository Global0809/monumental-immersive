/** Resolve public assets for both the root preview and a GitHub Pages subpath. */
export function assetUrl(path: string): string {
  const base = import.meta.env?.BASE_URL || '/';
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  if (base !== '/' && path.startsWith(base)) return path;
  return base + path.slice(1);
}

export function isLocalMedia(path?: string): boolean {
  return Boolean(path?.startsWith(assetUrl('/media/')));
}
