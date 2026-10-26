import { useEffect, useRef } from 'react';
import { go, href } from '../../services/router';
import { playSound } from '../../services/audio';
import {
  enterSpatialWorld, getSpatialState, resetSpatialEntrance,
  setSpatialReady, setSpatialUnavailable, setSpatialTravelling, spatialPortals, spatialRoomForPath, spatialPageLabel, useSpatial,
} from '../../services/spatial';
import type { SpatialSceneController } from './scene';
import './spatial-world.css';
import './spatial-rooms.css';

/** One persistent architectural world; the actual player and accessible DOM stay intact. */
export default function SpatialExperience({ path, reducedMotion, paused }: {
  path: string; reducedMotion: boolean; paused: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const controller = useRef<SpatialSceneController | null>(null);
  const cancelFlight = useRef<() => void>(() => {});
  const skipFlight = useRef<() => void>(() => {});
  const spatial = useSpatial();
  const room = spatialRoomForPath(path);
  const latest = useRef({ entered: spatial.entered || path !== '/', room, reducedMotion, paused });
  latest.current = { entered: spatial.entered || path !== '/', room, reducedMotion, paused };

  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let pageHeight = 1;
    let flightTimer = 0;
    let flightRevision = 0;
    const cancel = () => {
      flightRevision++;
      window.clearTimeout(flightTimer);
      controller.current?.cancelTravel();
      setSpatialTravelling(null);
      skipFlight.current = () => {};
    };
    cancelFlight.current = cancel;
    const travel = (id: string) => {
      const portal = spatialPortals.find(item => item.id === id);
      if (!portal || disposed || latest.current.paused) return;
      cancel();
      enterSpatialWorld();
      playSound('destination');
      const revision = flightRevision;
      const finish = () => {
        if (disposed || revision !== flightRevision) return;
        flightRevision++;
        window.clearTimeout(flightTimer);
        setSpatialTravelling(null);
        skipFlight.current = () => {};
        go(portal.route);
      };
      if (!controller.current || !getSpatialState().ready || latest.current.reducedMotion || latest.current.room !== 'atrium') { finish(); return; }
      setSpatialTravelling(id);
      skipFlight.current = finish;
      // A backgrounded tab must never strand navigation waiting on RAF.
      flightTimer = window.setTimeout(finish, 2200);
      controller.current.travelTo(id, finish);
    };
    const requestTravel = (event: Event) => {
      const id = (event as CustomEvent<unknown>).detail;
      if (typeof id !== 'string' || !spatialPortals.some(portal => portal.id === id)) return;
      event.preventDefault(); travel(id);
    };
    const cancelWithEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    const updateScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => controller.current?.setScroll(Math.min(1, Math.max(0, window.scrollY / pageHeight))));
    };
    const measure = () => { pageHeight = Math.max(1, document.documentElement.scrollHeight - innerHeight); updateScroll(); };
    const rotate = (event: Event) => controller.current?.rotate((event as CustomEvent<number>).detail);
    const resize = new ResizeObserver(measure);
    if (document.getElementById('main')) resize.observe(document.getElementById('main')!);
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('monumental:spatial-rotate', rotate);
    window.addEventListener('monumental:spatial-travel', requestTravel);
    window.addEventListener('hashchange', cancel);
    window.addEventListener('keydown', cancelWithEscape);
    const labelElements = new Map([...labels.current?.querySelectorAll<HTMLElement>('[data-portal-label]') || []].map(element => [element.dataset.portalLabel!, element]));
    import('./scene').then(({ createSpatialScene }) => {
      if (disposed || !host.current) return;
      controller.current = createSpatialScene(host.current, {
        portals: spatialPortals, reducedMotion: latest.current.reducedMotion,
        onReady: () => { if (!disposed) setSpatialReady(); },
        onUnavailable: () => { if (!disposed) { setSpatialUnavailable(); skipFlight.current(); } },
        onSelect: travel,
        onProject: positions => {
          if (disposed) return;
          for (const position of positions) {
            const label = labelElements.get(position.id);
            if (!label) continue;
            label.style.transform = `translate3d(${position.x}px,${position.y}px,0)`;
            label.style.opacity = position.visible && latest.current.room === 'atrium' && latest.current.entered ? '1' : '0';
          }
        },
      });
      controller.current.setState(latest.current);
      controller.current.setFocus(getSpatialState().focus);
      measure();
    }).catch(() => { if (!disposed) setSpatialUnavailable(); });
    return () => {
      disposed = true; cancel(); cancelAnimationFrame(frame); resize.disconnect();
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', measure);
      window.removeEventListener('monumental:spatial-rotate', rotate);
      window.removeEventListener('monumental:spatial-travel', requestTravel);
      window.removeEventListener('hashchange', cancel);
      window.removeEventListener('keydown', cancelWithEscape);
      controller.current?.destroy(); controller.current = null;
    };
  }, []);

  useEffect(() => { if (path !== '/') enterSpatialWorld(); controller.current?.setState(latest.current); }, [path, reducedMotion, paused, spatial.entered]);
  useEffect(() => { if (paused) cancelFlight.current(); }, [paused]);
  useEffect(() => { controller.current?.setFocus(spatial.focus); }, [spatial.focus]);

  return <>
    <div className={`spatial-world ${spatial.unavailable ? 'spatial-world--fallback' : ''}`} data-entered={spatial.entered || path !== '/'} data-home={path === '/'} data-travelling={!!spatial.travelling} aria-hidden="true">
      <div className="spatial-world-canvas" ref={host}/>
      <div className="spatial-world-vignette"/>
      <div className="spatial-world-labels" ref={labels}>{spatialPortals.map((portal, index) => <div key={portal.id} data-portal-label={portal.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{portal.title}</strong><i>↗</i></div>)}</div>
    </div>
    {spatial.travelling && <div className="spatial-flight-note"><span role="status">Entering {spatialPortals.find(portal => portal.id === spatial.travelling)?.title}</span><button onClick={() => skipFlight.current()}>Skip transition ↗</button></div>}
    {path !== '/' ? <nav className="spatial-room-crumb" aria-label="Your position in Monumental"><a href={href('/')}>← The observatory</a><span aria-hidden="true">/</span><span>{spatialPageLabel(path)}</span></nav>
      : spatial.entered && <div className="spatial-home-utility"><button data-sound-owned onClick={() => { cancelFlight.current(); resetSpatialEntrance(); playSound('sculpture-unfold'); window.scrollTo({top:0,behavior:'instant'}); }}>Replay entrance</button></div>}
  </>;
}
