// Small, local effects. No remote fonts, animation runtime or browser storage.
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

export function applyTheme(theme='light') {
  const value=theme==='dark'?'dark':'light';
  document.documentElement.dataset.theme=value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',value==='dark'?'#0c1715':'#f3f6f3');
  const button=document.querySelector('[data-action="theme-toggle"]');
  if(button){button.setAttribute('aria-label',value==='dark'?'切换到浅色主题':'切换到深色主题');button.title=button.getAttribute('aria-label');button.setAttribute('aria-pressed',String(value==='dark'));button.innerHTML=value==='dark'?'☀':'☾';}
}

export function refreshVisuals(root,entering=false) {
  for(const card of root.querySelectorAll('.stat-card,.panel,.task-card,.note-card,.link-card,.archive-how'))card.setAttribute('data-spotlight','');
  if(entering&&!reduced())root.animate([{opacity:.25,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:330,easing:'cubic-bezier(.22,1,.36,1)'});
}

export function installSpotlight() {
  let frame=0,pending,previous;
  document.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||reduced()||!matchMedia('(hover: hover) and (pointer: fine)').matches)return;
    const card=event.target.closest?.('[data-spotlight]');
    if(previous&&previous!==card)previous.classList.remove('spot-lit');
    previous=card;
    if(!card)return;
    pending={card,x:event.clientX,y:event.clientY};
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;const {card,x,y}=pending;if(!card.isConnected)return;const rect=card.getBoundingClientRect();card.style.setProperty('--spot-x',`${x-rect.left}px`);card.style.setProperty('--spot-y',`${y-rect.top}px`);card.classList.add('spot-lit');});
  },{passive:true});
  document.addEventListener('pointerout',event=>{if(previous&&!previous.contains(event.relatedTarget)){previous.classList.remove('spot-lit');previous=undefined;}},{passive:true});
}
