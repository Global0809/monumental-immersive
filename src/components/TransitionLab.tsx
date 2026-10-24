import { useId, useMemo, useState, type MouseEvent } from 'react';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { buildTransitionContour, transitionExtent } from '../services/transitionContours';
import { setTransitionReview, setTransitionVariant, transitionVariants, useTransitionPreference, type TransitionVariant } from '../services/transitionPreferences';
import './transition-lab.css';

function enableReview(event: MouseEvent<HTMLAnchorElement>) {
  if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) setTransitionReview(true);
}

function ContourPreview({ variant, progress }: { variant: TransitionVariant; progress: number }) {
  const id = useId().replace(/:/g, '');
  const path = useMemo(() => {
    const width = 500, height = 300, extent = transitionExtent(width, height);
    return buildTransitionContour({ width, height, frontY: height + extent - progress * (height + extent * 2), seed: 'monumental-comparison', variant }).path;
  }, [variant, progress]);
  return <svg className="transition-preview" viewBox="0 0 500 300" aria-hidden="true" focusable="false">
    <defs><clipPath id={id}><path d={path} fillRule="evenodd" clipRule="evenodd" /></clipPath></defs>
    <rect width="500" height="300" fill="#080909" />
    <g fill="#efeee9"><text x="25" y="150">MONUMENTAL</text><text className="transition-preview-caption" x="27" y="177">THE SAME PAGE. A DIFFERENT PASSAGE.</text></g>
    <g clipPath={`url(#${id})`}>
      <rect width="500" height="300" fill="#ff4d32" />
      <g fill="#0b0c0b"><text x="25" y="150">MONUMENTAL</text><text className="transition-preview-caption" x="27" y="177">THE SAME PAGE. A DIFFERENT PASSAGE.</text></g>
    </g>
  </svg>;
}

export default function TransitionLab({ reducedMotion }: { reducedMotion: boolean }) {
  const { variant } = useTransitionPreference();
  const [progress, setProgress] = useState(.5);
  const active = transitionVariants.find(item => item.id === variant)!;
  return <div className="transition-lab">
    <header className="transition-lab-intro">
      <h1>FIVE WAYS<br />THROUGH.</h1>
      <div>
        <p>Same world. Same orange. Five different ways to reveal the next chapter.</p>
        <p>Choose a surface, then scroll. You can change it at the very same point on any page to compare the shape and its relationship to the content.</p>
        <a className="text-link" href="#/category/movies" onClick={enableReview}>Compare on Movies <ArrowUpRight size={18} /></a>
      </div>
    </header>

    <section className="transition-lab-comparisons" aria-labelledby="transition-compare-heading">
      <div className="transition-lab-controls" data-erosion-protect>
        <div><h2 id="transition-compare-heading">CHOOSE THE FEEL.</h2><p>These previews use the same contour geometry as the page.</p></div>
        <label className="transition-preview-slider">Preview position <output>{Math.round(progress * 100)}%</output>
          <input type="range" min="0" max="100" step="1" value={Math.round(progress * 100)} onChange={event => setProgress(Number(event.target.value) / 100)} aria-label="Position of all five transition previews" />
        </label>
      </div>
      <div className="transition-variations">
        {transitionVariants.map((item, index) => <article className="transition-variation" key={item.id} data-selected={variant === item.id} data-erosion-protect>
          <ContourPreview variant={item.id} progress={progress} />
          <div className="transition-variation-copy">
            <div className="transition-variation-title"><span>{String(index + 1).padStart(2, '0')}</span><h3>{item.name}</h3></div>
            <p>{item.description}</p>
            <button type="button" aria-pressed={variant === item.id} onClick={() => { setTransitionVariant(item.id); setTransitionReview(true); }}>
              {variant === item.id ? <><Check size={17} /> Selected</> : <>Try {item.name} <ArrowRight size={17} /></>}
            </button>
          </div>
        </article>)}
      </div>
      <p className="transition-lab-selection" role="status">{active.name} is selected. Your choice is saved in this browser.{reducedMotion && ' Reduced motion is on: the page keeps stable section treatments. You can still move the preview slider to inspect each contour.'}</p>
    </section>

    <section className="transition-lab-sample" aria-labelledby="transition-sample-heading">
      <h2 id="transition-sample-heading">CULTURE<br />KEEPS<br />MOVING.</h2>
      <div className="transition-lab-editorial">
        <p className="transition-lab-lead">A place becomes a story. A story becomes a connection. Follow it far enough and the world opens up.</p>
        <p>This chapter gives you a real reading surface to compare. Watch the edge cross the headline, the smaller type and the rules. Stop wherever you like, reverse your scroll, or change the selected variation without moving the page.</p>
        <p>The color belongs to the page. Films, photography and the chrome objects keep their own material and color.</p>
        <div className="transition-lab-reading-links">
          <a href="#/world?place=miami" onClick={enableReview}><span>FOLLOW A PLACE</span><strong>Enter the atlas</strong><ArrowUpRight size={22} /></a>
          <a href="#/category/movies" onClick={enableReview}><span>FOLLOW A STORY</span><strong>Find your next film</strong><ArrowUpRight size={22} /></a>
          <a href="#/time-machine" onClick={enableReview}><span>FOLLOW A MOMENT</span><strong>Travel through time</strong><ArrowUpRight size={22} /></a>
        </div>
      </div>
    </section>

    <section className="transition-lab-return" aria-labelledby="transition-return-heading">
      <div><h2 id="transition-return-heading">TAKE IT<br />INTO THE WORLD.</h2><p>The small comparison panel follows you between pages. Switch styles at a fixed scroll position to judge them against the same content.</p></div>
      <div className="transition-lab-destinations" data-erosion-protect>
        <a href="#/category/movies" onClick={enableReview}>Try on Movies <ArrowUpRight size={20} /></a>
        <a href="#/" onClick={enableReview}>Try on Home <ArrowUpRight size={20} /></a>
        <a href="#/world" onClick={enableReview}>Try on World <ArrowUpRight size={20} /></a>
      </div>
    </section>
  </div>;
}

