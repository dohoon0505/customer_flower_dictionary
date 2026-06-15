/* ================================================================
   꽃배달 상담 챗봇 — 임베드 설치 스크립트 (embed.js)
   v1.0.0
   ----------------------------------------------------------------
   어떤 웹사이트든 아래 한 줄만 넣으면 우하단 "상담하기" 버튼과
   우측 슬라이드 패널(iframe 챗봇)이 설치됩니다.

     <script src="https://YOUR-HOST/assets/chatbot/embed.js" defer></script>

   설정(선택, script 태그의 data-* 속성):
     data-title     헤더 제목            (기본: 꽃배달 상담 도우미)
     data-subtitle  헤더 부제            (기본: 도랑플라워 · 전국 당일배송 안내)
     data-accent    포인트 색(hex)       (기본: #e60023)
     data-label     버튼 글자            (기본: 상담하기)
     data-position  left | right         (기본: right)
     data-src       챗봇 iframe 경로 직접 지정(기본: embed.js 위치 기준 자동)
     data-api       LLM 백엔드 엔드포인트(있으면 iframe 에 ?api= 로 전달)
     data-open      "true"면 처음부터 열림
   ================================================================ */
(function () {
  'use strict';
  if (window.__flowerChatLoaded) return;       // 중복 설치 방지
  window.__flowerChatLoaded = true;

  /* ---- 스크립트 자기 위치 파악 ---- */
  var self = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    for (var i = s.length - 1; i >= 0; i--) if (/embed\.js(\?|#|$)/.test(s[i].src)) return s[i];
    return null;
  })();
  var src = self ? self.src : '';
  var d = function (k, fb) { return (self && self.getAttribute('data-' + k)) || fb; };

  /* ---- iframe 경로: embed.js 위치(assets/chatbot/)에서 가이드 루트의 chatbot.html 도출 ---- */
  var iframeBase = d('src', src.replace(/assets\/chatbot\/embed\.js(?:\?.*)?$/, 'chatbot.html'));
  if (iframeBase === src) iframeBase = src.replace(/[^/]*$/, '') + 'chatbot.html'; // 폴백

  /* ---- 설정 ---- */
  var CFG = {
    title:    d('title', '꽃배달 상담 도우미'),
    subtitle: d('subtitle', ''),
    accent:   d('accent', '#e60023'),
    label:    d('label', '상담하기'),
    position: d('position', 'right') === 'left' ? 'left' : 'right',
    api:      d('api', ''),
    openInit: d('open', '') === 'true'
  };

  /* ---- iframe URL 조립 ---- */
  function iframeURL() {
    var u = iframeBase;
    var p = [];
    if (CFG.title)    p.push('title=' + encodeURIComponent(CFG.title));
    if (CFG.subtitle) p.push('subtitle=' + encodeURIComponent(CFG.subtitle));
    if (CFG.api)      p.push('api=' + encodeURIComponent(CFG.api));
    if (p.length) u += (u.indexOf('?') === -1 ? '?' : '&') + p.join('&');
    return u;
  }

  /* ---- 스타일 주입(부모 페이지와 충돌 없도록 모두 dfcw- 접두) ---- */
  var side = CFG.position;                                  // 'right' | 'left'
  var slideOut = side === 'left' ? 'translateX(-100%)' : 'translateX(100%)';   // 닫힘 위치
  var shadow = side === 'left' ? '8px 0 40px rgba(0,0,0,.16)' : '-8px 0 40px rgba(0,0,0,.16)';
  var css = [
    '.dfcw-fab{position:fixed;' + side + ':24px;bottom:24px;z-index:2147483000;display:inline-flex;align-items:center;gap:8px;',
    'height:54px;padding:0 22px 0 18px;border:0;border-radius:9999px;cursor:pointer;',
    'background:' + CFG.accent + ';color:#fff;font:700 15px/1 "Inter","Pretendard Variable",Pretendard,-apple-system,system-ui,sans-serif;',
    'box-shadow:0 8px 24px rgba(0,0,0,.22);transition:transform .18s cubic-bezier(.23,1,.32,1),box-shadow .2s,opacity .2s;}',
    '.dfcw-fab:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.28);}',
    '.dfcw-fab:active{transform:scale(.96);}',
    '.dfcw-fab svg{width:22px;height:22px;}',
    '.dfcw-fab.dfcw-hide{opacity:0;transform:scale(.6);pointer-events:none;}',

    // 화면 우측(또는 좌측)에 꽉 차는 풀하이트 패널 — 가장자리에서 슬라이드 인
    '.dfcw-panel{position:fixed;top:0;bottom:0;' + side + ':0;z-index:2147483001;',
    'width:420px;max-width:100vw;height:100vh;height:100dvh;',
    'background:#fff;overflow:hidden;box-shadow:' + shadow + ';',
    'transform:' + slideOut + ';pointer-events:none;',
    'transition:transform .34s cubic-bezier(.22,1,.32,1);}',
    '.dfcw-panel.dfcw-open{transform:translateX(0);pointer-events:auto;}',
    '.dfcw-panel iframe{width:100%;height:100%;border:0;display:block;background:#fbfbf9;}',

    '@media (max-width:520px){',
    '.dfcw-panel{width:100vw;}',
    '.dfcw-fab{' + side + ':16px;bottom:16px;}',
    '}',
    '@media (prefers-reduced-motion:reduce){',
    '.dfcw-panel{transition:transform .15s linear;}',
    '}'
  ].join('');
  var styleEl = document.createElement('style');
  styleEl.setAttribute('data-flower-chat', '');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---- FAB(상담하기 버튼) ---- */
  var fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'dfcw-fab';
  fab.setAttribute('aria-label', CFG.label);
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 11.5a8.5 8.5 0 01-12.2 7.7L3 21l1.8-5.8A8.5 8.5 0 1121 11.5z"/></svg>' +
    '<span>' + escapeText(CFG.label) + '</span>';

  /* ---- 패널 + iframe (지연 로드: 처음 열 때 src 주입) ---- */
  var panel = document.createElement('div');
  panel.className = 'dfcw-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', CFG.title);
  var frame = document.createElement('iframe');
  frame.title = CFG.title;
  frame.setAttribute('allow', 'clipboard-write');
  frame.setAttribute('loading', 'lazy');
  panel.appendChild(frame);

  function mount() {
    document.body.appendChild(fab);
    document.body.appendChild(panel);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  /* ---- 열고 닫기 ---- */
  var loaded = false, isOpen = false;
  function open() {
    if (!loaded) { frame.src = iframeURL(); loaded = true; }
    panel.classList.add('dfcw-open');
    fab.classList.add('dfcw-hide');
    isOpen = true;
    setTimeout(function () {
      try { frame.contentWindow.postMessage({ source: 'flower-chat-host', type: 'opened' }, '*'); } catch (e) {}
    }, 300);
  }
  function close() {
    panel.classList.remove('dfcw-open');
    fab.classList.remove('dfcw-hide');
    isOpen = false;
  }
  function toggle() { isOpen ? close() : open(); }

  fab.addEventListener('click', toggle);

  // iframe(챗봇) → 부모: 닫기 요청
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.source !== 'flower-chat') return;
    if (m.type === 'close') close();
  });

  // ESC 로 닫기
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) close();
  });

  // 외부 제어용 전역 API
  window.FlowerChat = { open: open, close: close, toggle: toggle };

  if (CFG.openInit) (document.body ? open : addEventListener.bind(document, 'DOMContentLoaded', open))();

  function escapeText(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
