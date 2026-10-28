import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import type { Video } from '../../data/catalogue';
import type { PassageChapter } from '../../services/passageChapters';
import { assetUrl } from '../../services/assets';
import { acquirePassageMedia, getPassageMedia, type PassageMediaController, type PassageMediaSnapshot } from '../../services/passageMedia';

const empty: PassageMediaSnapshot = { chapterId: null, status: 'idle', sourceEpoch: 0, ready: false };
const subscribeEmpty = () => () => {};
const getEmpty = () => empty;

function usePassageMedia() {
  const [controller, setController] = useState<PassageMediaController | null>(null);
  useEffect(() => {
    const lease = acquirePassageMedia();
    setController(lease.controller);
    return lease.release;
  }, []);
  const snapshot = useSyncExternalStore(controller?.subscribe ?? subscribeEmpty, controller?.getSnapshot ?? getEmpty, getEmpty);
  return { controller, snapshot };
}

export function PassageMediaCaption({ chapterId }: { chapterId: string }) {
  const { snapshot } = usePassageMedia();
  const media = getPassageMedia(chapterId);
  if (!media) return null;
  const moving = snapshot.chapterId === chapterId && snapshot.ready;
  return <p className="tunnel-source-note">{moving ? `In the room · ${media.caption}` : media.posterCaption}</p>;
}

/** Compact view borrows the renderer's decoder. Posters are always present,
 * so a blocked preview, a mode change or reduced motion never creates a hole. */
export default function PassageCompactMedia({ chapter, film, saved, reducedMotion, onWatch }: {
  chapter: PassageChapter; film: Video; saved: boolean; reducedMotion: boolean; onWatch: (film: Video) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const { controller, snapshot } = usePassageMedia();
  const media = getPassageMedia(chapter.id);
  const selected = snapshot.chapterId === chapter.id;
  const moving = selected && snapshot.ready && !reducedMotion && !saved;
  useEffect(() => {
    const element = host.current;
    if (!controller || !element || !selected || reducedMotion || saved) return;
    controller.attach(element);
    return () => { if (element.contains(controller.getVideo())) controller.attach(null); };
  }, [controller, selected, reducedMotion, saved]);
  useEffect(() => {
    if (!controller || chapter.id !== 'my-world') return;
    controller.setSuspended('compact-saved-poster', selected && saved);
    return () => controller.setSuspended('compact-saved-poster', false);
  }, [controller, chapter.id, selected, saved]);
  if (!media) return null;
  const caption = saved ? `Saved to My World · ${film.title}` : moving ? media.caption : media.posterCaption;
  return <figure className="tunnel-compact-media" data-environment={chapter.environment} data-moving={moving} style={{ '--passage-media-aspect': media.aspect } as CSSProperties}>
    <div className="tunnel-compact-window">
      <img src={assetUrl(saved ? film.poster : media.poster)} alt="" loading="lazy" decoding="async"/>
      <div ref={host} className="tunnel-compact-video" aria-hidden="true"/>
      <button onClick={() => onWatch(film)} aria-label={`Play ${film.title}`}><Play size={19} weight="fill"/><span>Play {film.title}</span></button>
    </div>
    <figcaption>{caption}{selected && (snapshot.status === 'failed' || snapshot.status === 'blocked') && !saved && <span>Preview unavailable. Open the story to watch.</span>}</figcaption>
  </figure>;
}
