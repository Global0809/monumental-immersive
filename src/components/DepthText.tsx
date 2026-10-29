import { useEffect, useRef } from 'react';
import './depth-text.css';

/** One visible text source: letters arrive briefly in depth, then settle.
 * The uninterrupted reading layer prevents glyph-by-glyph announcements.
 * A station's inert state gates arrival, so travelling panels never ghost. */
export default function DepthText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    delete element.dataset.arrived;
    let entered = false, visible = false;
    const arrive = () => {
      if (entered || !visible || element.closest('[inert],[aria-hidden="true"]')) return;
      entered = true; element.dataset.arrived = 'true';
    };
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); arrive(); }, { threshold: .4 });
    observer.observe(element);
    const gate = element.closest('.tunnel-panel-mount');
    const mutation = new MutationObserver(arrive);
    if (gate) mutation.observe(gate, { attributes: true, attributeFilter: ['inert', 'aria-hidden'] });
    return () => { observer.disconnect(); mutation.disconnect(); };
  }, [text]);
  let count = 0;
  return <span ref={ref} className={`depth-text ${className}`}><span className="depth-text-readable">{text}</span><span className="depth-text-visual" aria-hidden="true">{text.split(/(\s+)/).map((word, index) => /\s/.test(word) ? word : <span className="depth-word" key={index}>{Array.from(word).map((letter, i) => <span className="depth-letter" key={i} style={{ animationDelay: `${Math.min(260, count++ * 14)}ms` }}>{letter}</span>)}</span>)}</span></span>;
}
