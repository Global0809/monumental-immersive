import { useEffect, useRef, useState } from 'react';
import { go } from '../../services/router';
import { playSound } from '../../services/audio';
import {
  enterSpatialWorld, getSpatialState,
  setSpatialReady, setSpatialUnavailable, spatialPortals, spatialRoomForPath, useSpatial,
} from '../../services/spatial';
import type { SpatialSceneController } from './scene';
import SpatialNavigator from './SpatialNavigator';
import './spatial-world.css';
import './spatial-rooms.css';

/** One persistent architectural world; the actual player and accessible DOM stay intact. */
export default function SpatialExperience({ path, reducedMotion, paused }: {
  path: string; reducedMotion: boolean; paused: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const controller = useRef<SpatialSceneController | null>(null);
  // A direct link to a film or destination must not pay for the entire Passage.
  // Once entered, keep one scene alive for return visits and camera handoffs.
  const [sceneRequested, setSceneRequested] = useState(path === '/');
  const spatial = useSpatial();
  const room = spatialRoomForPath(path);
  const latest = useRef({ entered: spatial.entered || path !== '/', room, reducedMotion, paused });
  latest.current = { entered: spatial.entered || path !== '/', room, reducedMotion, paused };
  useEffect(() => { if (path === '/') setSceneRequested(true); }, [path]);

  useEffect(() => {
    if (!sceneRequested) return;
    let disposed = false;
    let frame = 0;
    let pageHeight = 1;
    const travel = (id: string) => {
      const portal = spatialPortals.find(item => item.id === id);
      if (portal && !disposed && !latest.current.paused) go(portal.route);
    };
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
    import('./tunnelScene').then(({ createTunnelScene }) => {
      if (disposed || !host.current) return;
      controller.current = createTunnelScene(host.current, {
        portals: spatialPortals, reducedMotion: latest.current.reducedMotion,
        onReady: () => { if (!disposed) setSpatialReady(); },
        onUnavailable: () => { if (!disposed) { setSpatialUnavailable(); } },
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
      disposed = true; cancelAnimationFrame(frame); resize.disconnect();
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', measure);
      window.removeEventListener('monumental:spatial-rotate', rotate);
      controller.current?.destroy(); controller.current = null;
    };
  }, [sceneRequested]);

  useEffect(() => { if (path !== '/') enterSpatialWorld(); controller.current?.setState(latest.current); }, [path, reducedMotion, paused, spatial.entered]);
  useEffect(() => { controller.current?.setFocus(spatial.focus); }, [spatial.focus]);

  return <>
    <div className={`spatial-world ${spatial.unavailable ? 'spatial-world--fallback' : ''}`} data-entered={spatial.entered || path !== '/'} data-home={path === '/'} data-travelling={!!spatial.travelling}>
      <div className="spatial-world-canvas" ref={host}/>
      <div className="spatial-world-vignette" aria-hidden="true"/>
      <div className="spatial-world-labels" ref={labels} aria-hidden="true">{spatialPortals.map((portal, index) => <div key={portal.id} data-portal-label={portal.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{portal.title}</strong><i>↗</i></div>)}</div>
    </div>
    <SpatialNavigator path={path} reducedMotion={reducedMotion} paused={paused} controller={controller}/>
  </>;
}
