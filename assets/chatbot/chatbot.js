/* ================================================================
   꽃배달 상담 챗봇 — iframe 로직
   v1.0.0
   ----------------------------------------------------------------
   동작 개요
   1) 가이드의 system.json + analyses/{id}/chapter.json 을 그대로 읽어
      Q&A 지식베이스(KB)를 만든다 → 가이드 내용과 항상 동기화.
   2) 사용자가 입력하면 의도(인사·감사·연락처)를 먼저 보고,
      아니면 한국어 토큰 + 글자 바이그램 랭킹으로 KB에서 최적 답을 찾는다.
   3) (선택) window 설정에 LLM API 엔드포인트가 있으면 그쪽으로 위임,
      없으면 위 로컬 엔진으로 답한다. → 비밀키 없이 어디서든 임베드 가능.
   외부 의존성 없음. 단일 IIFE. 사용자/데이터 텍스트는 모두 escape.
   ================================================================ */
(function () {
  'use strict';

  /* ============ CONFIG ============ */
  var qs = new URLSearchParams(location.search);

  // 데이터 루트: chatbot.html 이 있는 디렉터리(= 가이드 루트). 서브경로 호스팅(GitHub Pages 등) 대응.
  var DATA_ROOT = qs.get('root') || location.href.replace(/[^/]*(?:\?[^#]*)?(?:#.*)?$/, '');

  var CONTACT = {
    phone: '1668-1840',
    kakao: 'https://pf.kakao.com/_xmcrwn',
    site:  'https://dorangflower.com/'
  };

  // 선택: 실제 LLM 백엔드 엔드포인트. ?api=https://... 로 주면 그쪽에 위임.
  // 응답은 { reply: "...", refs?: [{title,route}] } 형태를 기대(자유 변경 가능).
  var API_URL = qs.get('api') || (window.FLOWER_CHAT_CONFIG && window.FLOWER_CHAT_CONFIG.api) || '';

  /* ============ DOM ============ */
  var logEl   = document.getElementById('dfc-log');
  var chipsEl = document.getElementById('dfc-chips');
  var formEl  = document.getElementById('dfc-form');
  var inputEl = document.getElementById('dfc-input');
  var sendEl  = document.getElementById('dfc-send');

  // 헤더 CTA 의 실제 연락처를 상수와 동기화
  var callEl = document.getElementById('dfc-call');
  if (callEl) callEl.setAttribute('href', 'tel:' + CONTACT.phone);
  var kakaoEl = document.getElementById('dfc-kakao');
  if (kakaoEl) kakaoEl.setAttribute('href', CONTACT.kakao);

  /* ============ UTILITIES ============ */
  function escapeHtml(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }
  // 검색용 정규화: 소문자 + 영숫자/한글 외 제거
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^0-9a-z가-힣]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // 한국어 조사·동사어미 제거(긴 것부터). "오아시스가"→"오아시스", "취소하고"→"취소", "관리하는"→"관리"
  var PARTICLES = ['해주세요', '해드려요', '으로서', '으로써', '이에요', '로부터', '이라고', '하세요', '했어요',
    '하려고', '하려면', '해줘요', '해줄래', '합니다', '습니다',
    '으로', '에서', '에게', '한테', '께서', '부터', '까지', '마다', '처럼', '만큼', '라고', '예요', '에요',
    '이나', '거나', '하고', '하면', '하는', '하지', '해서', '해요', '해줘', '했어', '하기', '하니',
    '은', '는', '이', '가', '을', '를', '에', '와', '과', '도', '만', '의', '요', '고', '며', '면', '해', '한', '할']
    .sort(function (a, b) { return b.length - a.length; });  // 긴 어미부터 그리디 매칭
  // 주제가 없는 의문 프레임 단어는 통째로 버림(노이즈 제거)
  var STOP = { '되나요': 1, '있나요': 1, '하나요': 1, '인가요': 1, '될까요': 1, '뭐예요': 1, '뭔가요': 1,
    '어때요': 1, '어떻게': 1, '어떤': 1, '무엇': 1, '있어': 1, '되나': 1, '싶어': 1, '인지': 1, '맞나요': 1,
    '해요': 1, '할까요': 1, '할래요': 1, '알려줘': 1, '알려주세요': 1, '돼요': 1, '되요': 1, '그냥': 1, '정말': 1 };
  function stem(t) {
    for (var i = 0; i < PARTICLES.length; i++) {
      var p = PARTICLES[i];
      if (t.length > p.length + 1 && t.slice(-p.length) === p) return t.slice(0, -p.length);
    }
    return t;
  }
  function tokens(s) {
    return norm(s).split(' ').filter(function (t) { return t.length >= 2; });
  }
  // 매칭·DF 용 토큰(불용어 제거 → 조사·어미 제거)
  function stems(s) {
    return tokens(s).filter(function (t) { return !STOP[t]; })
      .map(stem).filter(function (t) { return t.length >= 2 && !STOP[t]; });
  }
  function bigrams(s) {
    var t = norm(s).replace(/\s+/g, '');
    var out = [];
    for (var i = 0; i < t.length - 1; i++) out.push(t.substr(i, 2));
    return out;
  }
  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  /* ============ KNOWLEDGE BASE ============ */
  var KB = [];            // [{title, body, artTitle, chTitle, route, hay}]
  var READY = false;
  var chapters = [];      // system.json chapters

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' → ' + r.status);
      return r.json();
    });
  }

  // 한 챕터를 KB 항목들로 펼친다.
  function indexChapter(meta, ch) {
    if (!ch || !Array.isArray(ch.articles)) return;
    var chTitle = meta.title || ch.title || '';
    ch.articles.forEach(function (art) {
      var artTitle = art.title || '';
      var route = 'chapter/' + meta.id + '/' + art.id;
      var add = function (title, body) {
        body = String(body || '').trim();
        if (!body) return;
        // 가격이 숫자로만 적혀 있어 "얼마/가격" 질문과 안 잡히는 문제를 동의어로 보강(검색 전용)
        var isPrice = /\d[\d,]{2,}\s*원|\d+\s*만\s*원/.test(body);
        var priceSyn = isPrice ? ' 가격 얼마 비용 금액 요금 ' : '';
        KB.push({
          title: (title || artTitle).trim(),
          body: body,
          artTitle: artTitle,
          chTitle: chTitle,
          route: route,
          isPrice: isPrice,
          hay: norm([title, body, artTitle, chTitle, (art.keywords || []).join(' ')].join(' ') + priceSyn)
        });
      };

      // 아티클 요약 자체도 하나의 답변 단위
      if (art.summary) add(artTitle, art.summary);

      var lastHeading = artTitle;
      (art.blocks || []).forEach(function (b) {
        if (b.type === 'heading') { lastHeading = b.value || lastHeading; return; }
        if (b.type === 'text' || b.type === 'note') { add(lastHeading, b.value); return; }
        if (b.type === 'structure' || b.type === 'steprail') {
          (b.items || []).forEach(function (it) {
            var t = it.label || lastHeading;
            var d = it.desc || it.value || '';
            if (it.tag) d = '[' + it.tag + '] ' + d;
            add(t, d);
          });
          return;
        }
        if (b.type === 'kv') {
          (b.items || []).forEach(function (it) { add(it.label || lastHeading, it.value); });
          return;
        }
        if (b.type === 'stats') {
          (b.items || []).forEach(function (it) {
            add(it.label || lastHeading, [it.number, it.suffix, it.label].filter(Boolean).join(' '));
          });
          return;
        }
        if (b.type === 'region-table') {
          // regions[].areas[].{name,fee} → 권역별로 "지역명 N원" 목록을 만들어 지역 검색 대응
          (b.regions || []).forEach(function (rg) {
            var parts = (rg.areas || []).map(function (a) {
              var fee = a.fee ? (a.fee.toLocaleString ? a.fee.toLocaleString() : a.fee) + '원 추가' : '추가 없음';
              return a.name + ' ' + fee;
            });
            if (parts.length) add((rg.name || '') + ' 지역 추가배송비', parts.join(' · '));
          });
          return;
        }
      });
    });
  }

  function loadKB() {
    return fetchJSON(DATA_ROOT + 'system.json').then(function (sys) {
      chapters = sys.chapters || [];
      return Promise.all(chapters.map(function (c) {
        return fetchJSON(DATA_ROOT + c.data).then(function (ch) { indexChapter(c, ch); })
          .catch(function () { /* 한 챕터 실패는 무시 */ });
      }));
    }).then(function () {
      buildDF();
      READY = true;
      window.__kbReady = true;
    }).catch(function () {
      // 데이터 로드 실패(오프라인·file://) → 최소 KB로라도 동작
      seedFallbackKB();
      buildDF();
      READY = true;
      window.__kbReady = true;
    });
  }

  /* 문서빈도(DF) — 흔한 단어("받을·있어·되나요")는 낮게, 희소 단어("환불·근조화환")는
     높게 가중하기 위한 IDF 계산용. KB 완성 후 한 번만 집계. */
  var DF = Object.create(null), NDOCS = 1;
  function buildDF() {
    NDOCS = KB.length || 1;
    KB.forEach(function (e) {
      var seen = Object.create(null);
      stems(e.title + ' ' + e.body).forEach(function (t) {
        if (seen[t]) return;
        seen[t] = 1;
        DF[t] = (DF[t] || 0) + 1;
      });
    });
  }
  function idf(t) {
    // clamp: 한 번만 등장하는 우연한 희소어가 점수를 독점하지 않도록 상한을 둔다
    var v = Math.log((NDOCS + 1) / ((DF[t] || 0) + 1)) + 0.35;
    return Math.max(0.5, Math.min(4.5, v));
  }

  // 데이터 로드 실패 시에도 핵심 질문엔 답하도록 하는 최소 지식
  function seedFallbackKB() {
    if (KB.length) return;
    var seed = [
      ['당일배송 마감 시간', '평일은 오후 7시, 공휴일은 오후 6시 이전 주문이 일반 상품 당일배송 기준이고, 근조화환은 오후 6시 반(18:30)까지입니다. 마감 후에는 다음 날 오전부터 배송됩니다.', '시간 맞춰 배송 받기'],
      ['결제 수단', '계좌이체·무통장입금, 신용카드, 간편결제가 가능하며 일부 업체는 해외카드도 지원합니다. 세금계산서·현금영수증도 발급됩니다.', '주문하고 결제하기'],
      ['주문 방법', '전화(' + CONTACT.phone + '), 카카오톡 채널, 홈페이지 세 가지로 주문할 수 있습니다. 회원가입 없이 전화 한 통이면 접수·결제·배송·완료사진까지 처리됩니다.', '주문하고 결제하기'],
      ['장례식장에 보내기', '장례식장명과 빈소 호수, 고인 또는 상주 성함이 있으면 됩니다. 발인 전(가능하면 첫날~둘째날 오전)에 도착하도록 신청하세요.', '상황별 상품 추천']
    ];
    seed.forEach(function (s) {
      KB.push({ title: s[0], body: s[1], artTitle: s[0], chTitle: s[2], route: '', hay: norm(s.join(' ')) });
    });
  }

  /* ============ RETRIEVAL ============ */
  function score(entry, q) {
    var s = 0, i, anyHit = false;
    var titleN = norm(entry.title);
    var bodyN = norm(entry.body);
    var artN = norm(entry.artTitle);
    var has = function (t) {
      return titleN.indexOf(t) !== -1 || bodyN.indexOf(t) !== -1 || artN.indexOf(t) !== -1 || entry.hay.indexOf(t) !== -1;
    };
    // 토큰(조사 제거) 매칭, IDF 가중: 제목 > 아티클제목 > 본문 > 그 외. 희소 단어일수록 큰 점수.
    for (i = 0; i < q.toks.length; i++) {
      var t = q.toks[i], w = idf(t);
      if (titleN.indexOf(t) !== -1) { s += 3.4 * w; anyHit = true; }
      else if (artN.indexOf(t) !== -1) { s += 1.7 * w; anyHit = true; }  // 아티클 주제 일치(가격 kv 등 구제)
      else if (bodyN.indexOf(t) !== -1) { s += 1.4 * w; anyHit = true; }
      else if (entry.hay.indexOf(t) !== -1) { s += 0.6 * w; anyHit = true; }
    }
    // 주제어(가장 희소한 질의어)를 담은 항목을 강하게 우대
    for (i = 0; i < q.rare.length; i++) {
      if (has(q.rare[i])) s += 2.6 * idf(q.rare[i]);
    }
    // 글자 바이그램(어미·복합어 변형 흡수)
    var bt = 0, bh = 0;
    for (i = 0; i < q.bigr.length; i++) {
      if (titleN.indexOf(q.bigr[i]) !== -1) bt++;
      else if (entry.hay.indexOf(q.bigr[i]) !== -1) bh++;
    }
    s += bt * 1.0 + bh * 0.2;
    // 가격 의도("얼마/가격…") + 가격이 적힌 항목 + 주제 일치 → 가격 답으로 유도
    if (q.priceIntent && entry.isPrice && anyHit) s += 10;
    // 전체 질문이 제목에 통째로 들어가면 강한 보너스
    if (q.norm.length >= 3 && titleN.indexOf(q.norm) !== -1) s += 16;
    // 질문형 제목(FAQ) 살짝 우대
    if (/[?？]\s*$/.test(entry.title)) s += 1.5;
    return s;
  }

  function search(query) {
    var toks = uniq(stems(query));
    var q = {
      toks: toks,
      bigr: uniq(bigrams(query)),
      norm: norm(query),
      priceIntent: /얼마|가격|비용|금액|요금|얼마예요/.test(norm(query)),
      // 희소도(IDF) 상위 2개 = 질문의 주제어
      rare: toks.slice().sort(function (a, b) { return idf(b) - idf(a); }).slice(0, 2)
    };
    if (!q.toks.length && !q.bigr.length) return [];
    var ranked = KB.map(function (e) { return { e: e, s: score(e, q) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });
    // route+title 중복 제거
    var seen = {}, out = [];
    for (var i = 0; i < ranked.length && out.length < 6; i++) {
      var key = ranked[i].e.route + '|' + ranked[i].e.title;
      if (seen[key]) continue;
      seen[key] = 1;
      out.push(ranked[i]);
    }
    return out;
  }

  /* ============ INTENTS ============ */
  function detectIntent(q) {
    var n = norm(q);
    if (!n) return null;
    if (/(안녕|하이|반가|처음|hello|hi)/.test(n) && n.length <= 12) return 'greet';
    if (/(고마|감사|땡큐|thank)/.test(n)) return 'thanks';
    if (/(전화|연락처|상담원|통화|번호|문의|콜)/.test(n)) return 'contact';
    if (/(상담|도와|도움|뭐.?할|어떻게.?시작|메뉴)/.test(n) && n.length <= 14) return 'help';
    return null;
  }

  /* ============ ANSWER COMPOSITION ============ */
  // 답변 객체: { html, chips:[문자열], delay }
  function localAnswer(query) {
    var intent = detectIntent(query);
    if (intent === 'greet')   return { html: '안녕하세요! 🌸 꽃 주문이 처음이셔도 괜찮아요. 배송 시간, 상품 추천, 가격, 결제, 취소·환불 무엇이든 편하게 물어보세요.', chips: starterChips() };
    if (intent === 'thanks')  return { html: '도움이 되었다니 기뻐요. 🌷 더 궁금한 점이 있으면 언제든 물어봐 주세요!', chips: starterChips().slice(0, 3) };
    if (intent === 'contact' || intent === 'help') return { html: contactHtml(intent === 'help' ? '아래로 바로 상담·주문하실 수 있어요.' : '전화·카카오톡·홈페이지로 바로 상담하실 수 있어요.'), chips: starterChips().slice(0, 4) };

    var hits = search(query);
    if (!hits.length || hits[0].s < 7) {
      return {
        html: '음… 그 부분은 제가 콕 집어 답하기 어렵네요. 😅 아래 자주 찾는 주제에서 골라보시거나, 정확한 안내는 전화 상담을 이용해 주세요.' + contactHtml(''),
        chips: starterChips()
      };
    }

    var top = hits[0].e;
    var html = '';
    // 제목이 질문/주제로서 의미가 있으면 머리줄로
    if (top.title && norm(top.title) !== norm(top.body) && top.title.length <= 60) {
      html += '<span class="dfc-topic">' + escapeHtml(top.title) + '</span>';
    }
    html += escapeHtml(top.body);
    // 가이드 원문 링크
    if (top.route) {
      var url = DATA_ROOT + 'index.html#' + top.route;
      html += '<a class="dfc-ref" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">📖 ' +
        escapeHtml(top.chTitle) + '에서 자세히 보기 →</a>';
    }
    // 관련 질문 칩 (다음 후보들의 제목)
    var related = [];
    for (var i = 1; i < hits.length && related.length < 3; i++) {
      var t = hits[i].e.title;
      if (t && t.length <= 28 && norm(t) !== norm(top.title)) related.push(t);
    }
    return { html: html, chips: related.length ? related : starterChips().slice(0, 3) };
  }

  function contactHtml(lead) {
    var h = lead ? escapeHtml(lead) : '';
    h += '<div class="dfc-contact">' +
      '<a href="tel:' + CONTACT.phone + '"><span>전화</span><span>' + CONTACT.phone + ' · 상담·주문 한 번에</span></a>' +
      '<a href="' + CONTACT.kakao + '" target="_blank" rel="noopener noreferrer"><span>카톡</span><span>카카오톡 채널로 상담하기</span></a>' +
      '<a href="' + CONTACT.site + '" target="_blank" rel="noopener noreferrer"><span>주문</span><span>dorangflower.com 바로가기</span></a>' +
      '</div>';
    return h;
  }

  function starterChips() {
    return [
      '당일배송 마감 몇 시예요?',
      '근조화환 가격이 궁금해요',
      '결제 수단은 뭐가 있나요?',
      '장례식장에 보내려면?',
      '취소·환불 되나요?',
      '꽃다발은 얼마예요?'
    ];
  }

  /* ============ CHAT UI ============ */
  function scrollDown() { logEl.scrollTop = logEl.scrollHeight; }

  function addUser(text) {
    var row = document.createElement('div');
    row.className = 'dfc-row dfc-row--user';
    var b = document.createElement('div');
    b.className = 'dfc-bubble';
    b.textContent = text;
    row.appendChild(b);
    logEl.appendChild(row);
    scrollDown();
  }

  function addBot(html) {
    var row = document.createElement('div');
    row.className = 'dfc-row dfc-row--bot';
    var b = document.createElement('div');
    b.className = 'dfc-bubble';
    b.innerHTML = html;      // html 은 우리 코드가 escape 후 조립한 안전 문자열
    row.appendChild(b);
    logEl.appendChild(row);
    scrollDown();
  }

  function showTyping() {
    var row = document.createElement('div');
    row.className = 'dfc-row dfc-row--bot';
    row.id = 'dfc-typing-row';
    row.innerHTML = '<div class="dfc-bubble"><span class="dfc-typing"><i></i><i></i><i></i></span></div>';
    logEl.appendChild(row);
    scrollDown();
  }
  function hideTyping() {
    var r = document.getElementById('dfc-typing-row');
    if (r) r.parentNode.removeChild(r);
  }

  function renderChips(list) {
    chipsEl.innerHTML = '';
    (list || []).forEach(function (label) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dfc-chip';
      btn.textContent = label;
      btn.addEventListener('click', function () { submit(label); });
      chipsEl.appendChild(btn);
    });
  }

  /* ============ SEND FLOW ============ */
  var busy = false;
  function submit(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    busy = true;
    renderChips([]);
    addUser(text);
    inputEl.value = '';
    autosize();
    showTyping();

    var done = function (ans) {
      hideTyping();
      addBot(ans.html);
      renderChips(ans.chips || []);
      busy = false;
      inputEl.focus();
    };

    // 답변 지연을 살짝 둬 '입력 중' 느낌 (사고 시간)
    var think = 360 + Math.min(700, text.length * 18);

    if (API_URL) {
      remoteAnswer(text).then(function (ans) {
        setTimeout(function () { done(ans); }, 200);
      }).catch(function () {
        setTimeout(function () { done(localAnswer(text)); }, 200);
      });
    } else {
      var go = function () { setTimeout(function () { done(localAnswer(text)); }, think); };
      READY ? go() : loadKB().then(go);
    }
  }

  // (선택) 원격 LLM 호출
  function remoteAnswer(text) {
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    }).then(function (r) { return r.json(); }).then(function (data) {
      var html = escapeHtml(data.reply || data.answer || '');
      (data.refs || []).forEach(function (ref) {
        var url = DATA_ROOT + 'index.html#' + ref.route;
        html += '<a class="dfc-ref" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">📖 ' + escapeHtml(ref.title || '자세히 보기') + ' →</a>';
      });
      return { html: html || localAnswer(text).html, chips: data.chips || starterChips().slice(0, 3) };
    });
  }

  /* ============ COMPOSER BEHAVIOR ============ */
  function autosize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + 'px';
  }
  inputEl.addEventListener('input', autosize);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(inputEl.value); }
  });
  formEl.addEventListener('submit', function (e) { e.preventDefault(); submit(inputEl.value); });

  /* ============ PARENT (embed.js) 통신 ============ */
  function postToParent(type) {
    try { parent.postMessage({ source: 'flower-chat', type: type }, '*'); } catch (e) {}
  }
  document.getElementById('dfc-close').addEventListener('click', function () { postToParent('close'); });
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.source !== 'flower-chat-host') return;
    if (d.type === 'opened') inputEl.focus();
  });

  /* ============ INIT ============ */
  // 헤더 설정 오버라이드(?title= / ?subtitle=)
  if (qs.get('title')) document.getElementById('dfc-title').textContent = qs.get('title');
  if (qs.get('subtitle')) document.getElementById('dfc-subtitle').textContent = qs.get('subtitle');

  loadKB();                                   // 데이터 미리 로드
  addBot(localAnswer('안녕').html);            // 인사말
  renderChips(starterChips());
  postToParent('ready');
})();
