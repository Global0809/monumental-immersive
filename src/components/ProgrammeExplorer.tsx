import { useState } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { videos, type Video } from '../data/catalogue';
import { durationLabel } from '../services/discovery';
import { href } from '../services/router';
import { updateViewer, useViewer } from '../services/viewer';
import { notify } from '../services/feedback';
import './programme-explorer.css';

const directions = [
  { name: 'Music', title: 'Follow the sound.', description: 'Live performance is part of the vision. Start with the music and places already in the preview collection.', video: 'island-current', route: '/category/music' },
  { name: 'Conversations', title: 'Go behind the story.', description: 'Conversations with people shaping culture are a planned direction. Explore the context around an available study today.', video: 'miami-frequency', route: '/film/miami-frequency' },
  { name: 'Culture', title: 'Find the connection.', description: 'Cultural events are part of the planned programme. For now, explore the places, art and ideas in the collection.', video: 'concrete-and-colour', route: '/category/culture' },
];

export function ProgrammeExplorer({ onWatch }: { onWatch: (video: Video) => void }) {
  const [index, setIndex] = useState(0);
  const viewer = useViewer();
  const active = directions[index];
  const video = videos.find(item => item.id === active.video && item.status === 'available' && item.access === 'free' && item.src);
  const interest = `Live · ${active.name}`;
  const following = viewer.interests.includes(interest);
  return <section className="programme-explorer" aria-labelledby="programme-title">
    <header><h2 id="programme-title">What would you follow?</h2><p>Explore a direction. Keep the ones you care about in My World.</p></header>
    <div className="programme-tabs" role="tablist" aria-label="Live programme interests" onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % directions.length : event.key === 'ArrowLeft' ? (index + directions.length - 1) % directions.length : event.key === 'Home' ? 0 : event.key === 'End' ? directions.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); setIndex(next); (event.currentTarget.children[next] as HTMLButtonElement).focus();
    }}>{directions.map((item, i) => <button key={item.name} id={`programme-tab-${i}`} role="tab" aria-selected={index === i} aria-controls="programme-panel" tabIndex={index === i ? 0 : -1} onClick={() => setIndex(i)}>{item.name}<ArrowUpRight size={18}/></button>)}</div>
    <div className="programme-panel" id="programme-panel" role="tabpanel" aria-labelledby={`programme-tab-${index}`} tabIndex={0}>
      <div><h3>{active.title}</h3><p>{active.description}</p><button className="button button-outline" aria-pressed={following} onClick={() => {
        updateViewer({ interests: following ? viewer.interests.filter(item => item !== interest) : [...viewer.interests, interest] });
        notify(following ? `${active.name} removed from your live interests` : `${active.name} saved in My World`);
      }}>{following ? <Check size={18}/> : <Plus size={18}/>} {following ? 'Following this direction' : `Follow ${active.name.toLowerCase()}`}</button><small>Saved on this browser. This does not register for an event or email updates.</small></div>
      {video && <div className="programme-story"><button className="programme-screen" aria-label={`Watch ${video.title}`} onClick={() => onWatch(video)}><img src={video.poster} alt="" loading="lazy"/><span><Play size={24} weight="fill"/></span></button><div><strong>{video.title}</strong><span>{durationLabel(video.duration)} · Available study</span></div><a href={href(active.route)}>Explore this direction <ArrowUpRight size={16}/></a><small>On-demand preview content. This is not a live broadcast.</small></div>}
    </div>
  </section>;
}

export function MembershipQuestions() {
  return <section className="membership-questions" aria-labelledby="membership-questions-title"><h2 id="membership-questions-title">Before you join.</h2>
    <details><summary>What can I watch today?</summary><p>The free preview collection includes original motion studies and openly licensed guest films. Every story shows its format and availability.</p><a href={href('/search', { status: 'available' })}>Browse available stories <ArrowUpRight size={15}/></a></details>
    <details><summary>Can I buy Monumental+ now?</summary><p>Purchases are not open in this preview. Pricing, launch timing and final benefits have not been announced. Following Monumental+ only saves an interest in this browser.</p></details>
    <details><summary>Will my collection follow me to another device?</summary><p>Today your saved films, notes and journeys stay in this browser. Account sign-in and cross-device sync are not connected yet.</p><a href={href('/my-world')}>Open My World <ArrowUpRight size={15}/></a></details>
  </section>;
}

export function ExperienceMode() {
  const immersive = new URLSearchParams(location.search).get('experience') !== 'classic';
  const modeLink = (mode: string) => { const params = new URLSearchParams(location.search); if (mode === 'classic') params.set('experience', 'classic'); else params.delete('experience'); return `${params.size ? '?' + params.toString() : location.pathname}${location.hash}`; };
  return <div className="experience-mode"><span><strong>Your way into Monumental</strong><small>Choose the 3D observatory or the original editorial website. Your saved collection stays in this browser.</small></span><div><a className={`button button-outline ${immersive ? 'is-selected' : ''}`} href={modeLink('immersive')} aria-current={immersive ? 'true' : undefined}>3D observatory {immersive && <Check size={15}/>}</a><a className={`button button-outline ${!immersive ? 'is-selected' : ''}`} href={modeLink('classic')} aria-current={!immersive ? 'true' : undefined}>Original website {!immersive && <Check size={15}/>}</a></div></div>;
}
