import { useEffect, useRef, useState } from 'react';
import type { FlightController } from './flightScene';
import './flight-environment.css';

/** Autonomous decorative companions; no extra controls or modal interrupt the journey. */
export default function FlightEnvironment({ path, reducedMotion, paused }: { path: string; reducedMotion: boolean; paused: boolean }) {
  const host = useRef<HTMLDivElement>(null), controller = useRef<FlightController | null>(null);
  const [available, setAvailable] = useState(true);
  const latest = useRef({ path, reducedMotion, paused });
  latest.current = { path, reducedMotion, paused };

  useEffect(() => {
    let disposed = false;
    const sync = () => {
      const values = latest.current;
      let obscured = !!document.querySelector('dialog[open]');
      try { obscured ||= !!document.querySelector('[popover]:popover-open'); } catch { /* Popovers are optional in older browsers. */ }
      const hidden = values.paused || obscured;
      host.current?.setAttribute('data-obscured', String(hidden));
      controller.current?.setState({ home: values.path === '/', reducedMotion: values.reducedMotion, paused: hidden,
        inspecting: false, docked: false, formation: 'escort', selected: 'vela' });
    };
    import('./flightScene').then(({ createFlightScene }) => {
      if (disposed || !host.current) return;
      controller.current = createFlightScene(host.current, () => { if (!disposed) setAvailable(false); });
      sync();
    }).catch(() => { if (!disposed) setAvailable(false); });
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['open'] });
    document.addEventListener('toggle', sync, true);
    document.addEventListener('close', sync, true);
    window.addEventListener('monumental:flight-sync', sync);
    return () => {
      disposed = true; observer.disconnect(); document.removeEventListener('toggle', sync, true);
      document.removeEventListener('close', sync, true); window.removeEventListener('monumental:flight-sync', sync);
      controller.current?.destroy(); controller.current = null;
    };
  }, []);

  useEffect(() => { window.dispatchEvent(new Event('monumental:flight-sync')); }, [path, reducedMotion, paused]);
  return <div ref={host} className="flight-environment" data-route={path} data-drone-count="4" data-available={available} aria-hidden="true"/>;
}
