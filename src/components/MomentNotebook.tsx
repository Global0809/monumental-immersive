import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { NotePencil } from '@phosphor-icons/react/dist/csr/NotePencil';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Quotes } from '@phosphor-icons/react/dist/csr/Quotes';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { videos, type Video } from '../data/catalogue';
import { removeMoment, restoreMoment, saveMoment, useViewer, usePersistentStorage } from '../services/viewer';
import { momentTime } from '../services/transcript';
import { href } from '../services/router';
import { notify } from '../services/feedback';
import { playSound } from '../services/audio';
import './moment-notebook.css';

export default function MomentNotebook({ onWatch }: {onWatch:(video:Video,startAt?:number)=>void}) {
  const { moments } = useViewer();
  const persistentStorage=usePersistentStorage();
  const [editing,setEditing] = useState<string | null>(null);
  const [note,setNote] = useState('');
  const [expanded,setExpanded] = useState(false);
  const root = useRef<HTMLElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousEditing = useRef<string | null>(null);
  const deletionFocus = useRef<string | null>(null);
  const collection = [...moments].sort((a,b)=>b.createdAt-a.createdAt).flatMap(moment => { const video=videos.find(v=>v.id===moment.videoId); return video && video.status === 'available' && moment.time < video.duration ? [{moment,video}] : []; });
  const collectionKey = collection.map(({moment})=>moment.id).join('|');
  const focusEdit = (id: string) => {
    const button = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-edit-moment]') || []).find(element=>element.dataset.editMoment===id);
    (button || heading.current)?.focus();
  };
  useEffect(() => {
    if(editing) editor.current?.focus();
    else if(previousEditing.current) focusEdit(previousEditing.current);
    previousEditing.current=editing;
  },[editing]);
  useEffect(() => {
    if(editing && !collection.some(({moment})=>moment.id===editing)) setEditing(null);
    if(deletionFocus.current !== null) { focusEdit(deletionFocus.current); deletionFocus.current=null; }
  },[collectionKey]);
  function remove(id: string) {
    const index=collection.findIndex(({moment})=>moment.id===id);
    const item=collection[index]?.moment;
    if(!item) return;
    deletionFocus.current=collection[index+1]?.moment.id || collection[index-1]?.moment.id || '';
    removeMoment(id); playSound('close'); notify('Moment removed','Undo',()=>restoreMoment(item));
  }
  return <section ref={root} className="moment-notebook" aria-labelledby="notebook-title">
    <div className="notebook-heading"><span className="notebook-symbol"><Quotes weight="thin" size={38}/></span><div><small>YOUR PERSONAL FIELD NOTES</small><h2 ref={heading} tabIndex={-1} id="notebook-title">SOME MOMENTS<br/><span>STAY WITH YOU.</span></h2></div><span className="notebook-count"><strong>{String(collection.length).padStart(2,'0')}</strong>moments kept</span></div>
    {collection.length ? <><div className="notebook-grid">{(expanded?collection:collection.slice(0,6)).map(({moment,video})=><article className="notebook-entry" key={moment.id}>
      <button className="notebook-play" aria-label={`Watch ${video.title} from ${momentTime(moment.time)}`} onClick={()=>onWatch(video,moment.time)}><img src={video.poster} alt="" loading="lazy"/><span><Play weight="fill" size={14}/>{momentTime(moment.time)}</span></button>
      <div className="notebook-entry-body"><a className="notebook-film" href={href('/film/'+video.id,{t:String(moment.time)})}>{video.title}<ArrowUpRight size={15}/></a>
        {editing===moment.id ? <form className="notebook-editor" onSubmit={event=>{event.preventDefault();saveMoment(moment.videoId,moment.time,note);setEditing(null);playSound('save');notify('Moment note updated');}}><label>Edit your note<textarea ref={editor} aria-label={`Note for ${video.title} at ${momentTime(moment.time)}`} value={note} maxLength={180} rows={3} onChange={event=>setNote(event.target.value)}/></label><span>{note.length}/180</span><button type="button" onClick={()=>setEditing(null)}>Cancel</button><button type="submit" data-sound-owned><Check size={15}/>Save</button></form> : <><p>{moment.note || 'A moment worth returning to.'}</p><div className="notebook-entry-actions"><button data-edit-moment={moment.id} onClick={()=>{setEditing(moment.id);setNote(moment.note);}} aria-label={`Edit moment at ${momentTime(moment.time)} in ${video.title}`}><NotePencil size={16}/>Edit note</button><button data-sound-owned aria-label={`Remove moment at ${momentTime(moment.time)} from ${video.title}`} onClick={()=>remove(moment.id)}><X size={16}/></button></div></>}
      </div>
    </article>)}</div>{collection.length>6 && <button className="text-link notebook-expand" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Show fewer moments':`Show all ${collection.length} moments`}<ArrowUpRight size={17}/></button>}</> : <div className="notebook-empty"><p>A line you want to remember. A scene you want to revisit.<br/>Choose “Keep this moment” in the player to start your collection.</p><a className="text-link" href={href('/search')}>Find a story <ArrowUpRight size={17}/></a></div>}
    <p className="notebook-footnote">{persistentStorage ? 'Timestamps and notes stay in this browser. Your collection is not synced to an account.' : 'Storage is unavailable. These notes last only for this visit and will reset when you reload.'}</p>
  </section>;
}
