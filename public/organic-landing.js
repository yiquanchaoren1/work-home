// The natural homepage is a spacious entrance; work pages keep their sidebar.
export function renderOrganicLanding({icon,theme='light'}) {
 const leaf=`<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 18C1 9 12 5 20 3c-1 10-5 18-15 15Z" fill="currentColor"/><path d="M4 21 15 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
 return `<nav class="organic-landing-nav" aria-label="首页导航"><a class="organic-wordmark" href="#dashboard">${leaf}<span>Bing‘ <em>House</em></span></a><div class="organic-entry-links"><a href="#tasks">工作事项</a><a href="#notes">知识文档</a><a href="#archives">工作档案</a><a href="https://yiquanchaoren1.github.io/" target="_blank" rel="noopener noreferrer">旧博客 ↗</a></div><div class="organic-landing-tools"><button type="button" class="icon-button" data-action="theme-picker" aria-label="选择视觉主题" title="选择视觉主题">◈</button><button type="button" class="icon-button" data-action="theme-toggle" aria-label="${theme==='dark'?'切换到浅色主题':'切换到深色主题'}" title="切换明暗">${theme==='dark'?'☀':'☾'}</button></div></nav>
 <section class="organic-landing" aria-label="Bing‘ House 欢迎页">
 <div class="organic-blob organic-blob-clay" aria-hidden="true"></div><div class="organic-blob organic-blob-sage" aria-hidden="true"></div><div class="organic-blob organic-blob-linen" aria-hidden="true"></div>
 <span class="organic-leaf organic-leaf-one" aria-hidden="true">${leaf}</span><span class="organic-leaf organic-leaf-two" aria-hidden="true">${leaf}</span>
 <div class="organic-landing-copy"><p class="organic-welcome-label">${leaf}<span>工作 · 阅读 · 自我生长</span></p><h1>Bing‘<br><span>House.</span></h1><p class="organic-introduction">把正在做的事，和慢慢想明白的事，<br class="organic-desktop-break">留在一间属于自己的工作室。</p><div class="organic-entry-actions"><a class="button primary" href="#tasks">${leaf}进入工作间</a><a class="button secondary" href="#notes">${icon('book')}翻开知识库</a></div></div>
 <a class="organic-scroll-cue" href="#tasks" aria-label="查看工作事项">从一件小事开始 ${icon('arrow')}</a>
 </section>`;
}