type TransitionRange = { seed?: string; start: number; end: number };
export function TransitionReviewBar({ reducedMotion }: { reducedMotion: boolean }) {
  const { variant, review } = useTransitionPreference();
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState('');
  const panelId = useId();
  const active = transitionVariants.find(item => item.id === variant)!;
  function showMidpoint() {
    const field = document.querySelector<SVGElement>('.erosion-field');
    let ranges: TransitionRange[] = [];
    try { ranges = JSON.parse(field?.dataset.ranges || '[]'); } catch { /* A route may still be mounting. */ }
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    ranges = ranges.filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start && (item.start + item.end) / 2 >= 0 && (item.start + item.end) / 2 <= maxY);
    const meaningful = ranges.filter(item => item.seed !== 'closing');
    if (meaningful.length) ranges = meaningful;
    const current = ranges.find(item => item.seed === field?.dataset.seed) || ranges.find(item => scrollY >= item.start && scrollY <= item.end) || ranges.find(item => item.end > scrollY) || ranges[0];
    if (!current) { setNotice('No complete transition is available here. Try Movies or the comparison page.'); return; }
    window.scrollTo({ top: (current.start + current.end) / 2, behavior: 'instant' });
    setNotice(reducedMotion ? 'Reduced motion is on. Use the comparison page to inspect the contour.' : 'At the midpoint. Change a variation or scroll in either direction.');
  }
  if (!review) return null;
  return <aside className="transition-review" data-expanded={expanded} data-erosion-protect aria-label="Transition comparison">
    <div className="transition-review-heading">
      <button className="transition-review-toggle" type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => { setExpanded(value => !value); setNotice(''); }}><span>COMPARE</span><strong>{active.name}</strong><CaretDown size={16} /></button>
      <button className="transition-review-midpoint" type="button" aria-label="Show midpoint" onClick={showMidpoint}>Midpoint</button>
      <button className="transition-review-close" type="button" aria-label="Close transition comparison" onClick={() => setTransitionReview(false)}><X size={18} /></button>
    </div>
    <div id={panelId} className="transition-review-body" hidden={!expanded}>
      <div className="transition-review-options" role="group" aria-label="Choose a transition variation">
        {transitionVariants.map(item => <button type="button" key={item.id} aria-pressed={variant === item.id} onClick={() => { setTransitionVariant(item.id); setNotice(''); }}>{item.name}</button>)}
      </div>
      <label className="transition-review-select">Variation<select value={variant} onChange={event => { setTransitionVariant(event.target.value as TransitionVariant); setNotice(''); }}>{transitionVariants.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <p>{active.description}</p>
      <div className="transition-review-footer"><span>Switching preserves your scroll position.</span><a href="#/transitions">All five previews <ArrowUpRight size={15} /></a></div>
    </div>
    {notice && <p className="transition-review-notice" role="status">{notice}</p>}
  </aside>;
}
