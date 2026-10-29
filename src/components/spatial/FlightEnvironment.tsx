import { useEffect, useRef, useState } from 'react';
import type { FlightController, FlightFormation } from './flightScene';
import './flight-environment.css';

const crew = [
  { id: 'vela', name: 'Vela', role: 'Mother / pathfinder', copy: 'The first to investigate. Vela turns toward your movement and gently guides the family into formation.' },
  { id: 'atlas', name: 'Atlas', role: 'Father / guardian', copy: 'The steady presence. Atlas banks into each turn and keeps the two smaller explorers within reach.' },
  { id: 'pip', name: 'Pip', role: 'Young explorer', copy: 'Always a little ahead. Pip follows Vela, then breaks away for a small, curious orbit.' },
  { id: 'echo', name: 'Echo', role: 'Young explorer', copy: 'Never far behind. Echo answers Pip’s movement with a delayed turn of its own.' },
];

/** One persistent, decorative canvas; the same canvas moves into the crew viewer. */
export default function FlightEnvironment({ path, reducedMotion, paused, onInspectionChange }: { path: string; reducedMotion: boolean; paused: boolean; onInspectionChange: (open: boolean) => void }) {
  const host = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<FlightController | null>(null), trigger = useRef<HTMLButtonElement>(null);
  const [available, setAvailable] = useState(true), [open, setOpen] = useState(false), [docked, setDocked] = useState(() => {
    try { return localStorage.getItem('monumental.flight.docked') === 'true'; } catch { return false; }
  });
  const [formation, setFormation] = useState<FlightFormation>('escort');
  const [selected, setSelected] = useState('vela');
  const latest = useRef({ path, reducedMotion, paused, open, docked, formation, selected });
  latest.current = { path, reducedMotion, paused, open, docked, formation, selected };

  useEffect(() => {
    let disposed = false;
    const sync = () => {
      const values = latest.current;
      const otherModal = [...document.querySelectorAll('dialog:modal')].some(node => node !== dialog.current);
      const obscured = otherModal || !!document.querySelector('[popover]:popover-open');
      const hidden = values.paused || obscured;
      host.current?.setAttribute('data-obscured', String(hidden));
      controller.current?.setState({ home: values.path === '/', reducedMotion: values.reducedMotion, paused: hidden,
        inspecting: values.open, docked: values.docked, formation: values.formation, selected: values.selected });
    };
    import('./flightScene').then(({ createFlightScene }) => {
      if (disposed || !host.current) return;
      controller.current = createFlightScene(host.current, () => { if (!disposed) setAvailable(false); });
      sync();
    }).catch(() => { if (!disposed) setAvailable(false); });
    // Only modal state changes matter; typography transforms must not retrigger this.
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

  useEffect(() => {
    controller.current?.mount(open && stage.current ? stage.current : host.current!);
    window.dispatchEvent(new Event('monumental:flight-sync'));
  }, [path, reducedMotion, paused, open, docked, formation, selected]);
  useEffect(() => { if (dialog.current?.open) dialog.current.close(); }, [path]);
  useEffect(() => { onInspectionChange(open); return () => onInspectionChange(false); }, [open, onInspectionChange]);
  const meet = () => { if (dialog.current && !dialog.current.open) { setOpen(true); dialog.current.showModal(); } };
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  const toggleDock = () => {
    const value = !docked; setDocked(value);
    try { localStorage.setItem('monumental.flight.docked', String(value)); } catch { /* Session choice remains available. */ }
  };
  const active = crew.find(member => member.id === selected)!;

  return <>
    <div ref={host} className="flight-environment" data-route={path} data-drone-count="4" data-available={available} aria-hidden="true"/>
    {available && <button ref={trigger} className="flight-invitation" data-sound="open" onClick={meet} aria-haspopup="dialog" hidden={paused}>
      <svg viewBox="0 0 32 22" aria-hidden="true"><ellipse cx="7" cy="11" rx="5" ry="3"/><ellipse cx="25" cy="11" rx="5" ry="3"/><path d="M10 10 13 5h6l3 5v5l-6 3-6-3z"/><circle cx="16" cy="12" r="1.5"/></svg>
      <span>Flight crew <small>04</small></span>
    </button>}
    <dialog ref={dialog} className="flight-dialog" aria-labelledby="flight-title" onClose={close}>
      <header className="flight-heading"><div><span className="eyebrow">MONUMENTAL / FLIGHT COMPANIONS</span><h2 id="flight-title">A little life.<br/><em>In every orbit.</em></h2></div><button autoFocus onClick={() => dialog.current?.close()} aria-label="Close flight crew">Close <span aria-hidden="true">×</span></button></header>
      <div className="flight-view" ref={stage} aria-label="Interactive view of the four drone companions">
        <span className="flight-view-caption">{reducedMotion ? 'STILL PORTRAIT / REDUCED MOTION' : 'MOVE NEAR THEM. THEY NOTICE.'}</span>
      </div>
      <div className="flight-crew-list" role="group" aria-label="Meet the four companions">{crew.map(member => <button key={member.id} data-sound="signal" aria-pressed={selected === member.id} onClick={() => setSelected(member.id)}><strong>{member.name}</strong><span>{member.role}</span></button>)}</div>
      <div className="flight-detail"><p aria-live="polite"><strong>{active.name}. </strong>{active.copy}</p><div className="flight-commands"><div role="group" aria-label="Flight formation">{(['escort','orbit'] as const).map(mode => <button key={mode} aria-pressed={formation === mode} onClick={() => setFormation(mode)}>{mode === 'escort' ? 'Fly together' : 'Play in orbit'}</button>)}</div><button className="flight-dock" aria-pressed={docked} onClick={toggleDock}>{docked ? 'Resume flight' : 'Pause flight'}</button></div></div>
    </dialog>
  </>;
}
