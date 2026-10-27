/** Public media uses the same URL contract on root hosting and GitHub Pages. */
export function resolvePublicAsset(path: string, base = '/'): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const prefix = base.endsWith('/') ? base : `${base}/`;
  if (prefix !== '/' && path.startsWith(prefix)) return path;
  return prefix + path.slice(1);
}

export function assetUrl(path: string): string {
  return resolvePublicAsset(path, import.meta.env?.BASE_URL || '/');
}

export function isLocalMedia(path?: string): boolean {
  return Boolean(path?.startsWith(assetUrl('/media/')));
}
