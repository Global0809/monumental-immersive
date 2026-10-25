import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { playSound } from '../services/audio';
import { go } from '../services/router';
import './keyboard-guide.css';

export function openKeyboardGuide() { window.dispatchEvent(new Event('monumental:guide-open')); }
export default function KeyboardGuide({ spatial = false }: { spatial?: boolean }) {
  const dialog=useRef<HTMLDialogElement>(null);
  const returnFocus=useRef<HTMLElement|null>(null);
  const mac=navigator.platform.toLowerCase().includes('mac');
  useEffect(()=>{
    const show=()=>{if(document.querySelector('dialog[open]') || !dialog.current)return;returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.current.showModal();playSound('open');};
    const key=(event:KeyboardEvent)=>{if(event.key!=='?' || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || (event.target as Element).closest('input,textarea,select,[contenteditable="true"]'))return;event.preventDefault();show();};
    window.addEventListener('monumental:guide-open',show);window.addEventListener('keydown',key);
    return()=>{window.removeEventListener('monumental:guide-open',show);window.removeEventListener('keydown',key);};
  },[]);
  const close=()=>{dialog.current?.close();playSound('close');};
  return <dialog ref={dialog} className="keyboard-guide" data-sound-owned aria-labelledby="keyboard-guide-title" onCancel={()=>playSound('close')} onClose={()=>{if(returnFocus.current?.isConnected)returnFocus.current.focus();}} onClick={event=>{if(event.target===dialog.current)close();}}>
    <div className="guide-heading"><span>MONUMENTAL / WAYS TO EXPLORE</span><button aria-label="Close interaction guide" onClick={close}><X size={22}/></button></div>
    <h2 id="keyboard-guide-title">MAKE YOUR<br/><span>OWN WAY.</span></h2><p>A few ways to move through the world.</p>
    <div className="guide-grid"><section><h3>EVERYWHERE</h3><dl><div><dt>Find a film, place or page</dt><dd><kbd>{mac?'⌘':'Ctrl'}</kbd><kbd>K</kbd><span>or</span><kbd>/</kbd></dd></div><div><dt>Move between controls</dt><dd><kbd>Tab</kbd></dd></div><div><dt>Close a panel</dt><dd><kbd>Esc</kbd></dd></div><div><dt>Open this guide</dt><dd><kbd>?</kbd></dd></div></dl></section>
    {spatial ? <section><h3>THE OBSERVATORY</h3><dl><div><dt>Look around the room</dt><dd>Drag or use Look left / right</dd></div><div><dt>Enter a room</dt><dd>Select its screen or doorway</dd></div><div><dt>Cancel room travel</dt><dd><kbd>Esc</kbd></dd></div></dl><p>Every room has a direct link. Skip a camera transition at any time.</p></section> : <section><h3>THE SCULPTURE</h3><dl><div><dt>Turn it</dt><dd>Drag or <kbd>←</kbd><kbd>→</kbd></dd></div><div><dt>Unfold its mechanism</dt><dd><kbd>Enter</kbd></dd></div><div><dt>Send a pulse</dt><dd><kbd>Space</kbd></dd></div></dl><p>Focus the sculpture first. Hold Resonate to build a stronger signal.</p></section>}
    <section><h3>WORLD &amp; TIME</h3><dl><div><dt>Turn the globe</dt><dd>Drag or <kbd>←</kbd><kbd>→</kbd></dd></div><div><dt>Choose a destination</dt><dd>Select a signal</dd></div><div><dt>Move through eras</dt><dd>Drag the timeline</dd></div><div><dt>Fine-tune the time dial</dt><dd><kbd>←</kbd><kbd>→</kbd></dd></div></dl><p>Every destination and era also has a button you can reach with Tab.</p></section>
    <section><h3>WHILE WATCHING</h3><dl><div><dt>Play or pause</dt><dd><kbd>K</kbd></dd></div><div><dt>Back / forward ten seconds</dt><dd><kbd>J</kbd><kbd>L</kbd></dd></div><div><dt>Back / forward five seconds</dt><dd><kbd>←</kbd><kbd>→</kbd></dd></div></dl><p>Native video controls keep their own shortcuts. Use “Keep this moment” for a timestamp and a note. Select a transcript passage to jump to it.</p></section></div>
    <div className="guide-footer"><p>Sound and motion are yours to tune.</p><button onClick={()=>{dialog.current?.close();go('/settings');playSound('navigate');}}>Experience settings <ArrowUpRight size={17}/></button></div>
  </dialog>;
}
