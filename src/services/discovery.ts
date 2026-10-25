import { videos, places } from "../data/catalogue";
import type { Video } from "../data/catalogue";
export interface Filters {
  q?: string;
  place?: string;
  category?: string;
  period?: string;
  access?: string;
  duration?: string;
  status?: string;
}
export function filterVideos(
  filters: Filters,
  source: Video[] = videos,
): Video[] {
  const terms = (filters.q || "")
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return source.filter((v) => {
    const text = [
      v.title,
      v.description,
      v.category,
      v.series,
      ...v.tags,
      ...v.people,
      ...v.places.map((id) => {
        const place = places.find((p) => p.id === id);
        return place ? `${place.name} ${place.country}` : id;
      }),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      terms.every((term) => text.includes(term)) &&
      (!filters.place || v.places.includes(filters.place)) &&
      (!filters.category || v.category === filters.category) &&
      (!filters.period || v.period === filters.period) &&
      (!filters.access || v.access === filters.access) &&
      (!filters.status || v.status === filters.status) &&
      (!filters.duration ||
        (v.status === "available" &&
          (filters.duration === "short"
            ? v.duration < 180
            : filters.duration === "medium"
              ? v.duration >= 180 && v.duration < 600
              : v.duration >= 600)))
    );
  });
}
export function relatedVideos(
  video: Video,
): { video: Video; reason: string }[] {
  return videos
    .filter((v) => v.id !== video.id && v.status === "available")
    .map((v) => {
      const shared = v.places.find((p) => video.places.includes(p));
      const tag = v.tags.find(
        (t) =>
          ![
            "preview",
            "motion study",
            "history",
            "originals",
            "in development",
          ].includes(t) && video.tags.includes(t),
      );
      const series = Boolean(v.series && v.series === video.series);
      const score =
        (series ? 5 : 0) +
        (shared ? 3 : 0) +
        (tag ? 2 : 0) +
        (v.category === video.category ? 1 : 0);
      return {
        video: v,
        score,
        reason: series
          ? `From ${v.series}`
          : shared
            ? `Connected through ${places.find((p) => p.id === shared)?.name}`
            : tag
              ? `A shared thread: ${tag}`
              : v.category === video.category
                ? `More ${v.category.toLowerCase()}`
                : "Another world to discover",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}
export function buildJourney(
  category: string,
  minutes: number,
  place: string,
): Video[] {
  let remaining = minutes * 60;
  const candidates = videos
    .filter((v) => v.status === "available" && v.access === "free" && v.src)
    .map((v) => ({
      v,
      score:
        (v.category === category ? 4 : 0) + (v.places.includes(place) ? 3 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  const chosen: Video[] = [];
  for (const { v } of candidates) {
    if (v.duration <= remaining && chosen.length < 5) {
      chosen.push(v);
      remaining -= v.duration;
    }
  }
  return chosen;
}
export const durationLabel = (seconds: number) =>
  seconds < 60
    ? `${Math.round(seconds)} sec`
    : `${Math.floor(seconds / 60)} min${seconds % 60 >= 30 ? " +" : ""}`;
