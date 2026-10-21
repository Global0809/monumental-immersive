export type TranscriptCue = { start: number; end: number; text: string };

function seconds(value: string): number {
  if (!/^\d{2,}:\d{2}(?::\d{2})?(?:\.\d{3})?$/.test(value)) return NaN;
  const parts = value.split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(part => !Number.isFinite(part) || part < 0)) return NaN;
  if (parts.at(-1)! >= 60 || (parts.length === 3 && parts[1] >= 60) || parts.slice(0,-1).some(part => !Number.isInteger(part))) return NaN;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** Read WebVTT cue text as plain text. Markup is never injected into the document. */
export function parseTranscript(source: string): TranscriptCue[] {
  return source.replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n\s*\n/).flatMap(block => {
    if (/^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(block.trim())) return [];
    const lines = block.trim().split('\n');
    const timing = lines.findIndex(line => line.includes('-->'));
    if (timing < 0) return [];
    const match = lines[timing].match(/^\s*([\d:.]+)\s+-->\s+([\d:.]+)/);
    if (!match) return [];
    const start = seconds(match[1]); const end = seconds(match[2]);
    const text = lines.slice(timing + 1).join(' ').replace(/<[^>]*>/g, '').replace(/&(?:nbsp|amp|lt|gt|quot|apos|lrm|rlm);|&#(?:x[\da-f]+|\d+);/gi, entity => {
      const named: Record<string,string> = {'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&lrm;':'\u200e','&rlm;':'\u200f'};
      if (named[entity.toLowerCase()] !== undefined) return named[entity.toLowerCase()];
      const value = entity.toLowerCase().startsWith('&#x') ? parseInt(entity.slice(3,-1),16) : parseInt(entity.slice(2,-1),10);
      return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : entity;
    }).trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return [];
    return [{ start, end, text }];
  }).sort((a,b) => a.start - b.start);
}

/** Keep whole-second bookmarks inside the playable interval, including an exact-end capture. */
export function clampMomentTime(time: number, duration: number): number | null {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return null;
  return Math.min(Math.max(0,Math.floor(time)),Math.max(0,Math.ceil(duration)-1));
}

export function momentTime(seconds: number): string {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return value >= 3600 ? `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
