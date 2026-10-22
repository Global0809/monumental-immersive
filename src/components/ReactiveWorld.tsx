import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { reactiveField as input } from '../services/reactiveField';
import './reactive-world.css';
gsap.registerPlugin(ScrollTrigger, SplitText);

export default function ReactiveWorld({path,reducedMotion}:{path:string;reducedMotion:boolean}) {
  const canvas=useRef<HTMLCanvasElement>(null);const lens=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    input.reduced=reducedMotion;
    const el=canvas.current;if(!el)return;const drawing=el.getContext('2d');if(!drawing)return;const ctx:CanvasRenderingContext2D=drawing;
    if(reducedMotion){if(lens.current)lens.current.style.opacity='0';ctx.clearRect(0,0,el.width,el.height);input.active=false;return;}
    const fine=matchMedia('(pointer:fine)').matches;
    const points=Array.from({length:fine?48:24},(_,i)=>({x:((i*167.73)%997)/997,y:((i*239.1)%991)/991,z:.25+(i%5)/7}));
    let width=innerWidth,height=innerHeight,frame=0,last=0,time=0,hidden=document.hidden;
    let x=-1000,y=-1000,energy=0,lastScroll=scrollY,scan=0,rects:DOMRect[]=[],dirty=true,lastMeasure=0;
    let target:Element|null=null;let label='MONUMENTAL / STRUCTURE';
    const resize=()=>{width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio,1.25);el.width=width*dpr;el.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);dirty=true;};
    const schedule=()=>{if(!frame&&!hidden&&!input.blocked)frame=requestAnimationFrame(draw);};
    const move=(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;input.x=e.clientX;input.y=e.clientY;input.active=Boolean((e.target as Element).closest('main'))&&!document.querySelector('dialog[open]');const next=(e.target as Element).closest('section,article,.film-card,.portal');if(next!==target){target=next;dirty=true;label=(next?.querySelector('h1,h2,h3')?.textContent||path.replaceAll('/',' ')||'MONUMENTAL').trim().replace(/\s+/g,' ').slice(0,30).toUpperCase();}schedule();};
    const leave=()=>{input.active=false;};
    const scroll=()=>{input.velocity=Math.max(-40,Math.min(40,scrollY-lastScroll));lastScroll=scrollY;input.scroll=scrollY;dirty=true;schedule();};
    const visibility=()=>{hidden=document.hidden;if(hidden){cancelAnimationFrame(frame);frame=0;}else schedule();};
    const playback=(e:Event)=>{input.blocked=(e as CustomEvent<{active:boolean}>).detail.active;if(input.blocked){cancelAnimationFrame(frame);frame=0;ctx.clearRect(0,0,width,height);if(lens.current)lens.current.style.opacity='0';}else schedule();};
    function draw(now:number){
      frame=0;if(hidden||input.blocked)return;
      const interval=fine&&input.active?1000/40:1000/20;if(now-last<interval){schedule();return;}
      const dt=Math.min(.06,(now-last)/1000||.025);last=now;time+=dt;
      x+=(input.x-x)*.26;y+=(input.y-y)*.26;scan+=((input.active?1:0)-scan)*.2;
      if(lens.current){lens.current.style.transform=`translate3d(${x-158}px,${y-158}px,0)`;lens.current.style.opacity=String(fine?scan:0);}
      energy+=(input.velocity-energy)*.12;input.velocity*=.86;
      // Read visible layout only after a change, at most five times a second.
      if(dirty&&now-lastMeasure>200){rects=Array.from(document.querySelectorAll('main h1,main h2,main h3,main .film-image,main .portal,main .motion-stage,main .button,main .category-index a')).map(e=>e.getBoundingClientRect()).filter(r=>r.bottom>60&&r.top<height&&r.width>0).slice(0,42);dirty=false;lastMeasure=now;}
      ctx.clearRect(0,0,width,height);
      const drift=input.scroll*.045;
      // An orbital dust field; the scroll adds depth and the pointer repels it.
      points.forEach((p,i)=>{let px=p.x*width+Math.sin(time*.18+i)*15,py=((p.y*height-drift*p.z+time*3*p.z)%height+height)%height;const dx=px-x,dy=py-y,d=Math.hypot(dx,dy);if(input.active&&d<150){const force=(1-d/150)*22;px+=dx/(d||1)*force;py+=dy/(d||1)*force;}ctx.fillStyle=i%6===0?'rgba(255,93,60,.32)':'rgba(228,231,218,.18)';ctx.fillRect(px,py,p.z*1.7,p.z*1.7);});
      // A continuous contour surface, subtly lifted by scroll velocity.
      ctx.lineWidth=.65;
      for(let row=0;row<7;row++){ctx.beginPath();for(let col=0;col<=32;col++){const px=col*width/32;const py=height*.72+row*22+Math.sin(col*.18+time*.16+row*.21+input.scroll*.0008)*38+energy*(col/32-.5)*.8;col?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.strokeStyle=`rgba(168,177,157,${.025+row*.003})`;ctx.stroke();}
      if(scan>.015&&fine){
        ctx.save();ctx.beginPath();ctx.arc(x,y,158,0,Math.PI*2);ctx.clip();
        const glow=ctx.createRadialGradient(x,y,8,x,y,158);glow.addColorStop(0,`rgba(255,77,50,${.065*scan})`);glow.addColorStop(1,'rgba(255,77,50,0)');ctx.fillStyle=glow;ctx.fillRect(x-158,y-158,316,316);
        // Mesh contours follow the lens, while the rectangles expose real UI bounds.
        for(let row=-5;row<=5;row++){ctx.beginPath();for(let col=-8;col<=8;col++){const px=x+col*22,py=y+row*24+Math.cos(col*.35+time*.4+input.scroll*.002)*10;col===-8?ctx.moveTo(px,py):ctx.lineTo(px,py);}ctx.strokeStyle=`rgba(255,118,78,${.12*scan*(1-Math.abs(row)/6)})`;ctx.stroke();}
        rects.forEach(r=>{if(r.right<x-158||r.left>x+158||r.bottom<y-158||r.top>y+158)return;ctx.strokeStyle=`rgba(255,122,80,${.48*scan})`;ctx.setLineDash([3,4]);ctx.strokeRect(r.left,r.top,r.width,r.height);ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(r.left,r.top);ctx.lineTo(r.right,r.bottom);ctx.moveTo(r.right,r.top);ctx.lineTo(r.left,r.bottom);ctx.strokeStyle=`rgba(239,228,205,${.12*scan})`;ctx.stroke();});
        ctx.restore();
        ctx.fillStyle=`rgba(255,151,115,${.65*scan})`;ctx.font='9px monospace';ctx.fillText(label,Math.min(width-240,Math.max(20,x-125)),Math.max(95,y-126));
      }
      schedule();
    }
    resize();schedule();window.addEventListener('resize',resize);window.addEventListener('scroll',scroll,{passive:true});document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);window.addEventListener('monumental:playback',playback);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);window.removeEventListener('scroll',scroll);document.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('monumental:playback',playback);ctx.clearRect(0,0,width,height);input.active=false;if(lens.current)lens.current.style.opacity='0';};
  },[path,reducedMotion]);

  useEffect(()=>{
    if(reducedMotion)return;
    const root=document.querySelector('.route-stage');if(!root)return;
    const seen=new WeakSet<Element>();const splits:SplitText[]=[];const animations:Animation[]=[];
    const context=gsap.context(()=>{},root);
    let disposed=false,timer=0;
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(!entry.isIntersecting)return;const element=entry.target as HTMLElement;observer.unobserve(element);
      // Text stays selectable and keeps its native accessible name.
      if(element.matches('h1')&&!element.querySelector('a,button,input')){
        context.add(()=>{const split=SplitText.create(element,{type:'words,chars',charsClass:'kinetic-letter',aria:'auto',smartWrap:true});splits.push(split);gsap.fromTo(split.chars,{yPercent:42,rotationX:-35,opacity:.35},{yPercent:0,rotationX:0,opacity:1,duration:.85,stagger:{amount:.32},ease:'power4.out',clearProps:'transform,opacity'});});
      }else animations.push(element.animate([{opacity:.4,transform:'translateY(16px)',clipPath:'inset(0 0 18% 0)'},{opacity:1,transform:'translateY(0)',clipPath:'inset(0)'}],{duration:600,easing:'cubic-bezier(.16,1,.3,1)'}));
    }),{threshold:.08});
    const scan=()=>{if(disposed)return;root.querySelectorAll<HTMLElement>('h1,h2,h3,.section-heading>p,.story-context p,.page-section>p,.hero-copy>p').forEach(el=>{if(seen.has(el)||el.closest('.ms-player-dialog,.motion-caption,.original-stop-context'))return;seen.add(el);observer.observe(el);});};
    scan();const mutation=new MutationObserver(()=>{clearTimeout(timer);timer=window.setTimeout(scan,100);});mutation.observe(root,{childList:true,subtree:true});
    // Existing 3D remains interactive while its framing follows the native scroll.
    context.add(()=>{root.querySelectorAll<HTMLElement>('h1').forEach(el=>gsap.to(el,{yPercent:-8,ease:'none',scrollTrigger:{trigger:el,start:'top 12%',end:'bottom top',scrub:.7}}));root.querySelectorAll<HTMLElement>('.hero-sculpture,.detail-hero>img').forEach(el=>gsap.to(el,{y:innerWidth>700?70:25,rotation:el.matches('.hero-sculpture')?3:0,ease:'none',scrollTrigger:{trigger:el.parentElement,start:'top top',end:'bottom top',scrub:.8}}));});
    return()=>{disposed=true;clearTimeout(timer);mutation.disconnect();observer.disconnect();animations.forEach(a=>a.cancel());context.revert();splits.forEach(s=>s.revert());};
  },[path,reducedMotion]);
  return <><div ref={lens} className="structure-lens" aria-hidden="true"/><canvas ref={canvas} className="reactive-world" aria-hidden="true"/></>;
}
