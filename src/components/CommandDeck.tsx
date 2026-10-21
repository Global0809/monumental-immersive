import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDown } from '@phosphor-icons/react/dist/csr/ArrowDown';
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ClockCounterClockwise } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise';
import { Compass } from '@phosphor-icons/react/dist/csr/Compass';
import { FilmSlate } from '@phosphor-icons/react/dist/csr/FilmSlate';
import { GlobeHemisphereWest } from '@phosphor-icons/react/dist/csr/GlobeHemisphereWest';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { SlidersHorizontal } from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { places, videos } from '../data/catalogue';
import { filterVideos } from '../services/discovery';
import { go } from '../services/router';
import { playSound } from '../services/audio';
import { useViewer } from '../services/viewer';
import './command-deck.css';

export function openCommandDeck() { window.dispatchEvent(new Event('monumental:command-open')); }
type Entry = { id: string; title: string; detail: string; image?: string; kind: 'story' | 'place' | 'page'; action: () => void };

export default function CommandDeck({ navigation }: { navigation: { name: string; path: string }[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const viewer = useViewer();
  const id = useId();
  const entries = useMemo<Entry[]>(() => {
    const routeEntry = (title: string, detail: string, path: string): Entry => ({ id: path, title, detail, kind: 'page', action: () => go(path) });
    if (!query.trim()) {
      const recent = Object.entries(viewer.history).sort((a,b) => b[1].updatedAt - a[1].updatedAt).map(([id]) => videos.find(v => v.id === id)).find(Boolean);
      return [
        ...(recent ? [{ id: recent.id, title: recent.title, detail: 'Return to your latest story', image: recent.poster, kind: 'story' as const, action: () => go('/film/' + recent.id) }] : []),
        routeEntry('Turn the world', 'Explore six cultural destinations', '/world'),
        routeEntry('Travel through time', 'Follow a moment into a story', '/time-machine'),
        routeEntry('Make a journey', 'Choose your mood and available time', '/journey'),
        routeEntry('Your saved world', `${viewer.saved.length} stories in your collection`, '/my-world'),
        routeEntry('Tune the experience', 'Sound studio, motion and preferences', '/settings'),
      ];
    }
    const terms = query.toLocaleLowerCase().trim().split(/\s+/);
    const films: Entry[] = filterVideos({ q: query }).slice(0, 5).map(v => ({ id: v.id, title: v.title, detail: `${v.category} · ${v.status === 'development' ? 'In development' : 'Watch free'}`, image: v.poster, kind: 'story', action: () => go('/film/' + v.id) }));
    const destinations: Entry[] = places.filter(p => terms.every(t => `${p.name} ${p.country} ${p.tagline}`.toLowerCase().includes(t))).slice(0,3).map(p => ({ id: p.id, title: p.name, detail: 'Explore destination', image: p.image, kind: 'place', action: () => go('/world', { place: p.id }) }));
    const pages: Entry[] = navigation.filter(n => terms.every(t => n.name.toLowerCase().includes(t))).slice(0,3).map(n => routeEntry(n.name, 'Open collection', n.path));
    return [...destinations, ...films, ...pages].slice(0, 8);
  }, [query, viewer.history, viewer.saved.length, navigation]);

  function close() { dialog.current?.close(); setOpen(false); }
  function choose(entry: Entry) { close(); playSound(entry.kind === 'place' ? 'destination' : 'navigate'); entry.action(); }

  useEffect(() => {
    function show() {
      if (document.querySelector('dialog[open]') || !dialog.current) return;
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery(''); setActive(0); setOpen(true); dialog.current.showModal(); input.current?.focus(); playSound('open');
    }
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.isComposing || target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey)) { event.preventDefault(); show(); }
    };
    window.addEventListener('monumental:command-open', show);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('monumental:command-open', show); window.removeEventListener('keydown', key); };
  }, []);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, id, open]);

  return <dialog ref={dialog} className="command-deck" data-sound-owned aria-labelledby={`${id}-title`} onClose={() => { setOpen(false); returnFocus.current?.focus(); }} onCancel={() => { setOpen(false); playSound('close'); }} onClick={e => { if (e.target === dialog.current) close(); }}>
    <div className="command-heading"><span id={`${id}-title`}>FIND YOUR NEXT CONNECTION</span><button aria-label="Close quick search" onClick={() => { close(); playSound('close'); }}><X size={20}/></button></div>
    <div className="command-input"><MagnifyingGlass size={25}/><input ref={input} value={query} placeholder="A place. A film. A different direction." aria-label="Search everything" role="combobox" aria-expanded={open} aria-controls={`${id}-results`} aria-activedescendant={entries[active] ? `${id}-${active}` : undefined} autoComplete="off" onChange={e => setQuery(e.target.value)} onKeyDown={e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setActive(i => entries.length ? (i + (e.key === 'ArrowDown' ? 1 : entries.length - 1)) % entries.length : 0); playSound('tick', { intensity: .45 }); }
      if (e.key === 'Enter') { e.preventDefault(); if (entries[active]) choose(entries[active]); else { close(); go('/search', { q: query }); } }
    }}/>{query && <button aria-label="Clear quick search" onClick={() => { setQuery(''); input.current?.focus(); }}><X size={18}/></button>}</div>
    <div className="command-results-label">{query ? `${entries.length} connections` : 'Start somewhere unexpected'}</div>
    <ul id={`${id}-results`} role="listbox" aria-label="Connections" className="command-results">
      {entries.map((entry,i) => <li key={entry.id} id={`${id}-${i}`} role="option" aria-selected={active === i} onPointerMove={() => setActive(i)}><button tabIndex={-1} onClick={() => choose(entry)}>{entry.image ? <img src={entry.image} alt=""/> : <span className="command-symbol">{entry.id === '/world' ? <GlobeHemisphereWest/> : entry.id === '/time-machine' ? <ClockCounterClockwise/> : entry.id === '/settings' ? <SlidersHorizontal/> : <Compass/>}</span>}<span><strong>{entry.title}</strong><small>{entry.detail}</small></span>{entry.kind === 'story' ? <FilmSlate size={18}/> : <ArrowUpRight size={20}/>}</button></li>)}
    </ul>
    {entries.length === 0 && <div className="command-empty"><p>No connection yet.</p><span>Try “Miami”, “music”, “London” or “film”.</span></div>}
    <div className="command-bottom"><span><kbd><ArrowUp size={10}/><ArrowDown size={10}/></kbd> Move <kbd>↵</kbd> Open <kbd>ESC</kbd> Close</span><button onClick={() => { close(); go('/search', { q: query }); playSound('navigate'); }}>Full catalogue <ArrowRight size={15}/></button></div>
  </dialog>;
}
