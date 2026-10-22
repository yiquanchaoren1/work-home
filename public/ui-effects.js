// Small, local effects. No remote fonts, animation runtime or browser storage.
import {installPointerEffects} from './pointer-effects.js?v=trail-20261017';
import {designFor} from './appearance.js?v=organic-20261022';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const counters=new Map();

export function applyTheme(theme='light',design='experimental') {
  const preset=designFor(design);
  const value=theme==='dark'?'dark':'light';
  document.documentElement.dataset.design=preset.id;
  document.documentElement.dataset.theme=value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',value==='dark'?preset.night:preset.color);
  const mark=document.querySelector('.brand-mark');if(mark)mark.textContent=preset.id==='porcelain'?'间':'B/';
  const caption=document.querySelector('.brand-caption');if(caption)caption.textContent=preset.id==='experimental'?'一间慢慢生长的工作室':preset.id==='porcelain'?'私人案头':preset.id==='paper'?'工作与笔记的私人刊物':'一间安静的画廊';
  const button=document.querySelector('[data-action="theme-toggle"]');
  if(button){button.setAttribute('aria-label',value==='dark'?'切换到浅色主题':'切换到深色主题');button.title=button.getAttribute('aria-label');button.setAttribute('aria-pressed',String(value==='dark'));button.innerHTML=value==='dark'?'☀':'☾';}
}

export function refreshVisuals(root,entering=false) {
  for(const card of root.querySelectorAll('.stat-card,.panel,.task-card,.note-card,.link-card,.archive-how'))card.setAttribute('data-spotlight','');
  if(entering&&!reduced())root.animate([{opacity:.25,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:document.documentElement.dataset.design==='experimental'?650:330,easing:document.documentElement.dataset.design==='experimental'?'ease-in-out':'cubic-bezier(.22,1,.36,1)'});
  for(const number of root.querySelectorAll('[data-count-key]')) {
    const key=number.dataset.countKey,value=number.textContent;
    if(counters.has(key)&&counters.get(key)!==value&&!reduced())number.animate([{opacity:.3,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:document.documentElement.dataset.design==='experimental'?550:240,easing:'ease-in-out'});
    counters.set(key,value);
  }
}

export function animateReorder(container,move,excluded) {
  const positions=new Map([...container.children].map(el=>[el,el.getBoundingClientRect()]));
  move();
  if(reduced())return;
  for(const element of container.children) {
    const before=positions.get(element);if(!before||element===excluded)continue;
    const after=element.getBoundingClientRect(),x=before.left-after.left,y=before.top-after.top;
    if(x||y)element.animate([{transform:`translate(${x}px,${y}px)`},{transform:'translate(0,0)'}],{duration:document.documentElement.dataset.design==='experimental'?550:190,easing:'ease-in-out'});
  }
}

export function installSpotlight() {
  return installPointerEffects();
}
