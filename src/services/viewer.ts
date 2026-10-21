import { useSyncExternalStore } from "react";

export type ViewingProgress = {
  time: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
};
export type Journey = { id: string; name: string; videoIds: string[] };
export type SavedMoment = { id: string; videoId: string; time: number; note: string; createdAt: number };
export type ViewerState = {
  saved: string[];
  savedPlaces: string[];
  history: Record<string, ViewingProgress>;
  interests: string[];
  journeys: Journey[];
  moments: SavedMoment[];
  sound: boolean;
  masterVolume: number;
  ambient: boolean;
  ambientMix: number;
  reducedMotion: boolean;
};

const STORAGE_KEY = "monumental.viewer.v1";
const listeners = new Set<() => void>();
const defaults: ViewerState = {
  saved: [],
  savedPlaces: [],
  history: {},
  interests: [],
  journeys: [],
  moments: [],
  sound: false,
  masterVolume: 0.45,
  ambient: false,
  ambientMix: 0.2,
  reducedMotion:
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};
let current: ViewerState | undefined;
let storageListening = false;
let storageAvailable = true;

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter((item): item is string => typeof item === "string"),
        ),
      ].slice(0, 1000)
    : [];
}

function validate(value: unknown): ViewerState {
  if (!value || typeof value !== "object") return { ...defaults };
  const data = value as Partial<ViewerState>;
  const history: ViewerState["history"] = {};
  if (data.history && typeof data.history === "object") {
    for (const [id, entry] of Object.entries(data.history)) {
      if (
        !entry ||
        !Number.isFinite(entry.time) ||
        !Number.isFinite(entry.duration)
      )
        continue;
      history[id] = {
        time: Math.max(0, entry.time),
        duration: Math.max(0, entry.duration),
        completed: entry.completed === true,
        updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0,
      };
    }
  }
  const journeys = Array.isArray(data.journeys)
    ? data.journeys
        .filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            typeof item.name === "string",
        )
        .map((item) => ({
          id: item.id,
          name: item.name.slice(0, 100),
          videoIds: strings(item.videoIds),
        }))
        .slice(0, 100)
    : [];
  const moments: SavedMoment[] = [];
  const momentIds = new Set<string>();
  const momentPositions = new Set<string>();
  for (const item of Array.isArray(data.moments) ? data.moments : []) {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || typeof item.videoId !== 'string' || !item.videoId.trim() || !Number.isFinite(item.time) || item.time < 0) continue;
    const time = Math.min(Math.floor(item.time), 86400);
    const position = JSON.stringify([item.videoId,time]);
    if (momentIds.has(item.id) || momentPositions.has(position)) continue;
    momentIds.add(item.id); momentPositions.add(position);
    moments.push({ id:item.id, videoId:item.videoId, time, note:typeof item.note === 'string' ? item.note.trim().slice(0,180) : '', createdAt:Number.isFinite(item.createdAt) ? Math.max(0,item.createdAt) : 0 });
  }
  return {
    saved: strings(data.saved),
    savedPlaces: strings(data.savedPlaces),
    interests: strings(data.interests),
    history,
    journeys,
    moments: moments.slice(-300),
    sound: data.sound === true,
    masterVolume:
      typeof data.masterVolume === "number" && Number.isFinite(data.masterVolume)
        ? Math.max(0, Math.min(1, data.masterVolume))
        : defaults.masterVolume,
    ambient: data.ambient === true,
    ambientMix:
      typeof data.ambientMix === "number" && Number.isFinite(data.ambientMix)
        ? Math.max(0, Math.min(1, data.ambientMix))
        : defaults.ambientMix,
    reducedMotion:
      typeof data.reducedMotion === "boolean"
        ? data.reducedMotion
        : defaults.reducedMotion,
  };
}

function readStorage(): ViewerState {
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    return raw ? validate(JSON.parse(raw)) : { ...defaults };
  } catch {
    // Private browsing and a full storage quota still allow an in-memory guest session.
    storageAvailable = false;
    return { ...defaults };
  }
}

