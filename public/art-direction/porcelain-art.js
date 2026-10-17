// Original SVG study: ink, negative space and an unglazed silhouette. No image requests.
export function porcelainArtwork(){
  return `<figure class="collage porcelain-art" aria-label="原创抽象水墨：山形、白瓷与朱印">
    <svg viewBox="0 0 720 370" role="img" aria-labelledby="porcelain-art-title porcelain-art-description">
      <title id="porcelain-art-title">山与器</title><desc id="porcelain-art-description">不规则墨迹与极淡的圆相相接，中间留出一只白瓷器物，朱红印记落在右下。</desc>
      <defs>
        <filter id="ink-edge" x="-12%" y="-18%" width="128%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".035 .12" numOctaves="3" seed="17" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="4.5" xChannelSelector="R" yChannelSelector="G"/></filter>
        <filter id="distant-ink" x="-10%" y="-25%" width="120%" height="160%"><feGaussianBlur stdDeviation="1.7"/></filter>
        <linearGradient id="ink-wash" x1="0" x2=".95" y1=".12" y2=".95"><stop stop-color="#202724"/><stop offset=".55" stop-color="#3a423d"/><stop offset="1" stop-color="#8e9690" stop-opacity=".28"/></linearGradient>
        <linearGradient id="porcelain-wash" x1="0" x2="1" y1=".1" y2=".7"><stop stop-color="#fff"/><stop offset=".55" stop-color="#f8faf6"/><stop offset="1" stop-color="#e3e8df"/></linearGradient>
        <linearGradient id="dry-ink" x1="0" x2="1"><stop stop-color="#202724" stop-opacity=".9"/><stop offset="1" stop-color="#6b756e" stop-opacity=".05"/></linearGradient>
      </defs>
      <circle cx="442" cy="167" r="119" fill="none" stroke="#dce1d7" stroke-width=".9"/>
      <path d="M343 110c25-45 85-75 133-53" fill="none" stroke="#cbd2c5" stroke-width=".6"/>
      <g filter="url(#distant-ink)" fill="#667166" opacity=".11"><path d="M68 228c27-25 31-28 57-36 32-9 27-40 56-38 16 1 34 21 56 8 36-23 48-53 70-37 21 15 38 40 69 41 37 1 46 42 77 54l-51 35Z"/><path d="M194 252c39-50 60-29 102-58s48-10 69-7c25 4 36 47 65 48l-32 37Z"/></g>
      <g filter="url(#ink-edge)">
        <path d="M73 231c18-7 27-27 46-35 27-12 21-51 46-45 14 3 20 22 34 8 11-12 8-39 22-40 19-1 22 29 40 20 22-11 21-48 45-37 13 6 14 42 32 46 17 4 22-13 31-8 13 6 13 36 34 44l32 49-61 34-173-8-78 13Z" fill="url(#ink-wash)"/>
        <path d="M102 241c37-18 44-1 77-15 31-12 41-38 63-30 19 7 40 28 62 19 23-9 33-38 52-27 20 11 25 32 63 35" fill="none" stroke="#252d26" stroke-width="13" opacity=".27"/>
        <path d="M89 271c44-17 78-8 129-8 48-1 73 13 123 5 30-4 63-15 103-7" fill="none" stroke="url(#dry-ink)" stroke-width="5"/>
        <path d="M120 286c49-11 96 1 145-3 28-2 50-9 89-5" fill="none" stroke="#4b564b" stroke-width="1.3" opacity=".55"/>
      </g>
      <g fill="#f8f9f5" opacity=".48"><path d="m155 204 25-19-13 27-8 12 5-20Z"/><path d="m214 172 11-24 9 18-5-9-8 25Z"/><path d="m290 158 12-40 5 22-4-8Z"/><path d="m343 193 13-19 6 16-8-6Z"/><path d="m191 239 21-10-16 15Z"/></g>
      <g fill="#3d473e" opacity=".27"><circle cx="115" cy="189" r="1"/><circle cx="109" cy="205" r=".7"/><circle cx="219" cy="113" r=".8"/><circle cx="309" cy="88" r=".9"/><circle cx="377" cy="177" r=".8"/><path d="m132 254 4-1m37-18 3 2m87-40 2-5m49 51 5-1m-4-67 3 1" stroke="#253026" stroke-width="1.5"/></g>
      <g class="porcelain-vessel">
        <path d="M417 145c2 22-7 36-24 56-13 15-24 32-18 50 7 23 26 29 63 29s56-6 63-29c6-18-5-35-18-50-17-20-26-34-24-56Z" fill="url(#porcelain-wash)" stroke="#dce2d7" stroke-width=".9"/>
        <ellipse cx="438" cy="145" rx="21" ry="4.4" fill="#eff3eb" stroke="#d2d9cb" stroke-width=".7"/>
        <path d="M417 151c10 4 32 4 42 0M396 238c-2 15 7 23 15 26" fill="none" stroke="#fff" stroke-width="1.4"/>
        <path d="M431 274c14 1 26 0 34-3" fill="none" stroke="#cad4c3" stroke-width=".8" opacity=".65"/>
      </g>
      <path d="M93 302c128-2 253 2 416-2" fill="none" stroke="#d5dcd0" stroke-width=".5"/>
      <circle cx="560" cy="90" r="9.5" fill="#a7473a" opacity=".92"/>
      <g transform="translate(580 249) rotate(2)" fill="none" stroke="#a7473a"><path d="m0 1 27-1 1 43-28 1Z" stroke-width="1.2"/><path d="M4 5h18v33H4z" stroke-width=".5" opacity=".65"/><path d="M8 10v22m4-23h7v23h-7m1-17h5m-5 6h5m-5 6h5" stroke-width="1.2"/><path d="m1 11 1 4m23 10 2-3M8 42l4 1" stroke="var(--paper)" stroke-width="1.5"/></g>
      <text x="635" y="123" fill="#8b9388" font-family="KaiTi,STKaiti,serif" font-size="11" letter-spacing="8" style="writing-mode:vertical-rl">山与器</text>
    </svg>
    <figcaption class="art-caption"><span>无题 · 山与器</span><span>墨色 ／ 瓷白 ／ 朱印　　习作 〇一</span></figcaption>
  </figure>`;
}
