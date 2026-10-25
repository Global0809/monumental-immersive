import { useEffect, useRef } from 'react';
import { go, href } from '../../services/router';
import { playSound } from '../../services/audio';
import {
  classicExperienceHref, enterSpatialWorld, getSpatialState, resetSpatialEntrance,
  setSpatialReady, setSpatialUnavailable, spatialPortals, spatialRoomForPath, spatialPageLabel, useSpatial,
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
  const spatial = useSpatial();
  const room = spatialRoomForPath(path);
  const latest = useRef({ entered: spatial.entered || path !== '/', room, reducedMotion, paused });
  latest.current = { entered: spatial.entered || path !== '/', room, reducedMotion, paused };

  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let pageHeight = 1;
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
    const labelElements = new Map([...labels.current?.querySelectorAll<HTMLElement>('[data-portal-label]') || []].map(element => [element.dataset.portalLabel!, element]));
    import('./scene').then(({ createSpatialScene }) => {
      if (disposed || !host.current) return;
      controller.current = createSpatialScene(host.current, {
        portals: spatialPortals, reducedMotion: latest.current.reducedMotion,
        onReady: () => { if (!disposed) setSpatialReady(); },
        onUnavailable: () => { if (!disposed) setSpatialUnavailable(); },
        onSelect: id => {
          const portal = spatialPortals.find(item => item.id === id);
          if (portal) { enterSpatialWorld(); playSound('destination'); go(portal.route); }
        },
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
      disposed = true; cancelAnimationFrame(frame); resize.disconnect();
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', measure);
      window.removeEventListener('monumental:spatial-rotate', rotate);
      controller.current?.destroy(); controller.current = null;
    };
  }, []);

  useEffect(() => { if (path !== '/') enterSpatialWorld(); controller.current?.setState(latest.current); }, [path, reducedMotion, paused, spatial.entered]);
  useEffect(() => { controller.current?.setFocus(spatial.focus); }, [spatial.focus]);

  return <>
    <div className={`spatial-world ${spatial.unavailable ? 'spatial-world--fallback' : ''}`} data-entered={spatial.entered || path !== '/'} data-home={path === '/'} aria-hidden="true">
      <div className="spatial-world-canvas" ref={host}/>
      <div className="spatial-world-vignette"/>
      <div className="spatial-world-labels" ref={labels}>{spatialPortals.map((portal, index) => <div key={portal.id} data-portal-label={portal.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{portal.title}</strong><i>↗</i></div>)}</div>
    </div>
    {path !== '/' ? <nav className="spatial-room-crumb" aria-label="Your position in Monumental"><a href={href('/')}>← The observatory</a><span aria-hidden="true">/</span><span>{spatialPageLabel(path)}</span><a className="spatial-classic-link" href={classicExperienceHref(location.search, location.hash)}>Original website ↗</a></nav>
      : <div className="spatial-home-utility">{spatial.entered && <button data-sound-owned onClick={() => { resetSpatialEntrance(); playSound('sculpture-unfold'); window.scrollTo({top:0,behavior:'instant'}); }}>Replay entrance</button>}<a href={classicExperienceHref(location.search, location.hash)}>Original website ↗</a></div>}
  </>;
}
