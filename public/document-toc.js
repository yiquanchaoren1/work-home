// Build navigation from the sanitized document DOM, never from raw HTML strings.
export function mountDocumentToc(root,paper,content) {
  const headings=[...content.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  if(!headings.length)return;
  const document=root.ownerDocument,view=document.defaultView;
  const make=(tag,className,text)=>{const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const layout=make('div','reader-layout'),toc=make('details','reader-toc'),summary=make('summary','reader-toc-summary','本文目录');
  const nav=make('nav','reader-toc-nav'),list=make('ol','reader-toc-list'),links=[];
  const mobile=view.matchMedia('(max-width: 900px)'),minimum=headings.reduce((level,h)=>Math.min(level,Number(h.tagName[1])),6);
  toc.open=!mobile.matches;summary.append(make('span','reader-toc-count',String(headings.length)));
  nav.setAttribute('aria-label','文档标题目录');
  headings.forEach((heading,index)=>{
    heading.id='md-heading-'+(index+1);heading.tabIndex=-1;heading.classList.add('reader-heading');
    const item=make('li','reader-toc-item'),link=make('a','reader-toc-link',heading.textContent.replace(/\s+/g,' ').trim()||'未命名标题');
    item.style.setProperty('--toc-depth',String(Number(heading.tagName[1])-minimum));
    link.href='#'+heading.id;link.dataset.heading=heading.id;item.append(link);list.append(item);links.push(link);
  });
  nav.append(list);toc.append(summary,nav);layout.append(paper,toc);root.classList.add('reader-with-toc');root.replaceChildren(layout);
  let active=-1,frame=0,disposed=false;
  const update=()=>{
    frame=0;if(disposed)return;
    const topbar=document.querySelector('.reader-topbar'),sticky=topbar&&['sticky','fixed'].includes(view.getComputedStyle(topbar).position),offset=sticky?Math.max(0,topbar.getBoundingClientRect().bottom)+16:16;
    root.style.setProperty('--reader-toc-offset',offset+'px');
    let low=0,high=headings.length-1,index=0;
    while(low<=high){const mid=(low+high)>>1;if(headings[mid].getBoundingClientRect().top<=offset+12){index=mid;low=mid+1;}else high=mid-1;}
    if(view.scrollY>0&&view.scrollY+view.innerHeight>=document.documentElement.scrollHeight-2)index=headings.length-1;
    if(index===active)return;
    links[active]?.removeAttribute('aria-current');links[index].setAttribute('aria-current','location');active=index;
    if(toc.open){const box=nav.getBoundingClientRect(),item=links[index].getBoundingClientRect();if(item.top<box.top)nav.scrollTop-=box.top-item.top;else if(item.bottom>box.bottom)nav.scrollTop+=item.bottom-box.bottom;}
  };
  const queue=()=>{if(!disposed&&!frame)frame=view.requestAnimationFrame(update);};
  const jump=(heading,behavior='auto')=>{if(mobile.matches)toc.open=false;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior});queue();};
  const click=event=>{
    const link=event.target.closest('a[data-heading]');if(!link||!nav.contains(link)||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const heading=headings.find(h=>h.id===link.dataset.heading);if(!heading)return;
    event.preventDefault();view.history.replaceState(null,'','#'+heading.id);
    jump(heading,view.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth');
  };
  const hashChange=()=>{const heading=headings.find(h=>'#'+h.id===view.location.hash);if(heading)jump(heading);};
  nav.addEventListener('click',click);view.addEventListener('scroll',queue,{passive:true});view.addEventListener('resize',queue);view.addEventListener('hashchange',hashChange);content.addEventListener('load',queue,true);
  const observer=view.ResizeObserver?new view.ResizeObserver(queue):null;
  if(document.querySelector('.reader-topbar'))observer?.observe(document.querySelector('.reader-topbar'));
  update();if(headings.some(h=>'#'+h.id===view.location.hash))jump(headings.find(h=>'#'+h.id===view.location.hash));
  return ()=>{disposed=true;if(frame)view.cancelAnimationFrame(frame);observer?.disconnect();nav.removeEventListener('click',click);view.removeEventListener('scroll',queue);view.removeEventListener('resize',queue);view.removeEventListener('hashchange',hashChange);content.removeEventListener('load',queue,true);root.classList.remove('reader-with-toc');root.style.removeProperty('--reader-toc-offset');};
}
