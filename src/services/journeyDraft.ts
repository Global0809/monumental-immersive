import { places, videos } from '../data/catalogue';

export const journeyMoods = ['Music', 'Culture', 'Fashion', 'Film', 'Art & Design', 'Food'];
export const JOURNEY_DRAFT_KEY = 'monumental.journey-draft.v1';
export type JourneyDraft = { mood: string; minutes: number; journeyMinutes: number; place: string; videoIds: string[]; name: string; generated: boolean; emptied: boolean; editingId: string | null };
export const emptyJourneyDraft = (): JourneyDraft => ({ mood: 'Music', minutes: 5, journeyMinutes: 5, place: places[0]?.id || 'miami', videoIds: [], name: '', generated: false, emptied: false, editingId: null });

/** Browser drafts can contain only bounded, playable catalogue references. */
export function validateJourneyDraft(value: unknown): JourneyDraft | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<JourneyDraft>;
  const fallback = emptyJourneyDraft();
  const videoIds = Array.isArray(data.videoIds) ? [...new Set(data.videoIds.filter((id): id is string => typeof id === 'string' && videos.some(video => video.id === id && video.status === 'available' && video.access === 'free' && Boolean(video.src))))].slice(0, 50) : [];
  return {
    mood: journeyMoods.includes(data.mood || '') ? data.mood! : fallback.mood,
    minutes: [1, 5, 15, 30].includes(data.minutes || 0) ? data.minutes! : 5,
    journeyMinutes: [1, 5, 15, 30].includes(data.journeyMinutes || 0) ? data.journeyMinutes! : 5,
    place: places.some(place => place.id === data.place) ? data.place! : fallback.place,
    videoIds,
    name: typeof data.name === 'string' ? data.name.slice(0, 80) : '',
    generated: data.generated === true || videoIds.length > 0,
    emptied: data.emptied === true && !videoIds.length,
    editingId: typeof data.editingId === 'string' && data.editingId.length <= 120 && data.editingId.trim() ? data.editingId : null,
  };
}

export function readJourneyDraft(): JourneyDraft | null {
  try {
    const raw = localStorage.getItem(JOURNEY_DRAFT_KEY);
    if (!raw || raw.length > 20000) return null;
    return validateJourneyDraft(JSON.parse(raw));
  } catch { return null; }
}

export function writeJourneyDraft(draft: JourneyDraft): boolean {
  try { localStorage.setItem(JOURNEY_DRAFT_KEY, JSON.stringify(validateJourneyDraft(draft))); return true; }
  catch { return false; }
}
