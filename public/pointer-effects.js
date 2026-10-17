// Native SVG cursor and bounded, short-lived trails; no storage or network calls.
let installed=false;
export function installPointerEffects() {
  if(installed)return;
  installed=true;
  const fine=matchMedia('(hover: hover) and (pointer: fine)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const blocked='input,textarea,select,[contenteditable],.markdown-body,.archive-prose,.prose,.master-document';
  let aura,ring,auraLayer,ringLayer,frame=0,pending=null,card=null,hero=null,ready=false,x=0,y=0,ax=0,ay=0;
  let trailPoint=null,trailTime=0,traceIndex=0;
  const traces=[],traceLimit=24;
  const enabled=()=>fine.matches&&!motion.matches&&document.visibilityState!=='hidden'&&!document.querySelector('dialog[open]');
  function resetHero() {
    if(hero){hero.style.removeProperty('--hero-parallax-x');hero.style.removeProperty('--hero-parallax-y');hero.style.removeProperty('--hero-light-x');hero.style.removeProperty('--hero-light-y');hero=null;}
  }
  function reset(keepHero=false) {
    if(frame)cancelAnimationFrame(frame);
    frame=0;pending=null;ready=false;
    card?.classList.remove('spot-lit');card=null;if(keepHero!==true)resetHero();
    aura?.classList.remove('is-visible');ring?.classList.remove('is-visible','is-interactive');
    document.body.classList.remove('pointer-style-active');trailPoint=null;trailTime=0;
    for(const trace of traces){trace.animation?.cancel();trace.animation=null;trace.element.classList.remove('is-active');}
  }
  function traceAt(px,py,angle,length,spark=false) {
    if(typeof ring.animate!=='function')return;
    if(!spark){const radians=angle*Math.PI/180;px-=Math.cos(radians)*length;py-=Math.sin(radians)*length;}
    const index=traceIndex++%traceLimit;
    let trace=traces[index];
    if(!trace){const element=document.createElement('span');element.setAttribute('aria-hidden','true');ringLayer.append(element);trace=traces[index]={element,animation:null};}
    trace.animation?.cancel();
    const element=trace.element,drift=index%2===0?-7:7;
    element.className='pointer-trace '+(spark?'pointer-spark':'pointer-streak')+' is-active';
    element.style.width=(spark?4:length)+'px';
    const start=`translate3d(${px}px,${py}px,0) rotate(${spark?45:angle}deg) scale(1)`;
    const end=`translate3d(${px+(spark?drift:0)}px,${py+(spark?-11:0)}px,0) rotate(${spark?125:angle}deg) scale(${spark?0:.15})`;
    const animation=element.animate([{transform:start,opacity:spark ? .85 : .72},{transform:end,opacity:0}],{duration:spark?520:380,easing:'cubic-bezier(.16,.7,.35,1)'});
    trace.animation=animation;
    animation.onfinish=()=>{if(trace.animation===animation){trace.animation=null;element.classList.remove('is-active');}};
  }
  function trail(point) {
    const now=performance.now();
    if(!trailPoint){trailPoint={x:point.x,y:point.y};trailTime=now;return;}
    const dx=point.x-trailPoint.x,dy=point.y-trailPoint.y,distance=Math.hypot(dx,dy);
    if(distance<4||now-trailTime<16)return;
    const steps=Math.min(3,Math.max(1,Math.floor(distance/12))),angle=Math.atan2(dy,dx)*180/Math.PI;
    for(let i=0;i<steps;i++){
      const ratio=(i+1)/steps,px=trailPoint.x+dx*ratio,py=trailPoint.y+dy*ratio;
      traceAt(px,py,angle,Math.min(28,distance/steps));
      if(traceIndex%4===0)traceAt(px,py,angle,4,true);
    }
    trailPoint={x:point.x,y:point.y};trailTime=now;
  }
  function mount() {
    if(aura)return;
    aura=document.createElement('div');aura.className='pointer-aura';aura.setAttribute('aria-hidden','true');
    ring=document.createElement('div');ring.className='pointer-ring';ring.setAttribute('aria-hidden','true');
    auraLayer=document.createElement('div');auraLayer.className='pointer-aura-layer';auraLayer.setAttribute('aria-hidden','true');auraLayer.append(aura);
    ringLayer=document.createElement('div');ringLayer.className='pointer-ring-layer';ringLayer.setAttribute('aria-hidden','true');ringLayer.append(ring);
    document.body.append(auraLayer,ringLayer);
  }
  function update() {
    frame=0;
    if(!pending||!enabled()){reset();return;}
    const point=pending;
    document.body.classList.add('pointer-style-active');trail(point);
    x+=(point.x-x)*.32;y+=(point.y-y)*.32;ax+=(point.x-ax)*.16;ay+=(point.y-ay)*.16;
    aura.style.transform=`translate3d(${ax-210}px,${ay-210}px,0)`;
    ring.style.transform=`translate3d(${x-18}px,${y-18}px,0)`;
    aura.classList.add('is-visible');ring.classList.add('is-visible');ring.classList.toggle('is-interactive',point.interactive);
    if(card?.isConnected){
      const rect=card.getBoundingClientRect();card.style.setProperty('--spot-x',`${point.x-rect.left}px`);card.style.setProperty('--spot-y',`${point.y-rect.top}px`);card.classList.add('spot-lit');
    }
    if(hero?.isConnected){
      const rect=hero.getBoundingClientRect(),nx=Math.max(-1,Math.min(1,(point.x-rect.left)/rect.width*2-1)),ny=Math.max(-1,Math.min(1,(point.y-rect.top)/rect.height*2-1));
      hero.style.setProperty('--hero-parallax-x',`${nx*10}px`);hero.style.setProperty('--hero-parallax-y',`${ny*7}px`);
      hero.style.setProperty('--hero-light-x',`${(nx+1)*50}%`);hero.style.setProperty('--hero-light-y',`${(ny+1)*50}%`);
    }
    if(Math.max(Math.abs(point.x-x),Math.abs(point.y-y),Math.abs(point.x-ax),Math.abs(point.y-ay))>.15)frame=requestAnimationFrame(update);
  }
  function move(event) {
    const target=event.target instanceof Element?event.target:null;
    if(event.pointerType!=='mouse'||event.buttons||!enabled()||!target||target.closest(blocked)){reset();return;}
    const next=target.closest('[data-spotlight]');
    if(card!==next){card?.classList.remove('spot-lit');card=next;}
    if(card&&!card.querySelector(':scope > .pointer-rim')){const rim=document.createElement('span');rim.className='pointer-rim';rim.setAttribute('aria-hidden','true');card.append(rim);}
    const nextHero=target.closest('.studio-hero');if(hero!==nextHero){resetHero();hero=nextHero;}
    mount();pending={x:event.clientX,y:event.clientY,interactive:!!target.closest('button,a,[role="button"]')};
    if(!ready){ready=true;x=ax=pending.x;y=ay=pending.y;}
    if(!frame)frame=requestAnimationFrame(update);
  }
  function preference() {
    if(!fine.matches||motion.matches){reset();auraLayer?.remove();ringLayer?.remove();aura=ring=auraLayer=ringLayer=undefined;traces.length=0;traceIndex=0;}
  }
  const leave=event=>{if(!event.relatedTarget)reset();};
  const visibility=()=>{if(document.visibilityState==='hidden')reset();};
  const scroll=()=>reset(true);
  const focus=event=>{if(event.target instanceof Element&&event.target.closest(blocked))reset();};
  const observer=new MutationObserver(()=>{if((card&&!card.isConnected)||(hero&&!hero.isConnected))reset();});
  const content=document.querySelector('#content');if(content)observer.observe(content,{childList:true});
  document.addEventListener('pointermove',move,{passive:true});
  document.addEventListener('pointerout',leave,{passive:true});
  document.addEventListener('pointerdown',reset,{passive:true});
  document.addEventListener('focusin',focus);
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('blur',reset);window.addEventListener('hashchange',reset);window.addEventListener('scroll',scroll,{passive:true,capture:true});
  fine.addEventListener('change',preference);motion.addEventListener('change',preference);
  return ()=>{
    reset();observer.disconnect();auraLayer?.remove();ringLayer?.remove();installed=false;
    document.removeEventListener('pointermove',move);document.removeEventListener('pointerout',leave);document.removeEventListener('pointerdown',reset);document.removeEventListener('focusin',focus);document.removeEventListener('visibilitychange',visibility);
    window.removeEventListener('blur',reset);window.removeEventListener('hashchange',reset);window.removeEventListener('scroll',scroll,true);fine.removeEventListener('change',preference);motion.removeEventListener('change',preference);
  };
}
