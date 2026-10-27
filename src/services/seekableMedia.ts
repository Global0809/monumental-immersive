/** Small local previews need a finite, seekable resource on hosts without byte ranges. */
export const MAX_PREVIEW_BYTES = 16 * 1024 * 1024;

export async function prepareSeekableMedia(source: string, signal: AbortSignal): Promise<{ src: string; release: () => void }> {
  signal.throwIfAborted();
  const direct = { src: source, release: () => {} };
  // Full remote films remain streamed; never buffer a remote catalogue into memory.
  if (!source.startsWith('/') || source.startsWith('//')) return direct;
  const headers = await fetch(source, { method: 'HEAD', signal });
  if (headers.ok && headers.headers.get('accept-ranges')?.toLowerCase() === 'bytes') return direct;
  const declaredSize = Number(headers.headers.get('content-length') || 0);
  if (declaredSize > MAX_PREVIEW_BYTES) return direct;
  const response = await fetch(source, { signal });
  if (!response.ok || !response.body) throw new Error('This preview could not be loaded. Please try again.');
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PREVIEW_BYTES) {
        await reader.cancel();
        return direct;
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  signal.throwIfAborted();
  const src = URL.createObjectURL(new Blob(chunks, { type: response.headers.get('content-type') || 'video/mp4' }));
  let released = false;
  return { src, release: () => { if (!released) { released = true; URL.revokeObjectURL(src); } } };
}
