import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { commitRoute, href } from '../../services/router';
import { playSound } from '../../services/audio';
import { enterSpatialWorld, getSpatialState, setSpatialFocus, setSpatialTravelling, spatialPortals, spatialRoomForPath, useSpatial } from '../../services/spatial';
import { spatialPassagePlan } from '../../services/spatialNavigation';
import { getDestination } from '../../services/exploration';
import { portalContext } from '../../services/portalContext';
import { assetUrl } from '../../services/assets';
import type { SpatialSceneController } from './scene';
import { editorialPageLabel } from '../GlobalNavigation';
import './spatial-navigation.css';

type Journey = { from: string; title: string; path: string; room: string; crossRoom: boolean; label: string; image: string; identity: string };

/** One owner for link intent, camera departure and DOM arrival. No duplicate
 * pages, screenshots of content, scroll hijack or independent loading theatre. */
export default function SpatialNavigator({ path, reducedMotion, paused, controller }: {
  path: string; reducedMotion: boolean; paused: boolean; controller: RefObject<SpatialSceneController | null>;
}) {
  const spatial = useSpatial();
  const [journey, setJourney] = useState<Journey | null>(null);
  const passage = useRef<HTMLDivElement>(null);
  const current = useRef({ path, reducedMotion, paused });
  current.current = { path, reducedMotion, paused };
  const previousPath = useRef(path);
  const motion = useRef<gsap.Context | null>(null);
  const pending = useRef<{ hash: string; commit: () => void } | null>(null);
  const timeout = useRef(0);
  const arrivalFrame = useRef(0);
  const observer = useRef<MutationObserver | null>(null);
  const revision = useRef(0);
  const cancelRef = useRef(() => {});

  function clearMotion() {
    window.clearTimeout(timeout.current);
    cancelAnimationFrame(arrivalFrame.current);
    observer.current?.disconnect(); observer.current = null;
    motion.current?.revert(); motion.current = null;
    const main = document.getElementById('main');
    if (main) main.inert = false;
    delete document.documentElement.dataset.spatialPassage;
  }
  function finish() {
    clearMotion(); pending.current = null; setJourney(null); setSpatialTravelling(null);
  }

  useEffect(() => {
    const cancel = () => { revision.current++; controller.current?.cancelTravel(); finish(); };
    cancelRef.current = cancel;
    const navigate = (destination: string, params: Record<string, string | undefined> = {}) => {
      const carried = portalContext(destination, params, getDestination());
      params = carried.params;
      const settings = current.current;
      const plan = spatialPassagePlan(settings.path, destination, settings.reducedMotion);
      if (!plan.changed) {
        if (pending.current) {
          cancel();
          // A newer choice can return to this room with different query state.
          // Consuming the intent must also commit its destination parameters.
          commitRoute(destination, params);
          return true;
        }
        return false;
      }
      if (settings.paused) return false;
      cancel();
      // Preserve the cover-to-story shared element; it already owns this move.
      if (!plan.duration || document.querySelector('.story-transition-cover') || document.hidden) {
        commitRoute(destination, params); return true;
      }
      // Enter the renderer before publishing the entered state. Otherwise the
      // parent's first-entry effect can cancel a flight just started by Index.
      if (!getSpatialState().entered) controller.current?.setState({
        entered: true, room: spatialRoomForPath(settings.path),
        paused: settings.paused, reducedMotion: settings.reducedMotion,
      });
      enterSpatialWorld();
      setSpatialFocus(plan.room === 'atrium' ? null : plan.room);
      document.querySelector<HTMLDialogElement>('.index-dialog[open]')?.close();
      const id = ++revision.current;
      const targetHash = href(destination, params);
      const commit = () => {
        if (id !== revision.current || !pending.current) return;
        window.clearTimeout(timeout.current);
        commitRoute(destination, params);
      };
      pending.current = { hash: targetHash, commit };
      setJourney({ from: editorialPageLabel(settings.path), title: destination === '/' ? 'The Passage' : editorialPageLabel(destination), path: destination, room: plan.room, crossRoom: plan.crossRoom, label: carried.label, image: carried.image, identity: carried.identity });
      setSpatialTravelling(plan.room);
      document.documentElement.dataset.spatialPassage = 'departing';
      const main = document.getElementById('main');
      if (main) main.inert = true;
      const stage = document.querySelector('.route-stage');
      motion.current = gsap.context(() => {
        gsap.to(stage, { opacity: 0, duration: .24, ease: 'power2.in' });
        if (passage.current) {
          gsap.fromTo(passage.current, { opacity: 0 }, { opacity: 1, duration: .18 });
          gsap.fromTo(passage.current.querySelector('.spatial-passage-frames'), { z: -120, opacity: 0 }, { z: 720, opacity: 1, duration: plan.duration / 1000, ease: 'power2.in' });
          gsap.fromTo(passage.current.querySelector('.spatial-passage-progress i'), { scaleX: 0 }, { scaleX: 1, duration: plan.duration / 1000, ease: 'none' });
        }
      }, passage);
      playSound(plan.crossRoom ? 'portal' : 'navigate', { intensity: .84 });
      if (plan.crossRoom && controller.current && getSpatialState().ready) {
        controller.current.travelTo(plan.room, commit, plan.duration);
        timeout.current = window.setTimeout(commit, plan.duration + 450);
      } else timeout.current = window.setTimeout(commit, Math.min(plan.duration, 320));
      return true;
    };
    const intent = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string; params?: Record<string, string | undefined> }>).detail;
      if (typeof detail?.path === 'string' && detail.path.startsWith('/') && navigate(detail.path, detail.params)) event.preventDefault();
    };
    const portal = (event: Event) => {
      const target = spatialPortals.find(item => item.id === (event as CustomEvent).detail);
      if (target && navigate(target.route)) event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.download || (link.target && link.target !== '_self') || link.origin !== location.origin || link.pathname !== location.pathname || link.search !== location.search || !link.hash.startsWith('#/')) return;
      const [destination, query = ''] = link.hash.slice(1).split('?');
      if (navigate(destination, Object.fromEntries(new URLSearchParams(query)))) event.preventDefault();
    };
    const hash = () => { if (pending.current && pending.current.hash !== location.hash) cancel(); };
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape' && pending.current) cancel(); };
    const visibility = () => { if (document.hidden) pending.current?.commit(); };
    window.addEventListener('monumental:navigate', intent);
    window.addEventListener('monumental:spatial-travel', portal);
    window.addEventListener('hashchange', hash);
    window.addEventListener('keydown', keyboard);
    document.addEventListener('click', click);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancel(); window.removeEventListener('monumental:navigate', intent);
      window.removeEventListener('monumental:spatial-travel', portal);
      window.removeEventListener('hashchange', hash); window.removeEventListener('keydown', keyboard);
      document.removeEventListener('click', click); document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useLayoutEffect(() => {
    if (previousPath.current === path) return;
    previousPath.current = path;
    revision.current++; clearMotion(); pending.current = null; setSpatialTravelling(null);
    const stage = document.querySelector<HTMLElement>('.route-stage');
    if (!stage || reducedMotion || document.querySelector('.story-transition-cover')) { finish(); return; }
    document.documentElement.dataset.spatialPassage = 'arriving';
    const arrive = () => {
      observer.current?.disconnect(); observer.current = null; window.clearTimeout(timeout.current);
      motion.current?.revert();
      motion.current = gsap.context(() => {
        const tl = gsap.timeline({ onComplete: finish });
        tl.fromTo(stage, { opacity: .15 }, { opacity: 1, duration: .38, ease: 'power3.out', clearProps: 'opacity,transform' }, 0);
        if (passage.current) {
          tl.to(passage.current.querySelector('.spatial-passage-frames'), { z: 1150, duration: .38, ease: 'power2.out' }, 0);
          tl.to(passage.current, { opacity: 0, duration: .32 }, .04);
        }
      }, passage);
    };
    // Lazy page code gets a real readiness check, not a second timed animation.
    motion.current = gsap.context(() => gsap.set(stage, { opacity: 0 }), passage);
    arrivalFrame.current = requestAnimationFrame(() => {
      if (!stage.querySelector('.page-loading')) { arrive(); return; }
      observer.current = new MutationObserver(() => { if (!stage.querySelector('.page-loading')) arrive(); });
      observer.current.observe(stage, { childList: true, subtree: true });
      timeout.current = window.setTimeout(arrive, 1800);
    });
  }, [path, reducedMotion]);
  useEffect(() => { if (paused || reducedMotion) cancelRef.current(); }, [paused, reducedMotion]);
  useEffect(() => { if (spatial.unavailable) pending.current?.commit(); }, [spatial.unavailable]);

  return <>
    <div className="spatial-passage" ref={passage} data-active={!!journey} data-cross-room={journey?.crossRoom} data-carried-identity={journey?.identity || undefined} aria-hidden={!journey}>
      <div className="spatial-passage-frames" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <div className="spatial-passage-caption">{journey?.image && <img className="spatial-passage-carried" src={assetUrl(journey.image)} alt=""/>}<span className="spatial-passage-origin">{journey?.from}<ArrowRight size={15}/></span><strong role="status">{journey?.label || journey?.title}</strong>{journey?.label && <span className="spatial-passage-destination">{journey.title}</span>}<div className="spatial-passage-progress" aria-hidden="true"><i/></div><button onClick={() => pending.current?.commit()} tabIndex={journey ? 0 : -1}>Enter now <ArrowRight size={16}/></button></div>
    </div>
  </>;
}
