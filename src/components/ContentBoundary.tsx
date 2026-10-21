import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react';
import { usePersistentStorage } from '../services/viewer';

function Recovery({player,onClose}:{player?:boolean;onClose?:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const persistentStorage=usePersistentStorage();
  useEffect(()=>{
    if(!player)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const element=dialog.current;
    if(element&&!element.open)element.showModal();
    return()=>{element?.close();if(previous?.isConnected)previous.focus();};
  },[player]);
  const content=<><span className="status-label">A brief interruption</span><h2>LET’S FIND<br/>THE CONNECTION.</h2><p>This part of the experience couldn’t open. {persistentStorage ? 'Reload to try again; your saved collection stays in this browser.' : 'You can keep exploring, or reload to try again. Browser storage is unavailable, so reloading will clear this visit’s saves and notes.'}</p><div><button className="button button-primary" onClick={()=>location.reload()}>Reload experience <span aria-hidden="true">↗</span></button>{onClose?<button className="button button-outline" onClick={onClose}>Back to discovery</button>:location.hash.split('?')[0]!=='#/'?<a className="button button-outline" href="#/">Go home <span aria-hidden="true">↗</span></a>:null}</div></>;
  return player?<dialog ref={dialog} className="content-recovery content-recovery-player" aria-label="Playback could not open" onCancel={event=>{event.preventDefault();onClose?.();}}>{content}</dialog>:<section className="content-recovery page-section" role="alert">{content}</section>;
}

/** A network interruption in a lazy route should leave navigation and guest data usable. */
export default class ContentBoundary extends Component<{ children:ReactNode; player?:boolean; onClose?:()=>void },{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error,info:ErrorInfo){
    if(import.meta.env.DEV)console.error('Monumental could not open this view',error,info.componentStack);
  }
  render(){
    if(!this.state.failed)return this.props.children;
    return <Recovery player={this.props.player} onClose={this.props.onClose}/>;
  }
}
