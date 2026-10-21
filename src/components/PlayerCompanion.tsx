import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { BookmarkSimple } from '@phosphor-icons/react/dist/csr/BookmarkSimple';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { NotePencil } from '@phosphor-icons/react/dist/csr/NotePencil';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Quotes } from '@phosphor-icons/react/dist/csr/Quotes';
import { X } from '@phosphor-icons/react/dist/csr/X';
import type { Video } from '../data/catalogue';
import { removeMoment, restoreMoment, saveMoment, usePersistentStorage, useViewer, type SavedMoment } from '../services/viewer';
import { clampMomentTime, momentTime, parseTranscript, type TranscriptCue } from '../services/transcript';
import './player-companion.css';

export default function PlayerCompanion({ video, position, duration, onSeek, reducedMotion }: { video: Video; position: number; duration: number; onSeek: (seconds: number) => void; reducedMotion: boolean }) {
  const viewer = useViewer();
  const persistentStorage=usePersistentStorage();
  const [tab,setTab] = useState<'transcript'|'moments'>(video.captions ? 'transcript' : 'moments');
  const [expanded,setExpanded] = useState(false);
  const [cues,setCues] = useState<TranscriptCue[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState(false);
  const [query,setQuery] = useState('');
  const [follow,setFollow] = useState(false);
  const [capture,setCapture] = useState<number | null>(null);
  const [note,setNote] = useState('');
  const [status,setStatus] = useState('');
  const [removed,setRemoved] = useState<SavedMoment | null>(null);
  const [retry,setRetry] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const retryFocus = useRef(false);
  const id = useId();
  const moments = viewer.moments.filter(item => item.videoId === video.id).sort((a,b) => a.time-b.time);
  const active = cues.findIndex(cue => position >= cue.start && position < cue.end);
  const visible = cues.map((cue,index) => ({...cue,index})).filter(cue => cue.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  useEffect(() => {
    setCues([]); setLoading(false); setError(false); setQuery(''); setCapture(null); setStatus(''); setFollow(false); setRemoved(null);
    setTab(video.captions ? 'transcript' : 'moments');
  },[video.id,video.captions]);
  useEffect(() => {
    if (!expanded || !video.captions) return;
    const controller = new AbortController();
    setLoading(true); setError(false);
    fetch(video.captions,{signal:controller.signal}).then(response => { if(!response.ok) throw new Error('Unavailable'); return response.text(); }).then(source => {
      if(controller.signal.aborted) return;
      const parsed = parseTranscript(source); setCues(parsed); setError(parsed.length === 0); setLoading(false);
    }).catch(() => { if(!controller.signal.aborted){setError(true);setLoading(false);} });
    return () => controller.abort();
  },[video.id,video.captions,expanded,retry]);
  useEffect(() => { if(capture !== null && expanded && tab === 'moments') input.current?.focus(); },[capture,expanded,tab]);
  useEffect(() => { if(removed) undoButton.current?.focus(); },[removed]);
  useEffect(() => {
    if(retryFocus.current && !loading) { (error ? retryButton.current : searchInput.current)?.focus(); retryFocus.current=false; }
  },[loading,error]);
  useEffect(() => {
    if (!follow || query.trim() || !expanded || tab !== 'transcript' || active < 0) return;
    const container = list.current;
    const cue = container?.querySelector<HTMLElement>(`[data-cue="${active}"]`);
    if (!container || !cue) return;
    const top = cue.offsetTop-container.clientHeight/2+cue.offsetHeight/2;
    container.scrollTo({top,behavior:reducedMotion?'instant':'smooth'});
  },[active,follow,query,expanded,tab,reducedMotion]);

  function keep() {
    const time = clampMomentTime(position,duration);
    if (time === null) return;
    setCapture(time); setNote(moments.find(moment => moment.time === time)?.note || '');
    setStatus(''); setRemoved(null); setExpanded(true); setTab('moments'); input.current?.focus();
  }
  function closeCapture() { setCapture(null); keepButton.current?.focus(); }
  function saveCapture() {
    if(capture === null) return;
    const moment = saveMoment(video.id,capture,note);
    if(!moment) { setStatus('This moment could not be kept. Try again after the film loads.'); return; }
    closeCapture(); setStatus(`Moment kept at ${momentTime(moment.time)}. Find it here and in My World.`);
  }
  return <section className="player-companion" aria-label="Film companion">
    <div className="companion-heading"><button className="companion-expand" aria-expanded={expanded} aria-controls={`${id}-panel`} onClick={()=>setExpanded(value=>!value)}><Quotes size={20}/><span>STAY WITH THE STORY<small>{video.captions ? 'Read along. Keep a moment.' : 'Keep the moments that stay with you.'}</small></span><ArrowUpRight className={expanded?'is-open':''} size={20}/></button><button ref={keepButton} className="companion-keep" disabled={!Number.isFinite(duration) || duration <= 0} onClick={keep}><BookmarkSimple size={17}/><span>Keep this moment</span></button></div>
    {expanded && <div id={`${id}-panel`} className="companion-body">
      <div className="companion-tabs" role="tablist" aria-label="Film companion views" onKeyDown={event=>{if(!video.captions || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault(); const next = event.key==='Home'?'transcript':event.key==='End'?'moments':tab==='transcript'?'moments':'transcript';setTab(next); (event.currentTarget.querySelector(`[data-tab="${next}"]`) as HTMLButtonElement)?.focus();}}>
        {video.captions && <button id={`${id}-transcript-tab`} data-tab="transcript" role="tab" tabIndex={tab==='transcript'?0:-1} aria-selected={tab==='transcript'} aria-controls={`${id}-transcript`} onClick={()=>setTab('transcript')}>Transcript <Quotes size={15}/></button>}
        <button id={`${id}-moments-tab`} data-tab="moments" role="tab" tabIndex={tab==='moments'?0:-1} aria-selected={tab==='moments'} aria-controls={`${id}-moments`} onClick={()=>setTab('moments')}>My moments <span>{moments.length}</span></button>
      </div>
      {tab==='transcript' && <div id={`${id}-transcript`} role="tabpanel" aria-labelledby={`${id}-transcript-tab`}>
        {loading ? <p className="companion-empty" role="status">Opening the transcript…</p> : error ? <div className="companion-empty"><p role="status">The transcript is unavailable right now. You can continue watching.</p><button ref={retryButton} onClick={()=>{retryFocus.current=true;setRetry(value=>value+1);}}>Try transcript again</button></div> : <>
          <div className="transcript-tools"><label><MagnifyingGlass size={17}/><input ref={searchInput} aria-label="Search transcript" value={query} placeholder="Find a word in this story" onChange={event=>{setQuery(event.target.value);setFollow(false);}}/>{query && <button aria-label="Clear transcript search" onClick={()=>{setQuery('');searchInput.current?.focus();}}><X size={15}/></button>}</label><button aria-pressed={follow} disabled={!!query.trim()} onClick={()=>setFollow(value=>!value)}>{follow && <Check size={14}/>}Follow along</button></div>
          <div ref={list} className="transcript-cues" aria-label="Transcript passages" onFocusCapture={()=>setFollow(false)} onKeyDown={event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(event.key))setFollow(false);}} onWheel={()=>setFollow(false)} onTouchStart={()=>setFollow(false)}>{visible.map(cue=><button className={cue.index===active?'is-current':''} data-cue={cue.index} key={`${cue.start}-${cue.index}`} aria-label={`Jump to ${momentTime(cue.start)}: ${cue.text}`} aria-current={cue.index===active?'true':undefined} onClick={()=>onSeek(cue.start)}><time>{momentTime(cue.start)}</time><span>{cue.text}</span><Play size={13}/></button>)}{visible.length===0 && <p className="companion-empty">No passage matches “{query}”.</p>}</div><p className="transcript-match-count" role="status">{query.trim() ? `${visible.length} matching ${visible.length === 1 ? 'passage' : 'passages'}` : `${cues.length} passages`}</p><p className="companion-footnote">Select a passage to move to that moment. Transcript supplied with this film.</p>
        </>}
      </div>}
      {tab==='moments' && <div id={`${id}-moments`} role="tabpanel" aria-labelledby={`${id}-moments-tab`}>
        {capture !== null && <form className="moment-capture" onSubmit={event=>{event.preventDefault();saveCapture();}}><div><NotePencil size={20}/><span>A moment at <strong>{momentTime(capture)}</strong></span><button type="button" aria-label="Cancel moment note" onClick={closeCapture}><X size={18}/></button></div><label><span>Add a thought <small>Optional · {note.length}/180</small></span><input ref={input} aria-label="Moment note" placeholder="What stayed with you?" maxLength={180} value={note} onChange={event=>setNote(event.target.value)}/></label><button type="submit" className="ms-player-primary"><BookmarkSimple size={16}/>Keep moment</button></form>}
        {moments.length===0 && capture===null && <div className="companion-empty"><BookmarkSimple size={24}/><p>A line. A feeling. A moment worth returning to.</p><span>Keep a timestamp and an optional note while you watch.</span></div>}
        <div className="companion-moments">{moments.map(moment=><div key={moment.id}><button onClick={()=>onSeek(moment.time)} aria-label={`Jump to saved moment at ${momentTime(moment.time)}`}><time>{momentTime(moment.time)}</time><span>{moment.note || 'A moment worth keeping'}</span><Play size={14}/></button><button aria-label={`Remove moment at ${momentTime(moment.time)}`} onClick={()=>{removeMoment(moment.id);setRemoved(moment);setStatus('Moment removed from your collection.');}}><X size={17}/></button></div>)}</div>
        <p className="companion-footnote">{persistentStorage ? 'Your notes stay in this browser. They are private to this guest collection.' : 'Storage is unavailable. Notes last only for this visit; reloading clears them.'}</p>
      </div>}
      {status && <p className="companion-status" role="status"><Check size={15}/><span>{status}</span>{removed && <button ref={undoButton} onClick={()=>{const restored=restoreMoment(removed);setRemoved(null);setStatus(restored?'Moment restored.':'A newer note is already saved at this moment.');keepButton.current?.focus();}}>Undo</button>}</p>}
    </div>}
  </section>;
}
