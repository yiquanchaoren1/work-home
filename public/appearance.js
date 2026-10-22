// Persisted appearance choices are independent of the work collections.
export const designs = [
  {id:'paper',label:'A 私人刊物',description:'纸白、朱红与杂志式排版',mode:'light',color:'#f3efe6',night:'#22211f'},
  {id:'experimental',label:'B 自然有机风',description:'暖米、鼠尾草绿、纸张与植物',mode:'light',color:'#faf6f1',night:'#2c2a25'},
  {id:'gallery',label:'C 安静画廊',description:'暖白、灰蓝与安静的留白',mode:'light',color:'#f8f8f4',night:'#19232b'},
  {id:'porcelain',label:'古风水墨',description:'瓷白、墨黑、朱印与山水',mode:'light',color:'#f8f9f5',night:'#181e19'},
];
export const designFor = id => designs.find(item=>item.id===id) || designs[1];
export function themeChoices(selected) {
  const current=designFor(selected).id;
  return `<div class="theme-choices" role="group" aria-label="选择视觉主题">${designs.map(item=>`<button type="button" class="theme-choice" data-action="design-select" data-design-id="${item.id}" aria-label="使用 ${item.label}主题" aria-pressed="${current===item.id}"><span class="theme-swatch swatch-${item.id}" aria-hidden="true"><i></i><b>B/H</b><em></em></span><span class="theme-choice-copy"><strong>${item.label}</strong><small>${item.description}</small></span><span class="theme-choice-check" aria-hidden="true">${current===item.id?'✓':'↗'}</span></button>`).join('')}</div>`;
}