export function getViewer(): ViewerState {
  current ??= readStorage();
  return current;
}

function emit() {
  for (const listener of listeners) listener();
}

export function updateViewer(
  update: Partial<ViewerState> | ((state: ViewerState) => Partial<ViewerState>),
): ViewerState {
  const before = getViewer();
  current = validate({
    ...before,
    ...(typeof update === "function" ? update(before) : update),
  });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  emit();
  return current;
}

export function subscribeViewer(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageListening && typeof window !== "undefined") {
    storageListening = true;
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        current = readStorage();
        emit();
      }
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useViewer(): ViewerState {
  return useSyncExternalStore(subscribeViewer, getViewer, () => defaults);
}

export function usePersistentStorage(): boolean {
  return useSyncExternalStore(subscribeViewer, () => { getViewer(); return storageAvailable; }, () => true);
}

export function toggleSaved(id: string): boolean {
  const saved = getViewer().saved;
  const added = !saved.includes(id);
  updateViewer({
    saved: added ? [...saved, id] : saved.filter((item) => item !== id),
  });
  return added;
}

export function togglePlace(id: string): boolean {
  const places = getViewer().savedPlaces;
  const added = !places.includes(id);
  updateViewer({
    savedPlaces: added ? [...places, id] : places.filter((item) => item !== id),
  });
  return added;
}

export function saveProgress(
  id: string,
  time: number,
  duration: number,
  completed = false,
): void {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0)
    return;
  const isComplete = completed || (time > 0 && time / duration >= 0.96);
  updateViewer((state) => ({
    history: {
      ...state.history,
      [id]: {
        time: Math.min(Math.max(0, time), duration),
        duration,
        completed: isComplete,
        updatedAt: Date.now(),
      },
    },
  }));
}

export function createJourney(name: string, videoIds: string[]): Journey {
  const journey: Journey = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `journey-${Date.now()}`,
    name: name.trim().slice(0, 100) || "My cultural journey",
    videoIds: strings(videoIds),
  };
  updateViewer((state) => ({ journeys: [...state.journeys, journey] }));
  return journey;
}

export function removeJourney(id: string): void {
  updateViewer((state) => ({
    journeys: state.journeys.filter((journey) => journey.id !== id),
  }));
}
export function clearHistory(): void {
  updateViewer({ history: {} });
}

export function saveMoment(videoId: string, time: number, note = ''): SavedMoment | null {
  if (!videoId.trim() || !Number.isFinite(time) || time < 0) return null;
  const second = Math.min(Math.floor(time), 86400);
  const existing = getViewer().moments.find(item => item.videoId === videoId && item.time === second);
  const identifier = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const moment: SavedMoment = { id: existing?.id || `moment-${identifier}`, videoId, time: second, note: note.trim().slice(0, 180), createdAt: existing?.createdAt ?? Date.now() };
  updateViewer(state => ({ moments: [...state.moments.filter(item => item.id !== moment.id), moment] }));
  return moment;
}

export function removeMoment(id: string): void {
  updateViewer(state => ({ moments: state.moments.filter(item => item.id !== id) }));
}

/** Undo preserves a newer note saved at the same position instead of duplicating it. */
export function restoreMoment(moment: SavedMoment): boolean {
  if (getViewer().moments.some(item => item.id === moment.id || (item.videoId === moment.videoId && item.time === moment.time))) return false;
  return updateViewer(state => ({ moments:[...state.moments,moment] })).moments.some(item => item.id === moment.id);
}

/** Local guest adapter. An authenticated implementation can retain this interface. */
export const viewerStore = {
  read: getViewer,
  update: updateViewer,
  subscribe: subscribeViewer,
  toggleSaved,
  togglePlace,
  saveProgress,
  createJourney,
  removeJourney,
  clearHistory,
  saveMoment,
  removeMoment,
  restoreMoment,
};
