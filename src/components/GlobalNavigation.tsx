import { useEffect, useRef } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { List } from '@phosphor-icons/react/dist/csr/List';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { SpeakerHigh } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import { SpeakerSlash } from '@phosphor-icons/react/dist/csr/SpeakerSlash';
import { SlidersHorizontal } from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { href } from '../services/router';
import { setSoundEnabled } from '../services/audio';
import { videos } from '../data/catalogue';
import { openCommandDeck } from './CommandDeck';
import './editorial-foundation.css';

const primary = [
  { name: 'World', path: '/world' },
  { name: 'Time Machine', path: '/time-machine' },
  { name: 'Watch', path: '/search' },
  { name: 'Journeys', path: '/journey' },
  { name: 'My World', path: '/my-world' },
];

const groups = [
  { name: 'Explore', description: 'Follow a place, a period, a possibility.', entries: [
    { name: 'The Passage', path: '/' },
    { name: 'World', path: '/world' },
    { name: 'Time Machine', path: '/time-machine' },
    { name: 'Journeys', path: '/journey' },
    { name: 'Motion laboratory', path: '/motion', secondary: true },
  ] },
  { name: 'Watch', description: 'Find a film. See where it takes you.', entries: [
    { name: 'All stories', path: '/search' },
    { name: 'Cinema', path: '/category/movies' },
    { name: 'Music', path: '/category/music' },
    { name: 'Culture', path: '/category/culture' },
    { name: 'Sports', path: '/category/sports', secondary: true },
    { name: 'Gaming', path: '/category/gaming', secondary: true },
    { name: 'News', path: '/category/news', secondary: true },
    { name: 'Fashion', path: '/category/fashion', secondary: true },
    { name: 'Kids', path: '/category/kids', secondary: true },
    { name: 'Live', path: '/live', secondary: true },
  ] },
  { name: 'Your space', description: 'Keep what moves you. Make it your own.', entries: [
    { name: 'My World', path: '/my-world' },
    { name: 'Settings', path: '/settings' },
    { name: 'Monumental+', path: '/premium' },
    { name: 'Credits & content notes', path: '/credits', secondary: true },
  ] },
];

export const directoryNavigation = groups.flatMap(group => group.entries.map(({ name, path }) => ({ name, path })));

/** The destination label describes the actual route, not its backing 3D room. */
export function editorialPageLabel(path: string) {
  if (path.startsWith('/film/')) return videos.find(video => video.id === path.split('/')[2])?.title || 'Story';
  if (path === '/search') return 'Search & discovery';
  return directoryNavigation.find(item => item.path === path)?.name || 'Monumental';
}

function isPrimaryActive(itemPath: string, path: string) {
  return itemPath === '/search'
    ? path === '/search' || path.startsWith('/category/') || path.startsWith('/film/') || path === '/live'
    : itemPath === path;
}

export default function GlobalNavigation({ path, sound, soundUnavailable }: {
  path: string; sound: boolean; soundUnavailable: boolean;
}) {
  const menu = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const lastPath = useRef(path);

  useEffect(() => {
    if (lastPath.current !== path) menu.current?.close();
    lastPath.current = path;
  }, [path]);

  function close() { menu.current?.close(); }
  function openSoundStudio() {
    close();
    // Let the native modal release its top-layer focus before the popover opens.
    requestAnimationFrame(() => {
      const studio = document.getElementById('sound-console');
      studio?.showPopover?.();
      studio?.focus({ preventScroll: true });
    });
  }

  return <>
    <header className="site-header editorial-header">
      <a href={href('/')} className="wordmark" aria-label="Monumental — The Passage" aria-current={path === '/' ? 'page' : undefined}>MONUMENTAL<span>®</span><small>STREAMS</small></a>
      <nav className="primary-navigation" aria-label="Primary navigation">
        {primary.map(item => <a key={item.path} href={href(item.path)} aria-current={isPrimaryActive(item.path, path) ? (item.path === path ? 'page' : 'location') : undefined}>{item.name}<i aria-hidden="true"/></a>)}
      </nav>
      <div className="header-actions">
        <a className="icon-button quick-search-trigger" href={href('/search')} aria-label="Search stories and places" data-sound-owned onClick={event => {
          if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault(); openCommandDeck();
        }}><MagnifyingGlass size={21}/></a>
        <button data-sound-owned className="icon-button sound-button" aria-label={soundUnavailable ? 'Sound unavailable in this browser' : sound ? 'Turn sound off' : 'Turn sound on'} title={soundUnavailable ? 'This browser cannot play interface sound' : sound ? 'Sound on' : 'Sound off'} disabled={soundUnavailable} aria-pressed={sound && !soundUnavailable} onClick={() => setSoundEnabled(!sound)}>{sound && !soundUnavailable ? <SpeakerHigh size={20}/> : <SpeakerSlash size={20}/>}</button>
        <button className="menu-button" ref={trigger} onClick={() => menu.current?.showModal()} aria-label="Open Index" aria-haspopup="dialog" aria-controls="monumental-index"><span>Index</span><List size={22}/></button>
      </div>
    </header>
    <dialog id="monumental-index" ref={menu} className="index-dialog cultural-directory" aria-labelledby="index-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} onClose={() => {
      if (!document.querySelector('dialog:modal')) trigger.current?.focus({ preventScroll: true });
    }}>
      <div className="index-header"><h2 id="index-title">Find your way.</h2><button className="directory-close" onClick={close} aria-label="Close Index"><span>Close</span><X size={23}/></button></div>
      <div className="directory-groups">
        {groups.map(group => <nav className="directory-group" key={group.name} aria-label={group.name}>
          <h3>{group.name}</h3><p>{group.description}</p>
          <div className="directory-primary">{group.entries.filter(item => !item.secondary).map(item => <a key={item.path} href={href(item.path)} onClick={close} aria-current={path === item.path ? 'page' : undefined}>{item.name}<ArrowUpRight size={24}/></a>)}</div>
          <div className="directory-secondary">{group.entries.filter(item => item.secondary).map(item => <a key={item.path} href={href(item.path)} onClick={close} aria-current={path === item.path ? 'page' : undefined}>{item.name}<ArrowUpRight size={17}/></a>)}</div>
        </nav>)}
      </div>
      <div className="directory-footer"><span>You’re in <strong>{editorialPageLabel(path)}</strong></span><button className="text-link" onClick={openSoundStudio}><SlidersHorizontal size={18}/>Sound Studio</button><p>Culture has a through line.</p></div>
    </dialog>
  </>;
}
