import { useState } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { type Video } from '../../data/catalogue';
import { relatedVideos } from '../../services/discovery';
import { href } from '../../services/router';
import './spatial-expansion.css';
export default function FilmDossier({video,onWatch}:{video:Video;onWatch:(v:Video)=>void}) {
  const [open,setOpen]=useState(false),[tab,setTab]=useState('Context');
  const related=relatedVideos(video);
  return <section className="expansion-panel film-dossier"><h2>UNFOLD THE STORY.</h2><p>Turn over the cover. Inspect the context and people behind this film.</p><button className="button button-outline" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Fold the dossier':'Open the dossier'}<ArrowUpRight/></button>
    <div className="dossier-spread" data-open={open}><div className="dossier-cover"><img src={video.poster} alt=""/><strong>{video.title}</strong><small>{video.status==='development'?'In development':'Available in the collection'}</small></div><div className="dossier-page" inert={!open} aria-hidden={!open}><div className="expansion-choice" role="group" aria-label="Dossier pages">{['Context','Credits','Connections'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</div><div className="dossier-copy" aria-live="polite">{tab==='Context'?<><h3>The wider picture</h3><p>{video.context||video.description}</p></>:tab==='Credits'?<><h3>Behind the frame</h3><p>{video.credit}</p>{video.people.length>0&&<p>{video.people.join(' · ')}</p>}<a className="expansion-link" href={href('/credits')}>Source notes<ArrowUpRight/></a></>:<><h3>Continue the thread</h3>{related.map(r=><div className="dossier-connection" key={r.video.id}><a href={href('/film/'+r.video.id)}>{r.video.title}<small>{r.reason}</small></a><button aria-label={`Play connected story ${r.video.title}`} disabled={!r.video.src||r.video.access!=='free'} onClick={()=>onWatch(r.video)}><Play/></button></div>)}</>}</div></div></div>
  </section>;
}
