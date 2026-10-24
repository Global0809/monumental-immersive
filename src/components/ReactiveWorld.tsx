import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { mountStructuralReveal } from '../services/structuralReveal';
import './reactive-world.css';
gsap.registerPlugin(ScrollTrigger, SplitText);

export default function ReactiveWorld({path,reducedMotion}:{path:string;reducedMotion:boolean}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    return mountStructuralReveal(canvas.current, reducedMotion);
  }, [path, reducedMotion]);

  useEffect(()=>{
    if(reducedMotion)return;
    const root=document.querySelector('.route-stage');if(!root)return;
    const seen=new WeakSet<Element>();const splits:SplitText[]=[];const animations:Animation[]=[];
    const context=gsap.context(()=>{},root);
    let disposed=false,timer=0;
    const typographySettled=()=>{if(!disposed&&root.isConnected)window.dispatchEvent(new Event('monumental:typography-settled'));};
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(!entry.isIntersecting)return;const element=entry.target as HTMLElement;observer.unobserve(element);
      // Text stays selectable and keeps its native accessible name.
      if(element.matches('h1')&&!element.querySelector('a,button,input')){
        context.add(()=>{const split=SplitText.create(element,{type:'words,chars',charsClass:'kinetic-letter',aria:'auto',smartWrap:true});splits.push(split);gsap.fromTo(split.chars,{yPercent:42,rotationX:-35,opacity:.35},{yPercent:0,rotationX:0,opacity:1,duration:.85,stagger:{amount:.32},ease:'power4.out',clearProps:'transform,opacity',onComplete:typographySettled});});
      }else{
        const animation=element.animate([{opacity:.4,transform:'translateY(16px)',clipPath:'inset(0 0 18% 0)'},{opacity:1,transform:'translateY(0)',clipPath:'inset(0)'}],{duration:600,easing:'cubic-bezier(.16,1,.3,1)'});
        animations.push(animation);void animation.finished.then(typographySettled,()=>{});
      }
    }),{threshold:.08});
    const scan=()=>{if(disposed)return;root.querySelectorAll<HTMLElement>('h1,h2,h3,.section-heading>p,.story-context p,.page-section>p,.hero-copy>p').forEach(el=>{if(seen.has(el)||el.closest('.ms-player-dialog,.motion-caption,.original-stop-context'))return;seen.add(el);observer.observe(el);});};
    scan();const mutation=new MutationObserver(()=>{clearTimeout(timer);timer=window.setTimeout(scan,100);});mutation.observe(root,{childList:true,subtree:true});
    // Existing 3D remains interactive while its framing follows the native scroll.
    context.add(()=>{root.querySelectorAll<HTMLElement>('h1').forEach(el=>gsap.to(el,{yPercent:-8,ease:'none',scrollTrigger:{trigger:el,start:'top 12%',end:'bottom top',scrub:.7,onScrubComplete:typographySettled}}));root.querySelectorAll<HTMLElement>('.hero-sculpture,.detail-hero>img').forEach(el=>gsap.to(el,{y:innerWidth>700?70:25,rotation:el.matches('.hero-sculpture')?3:0,ease:'none',scrollTrigger:{trigger:el.parentElement,start:'top top',end:'bottom top',scrub:.8}}));});
    return()=>{disposed=true;clearTimeout(timer);mutation.disconnect();observer.disconnect();animations.forEach(a=>a.cancel());context.revert();splits.forEach(s=>s.revert());};
  },[path,reducedMotion]);
  return <canvas ref={canvas} className="reactive-world" aria-hidden="true"/>;
}
