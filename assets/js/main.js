(function () {
  'use strict';

  /* ============ UTILITIES ============ */
  function escapeHtml(str) {
    if (str == null) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  /* ============ THEME ============ */
  function toggleTheme() {
    var body = document.body;
    var current = body.getAttribute('data-theme');
    var next = current === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', next);
    var icon = next === 'light' ? '☾' : '☀';
    var label = next === 'light' ? 'Dark' : 'Light';
    var sub = next === 'light' ? 'Light Mode' : 'Dark Mode';
    ['theme-icon', 'sidebar-theme-icon'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = icon;
    });
    ['theme-label', 'sidebar-theme-label'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = label;
    });
    var sbSub = document.getElementById('theme-sub');
    if (sbSub) sbSub.textContent = sub;
    try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
  }
  window.toggleTheme = toggleTheme;

  /* ============ FONT ZOOM ============ */
  function applyZoom(mode) {
    var body = document.body;
    if (mode === 'large') body.setAttribute('data-zoom', 'large');
    else body.removeAttribute('data-zoom');
    var label = mode === 'large' ? '기본글씨' : '큰글씨';
    var el = document.getElementById('zoom-label');
    if (el) el.textContent = label;
    document.querySelectorAll('.zoom-toggle').forEach(function (b) {
      b.setAttribute('aria-pressed', mode === 'large' ? 'true' : 'false');
    });
  }
  function toggleZoom() {
    var current = document.body.getAttribute('data-zoom');
    var next = current === 'large' ? 'normal' : 'large';
    applyZoom(next);
    try { localStorage.setItem('fontZoom', next); } catch (e) { /* private mode */ }
  }
  window.toggleZoom = toggleZoom;

  /* Restore persisted UI preferences before first paint logic runs. */
  (function restorePrefs() {
    try {
      var savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        document.body.setAttribute('data-theme', savedTheme);
        var icon = savedTheme === 'light' ? '☾' : '☀';
        var label = savedTheme === 'light' ? 'Dark' : 'Light';
        var sub = savedTheme === 'light' ? 'Light Mode' : 'Dark Mode';
        ['theme-icon', 'sidebar-theme-icon'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.textContent = icon;
        });
        ['theme-label', 'sidebar-theme-label'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.textContent = label;
        });
        var sbSub = document.getElementById('theme-sub');
        if (sbSub) sbSub.textContent = sub;
      }
      var savedZoom = localStorage.getItem('fontZoom');
      if (savedZoom === 'large') applyZoom('large');
    } catch (e) { /* private mode */ }
  })();

  /* ============ SIDEBAR (mobile) ============ */
  function toggleSidebar() {
    var sb = document.getElementById('sidebar');
    var scrim = document.querySelector('.sidebar-scrim');
    var isOpen = sb.classList.toggle('is-open');
    if (scrim) {
      if (isOpen) {
        scrim.classList.add('is-open');
        requestAnimationFrame(function () { scrim.classList.add('is-visible'); });
        document.body.style.overflow = 'hidden';
      } else {
        scrim.classList.remove('is-visible');
        setTimeout(function () { scrim.classList.remove('is-open'); }, 200);
        document.body.style.overflow = '';
      }
    }
  }
  window.toggleSidebar = toggleSidebar;

  function closeSidebar() {
    var sb = document.getElementById('sidebar');
    var scrim = document.querySelector('.sidebar-scrim');
    if (sb) sb.classList.remove('is-open');
    if (scrim) {
      scrim.classList.remove('is-visible');
      setTimeout(function () { scrim.classList.remove('is-open'); }, 200);
    }
    document.body.style.overflow = '';
  }
  window.closeSidebar = closeSidebar;

  function closeSidebarMobile() {
    if (window.matchMedia('(max-width: 1099px)').matches) closeSidebar();
  }

  /* ============ STATE ============ */
  var systemData = null;
  var chapterCache = {};
  var searchIndex = null;
  var searchState = { open: false, results: [], activeIdx: 0 };

  var homeHero = document.getElementById('home-hero');
  var homeSections = document.querySelectorAll('.home-section');
  var reportView = document.getElementById('report-view');
  var chapterNavList = document.getElementById('chapter-nav-list');
  var chapterGrid = document.getElementById('chapter-grid');

  /* ============ DATA LOADING ============ */
  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  function loadSystem() {
    return fetchJSON('system.json').then(function (data) {
      systemData = data;
      buildSidebar(data.chapters || []);
      buildHomeChapterGrid(data.chapters || []);
      return data;
    });
  }

  function loadChapter(chapterId) {
    if (chapterCache[chapterId]) return Promise.resolve(chapterCache[chapterId]);
    return fetchJSON('analyses/' + chapterId + '/chapter.json').then(function (data) {
      chapterCache[chapterId] = data;
      return data;
    });
  }

  /* ============ SIDEBAR BUILDING ============ */
  function buildSidebar(chapters) {
    if (!chapterNavList) return;
    if (!chapters.length) {
      chapterNavList.innerHTML = '<li class="sidebar-empty">목차가 비어 있습니다</li>';
      return;
    }
    var html = '';
    chapters.forEach(function (ch) {
      html += '<li class="sidebar-expandable" data-chapter="' + escapeHtml(ch.id) + '">';
      html += '<a class="sidebar-link" href="#chapter/' + escapeHtml(ch.id) + '" data-section="chapter/' + escapeHtml(ch.id) + '">';
      html += '<svg class="ico"><use href="#' + escapeHtml(ch.icon || 'i-book') + '"/></svg>';
      html += '<span>' + escapeHtml(ch.num) + '. ' + escapeHtml(ch.title) + '</span>';
      html += '<svg class="chevron" width="14" height="14"><use href="#i-chevron-down"/></svg>';
      html += '</a>';
      html += '<ul class="sidebar-sub" data-articles-for="' + escapeHtml(ch.id) + '">';
      html += '<li class="sidebar-empty">불러오는 중…</li>';
      html += '</ul></li>';
    });
    chapterNavList.innerHTML = html;
    syncCollapseAllState();
  }

  function fillChapterArticles(chapterId) {
    var ul = document.querySelector('.sidebar-sub[data-articles-for="' + chapterId + '"]');
    if (!ul || ul.dataset.filled === '1') return;
    loadChapter(chapterId).then(function (ch) {
      var articles = ch.articles || [];
      var html = '';
      if (!articles.length) {
        html = '<li class="sidebar-empty">콘텐츠 준비 중</li>';
      } else {
        articles.forEach(function (art) {
          var path = 'chapter/' + chapterId + '/' + art.id;
          html += '<li><a class="sidebar-link" href="#' + escapeHtml(path) + '" data-section="' + escapeHtml(path) + '">';
          html += '<span class="sidebar-sec-num">' + escapeHtml(art.num) + '</span>';
          html += '<span>' + escapeHtml(art.title) + '</span>';
          html += '</a></li>';
        });
      }
      ul.innerHTML = html;
      ul.dataset.filled = '1';
      // 현재 라우트에 맞춰 다시 강조
      var hash = location.hash.replace(/^#\/?/, '').trim();
      if (hash) highlightSidebar(hash);
    }).catch(function () {
      ul.innerHTML = '<li class="sidebar-empty">불러올 수 없습니다</li>';
      ul.dataset.filled = '1';
    });
  }

  /* ============ HOME CHAPTER GRID ============ */
  function buildHomeChapterGrid(chapters) {
    if (!chapterGrid) return;
    if (!chapters.length) {
      chapterGrid.innerHTML = '';
      return;
    }
    var html = '';
    chapters.forEach(function (ch) {
      html += '<a class="chapter-card" href="#chapter/' + escapeHtml(ch.id) + '">';
      html += '<div class="chapter-card-num">CHAPTER ' + escapeHtml(ch.num) + '</div>';
      html += '<h3>' + escapeHtml(ch.title) + '</h3>';
      html += '<div class="sub">' + escapeHtml(ch.subtitle || '') + '</div>';
      html += '<p>' + escapeHtml(ch.desc || '') + '</p>';
      html += '<div class="chapter-card-foot">';
      html += '<span class="chapter-card-articles" data-articles-count="' + escapeHtml(ch.id) + '">…</span>';
      html += '<span class="chapter-card-arrow"><svg class="ico"><use href="#i-arrow-right"/></svg></span>';
      html += '</div></a>';
    });
    chapterGrid.innerHTML = html;

    // article count는 chapter.json 로딩 후 채워줌
    chapters.forEach(function (ch) {
      loadChapter(ch.id).then(function (data) {
        var el = document.querySelector('[data-articles-count="' + ch.id + '"]');
        if (el) {
          var n = (data.articles || []).length;
          el.textContent = n === 0 ? '준비 중' : n + '개 아티클';
        }
      }).catch(function () {
        var el = document.querySelector('[data-articles-count="' + ch.id + '"]');
        if (el) el.textContent = '—';
      });
    });
  }

  /* ============ VIEWS ============ */
  function showHome() {
    if (homeHero) homeHero.style.display = '';
    homeSections.forEach(function (s) { s.style.display = ''; });
    if (reportView) { reportView.style.display = 'none'; reportView.innerHTML = ''; }
    highlightSidebar('home');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function hideHome() {
    if (homeHero) homeHero.style.display = 'none';
    homeSections.forEach(function (s) { s.style.display = 'none'; });
  }

  function showReport(html) {
    hideHome();
    if (reportView) {
      reportView.innerHTML = html;
      reportView.style.display = '';
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ============ BLOCK RENDERERS ============ */
  function renderBlock(block) {
    switch (block.type) {
      case 'heading':  return renderHeading(block);
      case 'text':     return renderText(block);
      case 'note':     return renderNote(block);
      case 'kv':       return renderKV(block);
      case 'stats':    return renderStats(block);
      case 'structure': return renderStructure(block);
      case 'steprail':  return renderSteprail(block);
      case 'image':         return renderImage(block);
      case 'image-slot':    return renderImageSlot(block);
      case 'region-table':  return renderRegionTable(block);
      default: return '';
    }
  }
  function renderImageSlot(b) {
    var h = '<div class="blk-image-slot">';
    h += '<div class="blk-image-slot-box">';
    h += '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    h += '<rect x="3" y="3" width="18" height="18" rx="2"/>';
    h += '<circle cx="8.5" cy="8.5" r="1.5"/>';
    h += '<path d="M21 15l-5-5L5 21"/>';
    h += '</svg>';
    h += '<span class="blk-image-slot-label">이미지 삽입 예정</span>';
    h += '</div>';
    if (b.guide) {
      h += '<div class="blk-image-slot-guide">';
      h += '<span class="blk-image-slot-guide-badge">디자인 가이드</span>';
      h += escapeHtml(b.guide);
      h += '</div>';
    }
    h += '</div>';
    return h;
  }
  function renderRegionTable(b) {
    var FEE_CLASS = { '20000': 'high', '10000': 'mid' };
    var h = '<div class="blk-region-table">';
    /* legend — none 항목 제외 */
    h += '<div class="blk-region-legend">';
    (b.legend || []).filter(function(l) { return l.tier !== 'none'; }).forEach(function(l) {
      h += '<span class="blk-region-legend-item">';
      h += '<span class="blk-region-legend-dot blk-region-legend-dot--' + escapeHtml(l.tier) + '"></span>';
      h += escapeHtml(l.label);
      h += '</span>';
    });
    h += '</div>';
    /* regions — fee=0 지역 표시 안 함 */
    (b.regions || []).forEach(function(region) {
      var visibleAreas = (region.areas || []).filter(function(a) { return a.fee > 0; });
      if (!visibleAreas.length) return;
      h += '<div class="blk-region-group">';
      h += '<div class="blk-region-group-name">' + escapeHtml(region.name) + '</div>';
      h += '<div class="blk-region-areas">';
      visibleAreas.forEach(function(area) {
        var tier = FEE_CLASS[String(area.fee)] || 'mid';
        h += '<span class="blk-region-area blk-region-area--' + tier + '">';
        h += escapeHtml(area.name);
        h += '<em>+' + (area.fee / 10000) + '만</em>';
        h += '</span>';
      });
      h += '</div></div>';
    });
    h += '</div>';
    return h;
  }
  function renderImage(b) {
    var h = '<figure class="blk-image">';
    h += '<img src="' + escapeHtml(b.src) + '" alt="' + escapeHtml(b.alt || '') + '" loading="lazy">';
    if (b.caption) h += '<figcaption class="blk-image-caption">' + escapeHtml(b.caption) + '</figcaption>';
    h += '</figure>';
    return h;
  }
  function renderHeading(b) {
    return '<h2 class="blk-heading">' + escapeHtml(b.value) + '</h2>';
  }
  function renderText(b) {
    return '<p class="blk-text">' + escapeHtml(b.value) + '</p>';
  }
  function renderNote(b) {
    return '<div class="blk-note"><div class="blk-note-icon">i</div><p>' + escapeHtml(b.value) + '</p></div>';
  }
  function renderKV(b) {
    var cols = b.columns || 1;
    var h = '';
    if (b.title) h += '<div class="blk-kv-title">' + escapeHtml(b.title) + '</div>';
    h += '<div class="blk-kv blk-kv--col' + cols + '">';
    (b.items || []).forEach(function (it) {
      h += '<div class="blk-kv-item">';
      h += '<dt>' + escapeHtml(it.label) + '</dt>';
      h += '<dd>' + escapeHtml(it.value) + '</dd>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }
  function renderStats(b) {
    var h = '<div class="blk-stats">';
    (b.items || []).forEach(function (it) {
      h += '<div class="blk-stat">';
      h += '<div class="blk-stat-number">' + escapeHtml(String(it.number));
      if (it.suffix) h += '<span class="blk-stat-suffix-inline" style="font-size:0.5em;margin-left:2px;">' + escapeHtml(it.suffix) + '</span>';
      h += '</div>';
      h += '<div class="blk-stat-label">' + escapeHtml(it.label) + '</div>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }
  function renderStructure(b) {
    var h = '<div class="blk-structure">';
    (b.items || []).forEach(function (it, i) {
      h += '<div class="blk-structure-row">';
      h += '<div class="blk-structure-index">' + (i + 1) + '</div>';
      h += '<div class="blk-structure-body">';
      h += '<div class="blk-structure-label">' + escapeHtml(it.label);
      if (it.tag) h += '<span class="blk-structure-tag">' + escapeHtml(it.tag) + '</span>';
      h += '</div>';
      h += '<div class="blk-structure-desc">' + escapeHtml(it.desc) + '</div>';
      h += '</div></div>';
    });
    h += '</div>';
    return h;
  }
  function renderSteprail(b) {
    var h = '<div class="blk-steprail">';
    if (b.title) h += '<div class="blk-steprail-title">' + escapeHtml(b.title) + '</div>';
    h += '<ol class="blk-steprail-list">';
    (b.items || []).forEach(function (it, i) {
      h += '<li class="blk-steprail-step">';
      h += '<div class="blk-steprail-num">' + (i + 1) + '</div>';
      h += '<div class="blk-steprail-body">';
      h += '<div class="blk-steprail-label">' + escapeHtml(it.label);
      if (it.tag) h += '<span class="blk-steprail-tag">' + escapeHtml(it.tag) + '</span>';
      h += '</div>';
      if (it.desc) h += '<div class="blk-steprail-desc">' + escapeHtml(it.desc) + '</div>';
      h += '</div></li>';
    });
    h += '</ol></div>';
    return h;
  }

  /* ============ REPORT RENDERING ============ */
  function renderChapterOverview(chapter) {
    var meta = findChapterMeta(chapter.id);
    var icon = (meta && meta.icon) || 'i-book';

    var h = '';
    h += '<div class="report-header">';
    h += '<a class="report-back" href="#">← 홈으로</a>';
    h += '<div class="report-meta">';
    h += '<span class="tag">CHAPTER ' + escapeHtml(chapter.num) + '</span>';
    h += '</div>';
    h += '<div class="report-section-header">';
    h += '<span class="report-section-header-num">' + escapeHtml(chapter.num) + '</span>';
    h += '<div>';
    h += '<h1 class="report-title">' + escapeHtml(chapter.title) + '</h1>';
    if (chapter.subtitle) h += '<p class="report-summary" style="margin:8px 0 0">' + escapeHtml(chapter.subtitle) + '</p>';
    h += '</div></div>';

    if (chapter.summary) {
      h += '<p class="report-summary" style="margin-top:24px">' + escapeHtml(chapter.summary) + '</p>';
    }

    if (chapter.objective) {
      h += '<div class="report-objective">';
      h += '<div class="report-objective-icon"><svg class="ico"><use href="#i-target"/></svg></div>';
      h += '<div class="report-objective-body">';
      h += '<div class="report-objective-label">학습 목표 · Objective</div>';
      h += '<p class="report-objective-text">' + escapeHtml(chapter.objective) + '</p>';
      h += '</div></div>';
    }
    h += '</div>';

    var articles = chapter.articles || [];
    if (articles.length === 0) {
      h += '<div class="article-list">';
      h += '<div class="article-empty">';
      h += '<h3>아티클 콘텐츠 준비 중</h3>';
      h += '<p>이 챕터의 본문은 아직 작성되지 않았습니다. <code>analyses/' + escapeHtml(chapter.id) + '/chapter.json</code>의 <code>articles</code> 배열을 채워주세요.</p>';
      h += '</div>';
      h += '</div>';
    } else {
      h += '<div class="article-list">';
      articles.forEach(function (art) {
        var path = 'chapter/' + chapter.id + '/' + art.id;
        h += '<a class="article-row" href="#' + escapeHtml(path) + '">';
        h += '<div class="article-row-num">' + escapeHtml(art.num) + '</div>';
        h += '<div class="article-row-body">';
        h += '<div class="article-row-title">' + escapeHtml(art.title) + '</div>';
        h += '<div class="article-row-summary">' + escapeHtml(art.summary || '') + '</div>';
        h += '</div>';
        h += '<div class="article-row-meta">';
        if (art.readTime) {
          h += '<svg class="ico"><use href="#i-clock"/></svg>' + escapeHtml(art.readTime);
        }
        h += '</div></a>';
      });
      h += '</div>';
    }

    h += renderChapterNav(chapter.id);
    return h;
  }

  function renderArticle(chapter, articleId) {
    var art = (chapter.articles || []).filter(function (a) { return a.id === articleId; })[0];
    if (!art) return renderNotFound('아티클을 찾을 수 없습니다.');

    var h = '';
    h += '<div class="report-header">';
    h += '<a class="report-back" href="#chapter/' + escapeHtml(chapter.id) + '">← ' + escapeHtml(chapter.title) + '</a>';
    h += '<div class="report-meta">';
    h += '<span class="tag">' + escapeHtml(chapter.title) + '</span>';
    if (art.readTime) h += '<span class="report-date"><svg class="ico" style="width:12px;height:12px;vertical-align:-2px;margin-right:4px"><use href="#i-clock"/></svg>' + escapeHtml(art.readTime) + '</span>';
    h += '</div>';
    h += '<div class="report-section-header">';
    h += '<span class="report-section-header-num">' + escapeHtml(art.num) + '</span>';
    h += '<h1 class="report-title">' + escapeHtml(art.title) + '</h1>';
    h += '</div>';
    if (art.summary) {
      h += '<p class="report-summary" style="margin-top:24px">' + escapeHtml(art.summary) + '</p>';
    }
    if (art.keywords && art.keywords.length) {
      h += '<div class="report-keywords"><span class="report-keywords-label">관련 키워드</span>';
      art.keywords.forEach(function (kw) {
        h += '<span class="report-keyword">' + escapeHtml(kw) + '</span>';
      });
      h += '</div>';
    }
    h += '</div>';

    h += '<div class="report-blocks">';
    if (art.blocks && art.blocks.length > 0) {
      art.blocks.forEach(function (b) { h += renderBlock(b); });
    } else {
      h += '<div class="placeholder-card"><h3>본문 준비 중</h3><p>이 아티클의 본문 블록이 비어 있습니다.</p></div>';
    }
    h += '</div>';

    // prev / next within chapter
    var arts = chapter.articles || [];
    var idx = -1;
    for (var i = 0; i < arts.length; i++) {
      if (arts[i].id === articleId) { idx = i; break; }
    }
    var prev = idx > 0 ? arts[idx - 1] : null;
    var next = idx >= 0 && idx < arts.length - 1 ? arts[idx + 1] : null;

    h += '<div class="report-nav">';
    if (prev) {
      h += '<a class="report-nav-link" href="#chapter/' + escapeHtml(chapter.id) + '/' + escapeHtml(prev.id) + '">';
      h += '<span class="report-nav-dir">← 이전 아티클</span>';
      h += '<span class="report-nav-label">' + escapeHtml(prev.num) + '. ' + escapeHtml(prev.title) + '</span>';
      h += '</a>';
    } else {
      h += '<span></span>';
    }
    if (next) {
      h += '<a class="report-nav-link report-nav-next" href="#chapter/' + escapeHtml(chapter.id) + '/' + escapeHtml(next.id) + '">';
      h += '<span class="report-nav-dir">다음 아티클 →</span>';
      h += '<span class="report-nav-label">' + escapeHtml(next.num) + '. ' + escapeHtml(next.title) + '</span>';
      h += '</a>';
    }
    h += '</div>';

    return h;
  }

  function renderChapterNav(currentId) {
    if (!systemData) return '';
    var chapters = systemData.chapters || [];
    var idx = -1;
    for (var i = 0; i < chapters.length; i++) {
      if (chapters[i].id === currentId) { idx = i; break; }
    }
    if (idx < 0) return '';
    var prev = idx > 0 ? chapters[idx - 1] : null;
    var next = idx < chapters.length - 1 ? chapters[idx + 1] : null;

    var h = '<div class="report-nav">';
    if (prev) {
      h += '<a class="report-nav-link" href="#chapter/' + escapeHtml(prev.id) + '">';
      h += '<span class="report-nav-dir">← 이전 챕터</span>';
      h += '<span class="report-nav-label">' + escapeHtml(prev.num) + '. ' + escapeHtml(prev.title) + '</span>';
      h += '</a>';
    } else {
      h += '<span></span>';
    }
    if (next) {
      h += '<a class="report-nav-link report-nav-next" href="#chapter/' + escapeHtml(next.id) + '">';
      h += '<span class="report-nav-dir">다음 챕터 →</span>';
      h += '<span class="report-nav-label">' + escapeHtml(next.num) + '. ' + escapeHtml(next.title) + '</span>';
      h += '</a>';
    }
    h += '</div>';
    return h;
  }

  function renderChangelog() {
    var releases = (systemData && systemData.releases) || [];
    var h = '';
    h += '<div class="report-header">';
    h += '<a class="report-back" href="#">← 홈으로</a>';
    h += '<div class="report-meta">';
    h += '<span class="tag">RELEASE NOTES</span>';
    h += '<span class="report-date">' + releases.length + ' releases</span>';
    h += '</div>';
    h += '<h1 class="report-title">릴리즈 노트</h1>';
    h += '<p class="report-summary">버전별 변경 내역을 시간 순으로 정리합니다. 새 기능·개선·수정 사항을 한눈에 확인할 수 있습니다.</p>';
    h += '</div>';

    if (releases.length === 0) {
      h += '<div class="article-list"><div class="article-empty"><h3>릴리즈 기록 없음</h3><p><code>system.json</code>의 <code>releases</code> 배열에 항목을 추가해 주세요.</p></div></div>';
      return h;
    }

    h += '<div class="changelog-list">';
    releases.forEach(function (rel) {
      h += '<div class="changelog-entry">';
      h += '<div class="changelog-rail">';
      h += '<div class="changelog-rail-dot"></div>';
      h += '<div class="changelog-version">v' + escapeHtml(rel.version) + '</div>';
      h += '<div class="changelog-date">' + escapeHtml(rel.date) + '</div>';
      if (rel.tag) h += '<div class="changelog-versiontag">' + escapeHtml(rel.tag) + '</div>';
      h += '</div>';

      h += '<div class="changelog-body">';
      h += '<h2 class="changelog-title">' + escapeHtml(rel.title) + '</h2>';
      if (rel.highlight) h += '<p class="changelog-highlight">' + escapeHtml(rel.highlight) + '</p>';
      var changes = rel.changes || [];
      if (changes.length) {
        h += '<ul class="changelog-changes">';
        changes.forEach(function (c) {
          var type = (c.type || 'changed').toLowerCase();
          h += '<li class="changelog-change">';
          h += '<span class="changelog-change-type" data-type="' + escapeHtml(type) + '">' + escapeHtml(type) + '</span>';
          h += '<span class="changelog-change-value">' + escapeHtml(c.value) + '</span>';
          h += '</li>';
        });
        h += '</ul>';
      }
      h += '</div>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  function renderNotFound(msg) {
    return '<div class="report-header"><a class="report-back" href="#">← 홈으로</a><h1 class="report-title">' + escapeHtml(msg || '페이지를 찾을 수 없습니다') + '</h1></div>';
  }

  function findChapterMeta(id) {
    if (!systemData) return null;
    var arr = systemData.chapters || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  }

  /* ============ SIDEBAR HIGHLIGHT ============ */
  function highlightSidebar(id) {
    document.querySelectorAll('.sidebar-link').forEach(function (l) {
      l.classList.remove('is-active');
    });
    // exact match
    var link = document.querySelector('.sidebar-link[data-section="' + id + '"]');
    if (link) {
      link.classList.add('is-active');
      var sub = link.closest('.sidebar-sub');
      if (sub) {
        var exp = sub.closest('.sidebar-expandable');
        if (exp) exp.classList.add('is-open');
      }
    }
    // If we're inside an article, also highlight (or open) the parent chapter
    if (/^chapter\//.test(id)) {
      var parts = id.split('/');
      var chapterTop = 'chapter/' + parts[1];
      var topLink = document.querySelector('.sidebar-link[data-section="' + chapterTop + '"]');
      if (topLink) {
        var parent = topLink.parentElement;
        if (parent && parent.classList.contains('sidebar-expandable')) {
          parent.classList.add('is-open');
        }
      }
    }
  }

  /* ============ ROUTING ============ */
  function route() {
    var hash = location.hash.replace(/^#\/?/, '').trim();

    if (!hash) {
      showHome();
      return;
    }

    if (hash === 'changelog') {
      hideHome();
      reportView.innerHTML = renderChangelog();
      reportView.style.display = '';
      highlightSidebar('changelog');
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    var parts = hash.split('/');
    if (parts[0] !== 'chapter' || !parts[1]) {
      showHome();
      return;
    }

    var chapterId = parts[1];
    var articleId = parts[2] || null;

    // 즉시 사이드바 강조 (콘텐츠 로딩 전)
    highlightSidebar(hash);
    fillChapterArticles(chapterId);

    loadChapter(chapterId).then(function (chapter) {
      if (articleId) {
        showReport(renderArticle(chapter, articleId));
      } else {
        showReport(renderChapterOverview(chapter));
      }
      // 콘텐츠 로딩 후 다시 한 번 강조 (사이드바 sub가 채워졌을 수 있음)
      highlightSidebar(hash);
    }).catch(function () {
      showReport(renderNotFound('챕터 데이터를 불러올 수 없습니다.'));
    });
  }

  /* ============ SIDEBAR INTERACTIONS ============ */
  /* Disable the collapse-all button when no chapter is open, so the
     control doesn't sit there 'armed' with nothing to act on. */
  function syncCollapseAllState() {
    var btn = document.querySelector('.sidebar-collapse-all');
    if (!btn) return;
    var anyOpen = !!document.querySelector('.sidebar-expandable.is-open');
    btn.disabled = !anyOpen;
  }

  function collapseAllChapters() {
    document.querySelectorAll('.sidebar-expandable.is-open').forEach(function (el) {
      el.classList.remove('is-open');
    });
    syncCollapseAllState();
  }
  window.collapseAllChapters = collapseAllChapters;

  document.addEventListener('click', function (e) {
    var link = e.target.closest('.sidebar-link');
    if (!link) return;

    var parent = link.parentElement;
    if (parent && parent.classList.contains('sidebar-expandable')) {
      // expand articles when first opening
      var chId = parent.getAttribute('data-chapter');
      if (chId) fillChapterArticles(chId);

      var targetHash = link.getAttribute('href') || '';
      var currentHash = location.hash || '';
      if (targetHash === currentHash) {
        e.preventDefault();
        parent.classList.toggle('is-open');
        syncCollapseAllState();
        return;
      }
      parent.classList.add('is-open');
      syncCollapseAllState();
    }

    if (link.closest('.sidebar-sub')) {
      closeSidebarMobile();
    } else if (!parent || !parent.classList.contains('sidebar-expandable')) {
      closeSidebarMobile();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSidebar();
  });

  /* ============ SEARCH ============ */
  /* Flatten the system into a searchable list.  Each entry has a haystack
     (lower-cased joined text) plus the route to jump to. */
  function buildSearchIndex() {
    if (searchIndex) return Promise.resolve(searchIndex);
    if (!systemData) return Promise.resolve([]);
    var chapters = systemData.chapters || [];
    return Promise.all(chapters.map(function (ch) {
      return loadChapter(ch.id).catch(function () { return null; });
    })).then(function (loaded) {
      var idx = [];
      chapters.forEach(function (meta, i) {
        var ch = loaded[i];
        var chapterTitle = meta.title || '';
        var chapterSub = meta.subtitle || '';
        idx.push({
          type: 'chapter',
          id: meta.id,
          icon: meta.icon || 'i-book',
          num: meta.num,
          title: chapterTitle,
          breadcrumb: 'CHAPTER ' + (meta.num || ''),
          snippet: chapterSub + (meta.desc ? ' · ' + meta.desc : ''),
          route: 'chapter/' + meta.id,
          haystack: [meta.num, chapterTitle, chapterSub, meta.desc, ch && ch.summary, ch && ch.objective]
            .filter(Boolean).join(' ').toLowerCase()
        });
        if (ch && Array.isArray(ch.articles)) {
          ch.articles.forEach(function (art) {
            var blocksText = '';
            if (Array.isArray(art.blocks)) {
              blocksText = art.blocks.map(function (b) {
                if (b.type === 'kv' || b.type === 'structure' || b.type === 'steprail') {
                  return (b.title || '') + ' ' + (b.items || []).map(function (it) {
                    return (it.label || '') + ' ' + (it.value || it.desc || '') + ' ' + (it.tag || '');
                  }).join(' ');
                }
                if (b.type === 'stats') {
                  return (b.items || []).map(function (it) {
                    return (it.label || '') + ' ' + (it.number || '') + ' ' + (it.suffix || '');
                  }).join(' ');
                }
                return b.value || '';
              }).join(' ');
            }
            idx.push({
              type: 'article',
              chapterId: meta.id,
              id: art.id,
              icon: meta.icon || 'i-book',
              num: art.num,
              title: art.title || '',
              breadcrumb: chapterTitle + ' · ' + (art.num || '') + '. ',
              snippet: art.summary || '',
              route: 'chapter/' + meta.id + '/' + art.id,
              haystack: [art.num, art.title, art.summary, (art.keywords || []).join(' '), blocksText, chapterTitle]
                .filter(Boolean).join(' ').toLowerCase()
            });
          });
        }
      });
      searchIndex = idx;
      /* If the modal is already open with a query typed before the
         index finished building, re-run the search now so results
         appear without the user having to retype. */
      if (searchState.open) {
        var input = document.getElementById('search-input');
        if (input && input.value.trim()) renderSearchResults(input.value);
      }
      return idx;
    });
  }

  function scoreEntry(entry, tokens) {
    var score = 0;
    var titleLow = entry.title.toLowerCase();
    var snippetLow = (entry.snippet || '').toLowerCase();
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (!t) continue;
      if (entry.haystack.indexOf(t) === -1) return 0; // every token must hit
      if (titleLow.indexOf(t) !== -1) score += 10;
      if (snippetLow.indexOf(t) !== -1) score += 4;
      score += 1;
    }
    if (entry.type === 'chapter') score += 2;
    return score;
  }

  function runSearch(query) {
    var q = (query || '').trim().toLowerCase();
    if (!q) return [];
    var tokens = q.split(/\s+/).filter(Boolean);
    var idx = searchIndex || [];
    var hits = [];
    for (var i = 0; i < idx.length; i++) {
      var s = scoreEntry(idx[i], tokens);
      if (s > 0) hits.push({ entry: idx[i], score: s });
    }
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, 30).map(function (h) { return h.entry; });
  }

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function highlight(text, tokens) {
    var safe = escapeHtml(text || '');
    if (!tokens || !tokens.length) return safe;
    var pattern = tokens.filter(Boolean).map(escapeRegExp).join('|');
    if (!pattern) return safe;
    try {
      return safe.replace(new RegExp('(' + pattern + ')', 'gi'), '<mark>$1</mark>');
    } catch (e) {
      return safe;
    }
  }

  function renderSearchHint() {
    var list = document.getElementById('search-results');
    if (!list) return;
    var h = '<div class="search-hint">';
    h += '<div class="search-hint-title">검색 팁</div>';
    h += '<div class="search-hint-row"><span class="search-hint-key">근조화환</span><span>장례식장에 보낼 때</span></div>';
    h += '<div class="search-hint-row"><span class="search-hint-key">배송비</span><span>배송비가 붙는 이유</span></div>';
    h += '<div class="search-hint-row"><span class="search-hint-key">리본 문구</span><span>근조·축하 문구 예시</span></div>';
    h += '<div class="search-hint-row"><span class="search-hint-key">취소</span><span>취소·환불 가능 시점</span></div>';
    h += '<div class="search-hint-row"><span class="search-hint-key">사진과 다를 때</span><span>받은 꽃 문제 대처</span></div>';
    h += '</div>';
    list.innerHTML = h;
  }

  function renderSearchResults(query) {
    var list = document.getElementById('search-results');
    if (!list) return;
    var q = (query || '').trim();
    if (!q) { renderSearchHint(); searchState.results = []; searchState.activeIdx = 0; return; }
    var results = runSearch(q);
    searchState.results = results;
    searchState.activeIdx = 0;
    if (!results.length) {
      list.innerHTML = '<div class="search-empty"><strong>일치하는 결과가 없습니다</strong><span>'
        + escapeHtml(q) + ' — 다른 키워드로 검색해 보세요.</span></div>';
      return;
    }
    var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    var html = '';
    var lastGroup = null;
    results.forEach(function (entry, i) {
      var group = entry.type === 'chapter' ? '챕터 · CHAPTERS' : '아티클 · ARTICLES';
      if (group !== lastGroup) {
        html += '<div class="search-group">' + group + '</div>';
        lastGroup = group;
      }
      var typeBadge = entry.type === 'chapter' ? 'CHAPTER' : 'ARTICLE';
      html += '<a class="search-result' + (i === 0 ? ' is-active' : '') + '" data-route="' + escapeHtml(entry.route) + '" data-idx="' + i + '">';
      html += '<span class="search-result-ico"><svg class="ico"><use href="#' + escapeHtml(entry.icon) + '"/></svg></span>';
      html += '<div class="search-result-body">';
      html += '<div class="search-result-title">' + highlight(entry.title, tokens) + '</div>';
      html += '<div class="search-result-meta">' + escapeHtml(entry.breadcrumb) + '</div>';
      if (entry.snippet) {
        html += '<div class="search-result-snippet">' + highlight(entry.snippet, tokens) + '</div>';
      }
      html += '</div>';
      html += '<span class="search-result-type">' + typeBadge + '</span>';
      html += '</a>';
    });
    list.innerHTML = html;
  }

  function setActiveSearchResult(nextIdx) {
    var nodes = document.querySelectorAll('.search-result');
    if (!nodes.length) return;
    nextIdx = (nextIdx + nodes.length) % nodes.length;
    searchState.activeIdx = nextIdx;
    nodes.forEach(function (n, i) {
      n.classList.toggle('is-active', i === nextIdx);
    });
    var active = nodes[nextIdx];
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  function openSearch() {
    var modal = document.getElementById('search-modal');
    if (!modal) return;
    modal.hidden = false;
    searchState.open = true;
    document.body.style.overflow = 'hidden';
    var input = document.getElementById('search-input');
    if (input) {
      input.value = '';
      renderSearchHint();
      setTimeout(function () { input.focus(); }, 30);
    }
    buildSearchIndex();
  }
  window.openSearch = openSearch;

  function closeSearch() {
    var modal = document.getElementById('search-modal');
    if (!modal) return;
    modal.hidden = true;
    searchState.open = false;
    document.body.style.overflow = '';
  }
  window.closeSearch = closeSearch;

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'search-input') {
      renderSearchResults(e.target.value);
    }
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-search-close]')) {
      closeSearch();
      return;
    }
    var hit = e.target.closest('.search-result');
    if (hit) {
      var route = hit.getAttribute('data-route');
      closeSearch();
      if (route) location.hash = '#' + route;
    }
  });

  document.addEventListener('keydown', function (e) {
    var mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (searchState.open) closeSearch(); else openSearch();
      return;
    }
    if (!searchState.open) {
      // "/" anywhere outside an input opens search
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) {
        e.preventDefault();
        openSearch();
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); closeSearch(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSearchResult(searchState.activeIdx + 1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveSearchResult(searchState.activeIdx - 1); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      var entry = searchState.results[searchState.activeIdx];
      if (entry) { closeSearch(); location.hash = '#' + entry.route; }
    }
  });

  /* ============ MARKDOWN EXPORT (전체 내용 다운로드) ============ */
  /* 모든 장·아티클·본문 블록을 읽기 좋은 단일 Markdown 문서로 직렬화한다.
     accuracy 같은 소스 전용 메타데이터는 본문에 포함하지 않는다(프론트 비노출 원칙). */
  function mdInline(s) { return (s == null ? '' : String(s)).replace(/\r?\n/g, ' ').trim(); }

  function blockToMarkdown(b) {
    if (!b) return '';
    switch (b.type) {
      case 'heading':
        return '#### ' + mdInline(b.value);
      case 'text':
        return mdInline(b.value);
      case 'note':
        return '> ' + mdInline(b.value);
      case 'kv': {
        var kv = b.title ? '**' + mdInline(b.title) + '**\n' : '';
        kv += (b.items || []).map(function (it) {
          return '- **' + mdInline(it.label) + '** — ' + mdInline(it.value);
        }).join('\n');
        return kv;
      }
      case 'stats':
        return (b.items || []).map(function (it) {
          return '- **' + mdInline(it.number) + (it.suffix ? mdInline(it.suffix) : '') + '** — ' + mdInline(it.label);
        }).join('\n');
      case 'structure':
        return (b.items || []).map(function (it) {
          return '- **' + mdInline(it.label) + '**' + (it.tag ? ' (' + mdInline(it.tag) + ')' : '') + (it.desc ? ' — ' + mdInline(it.desc) : '');
        }).join('\n');
      case 'steprail': {
        var sr = b.title ? '**' + mdInline(b.title) + '**\n' : '';
        sr += (b.items || []).map(function (it, i) {
          return (i + 1) + '. **' + mdInline(it.label) + '**' + (it.tag ? ' (' + mdInline(it.tag) + ')' : '') + (it.desc ? ' — ' + mdInline(it.desc) : '');
        }).join('\n');
        return sr;
      }
      case 'region-table':
        return (b.regions || []).map(function (r) {
          var areas = (r.areas || []).map(function (a) {
            return mdInline(a.name) + (a.fee ? ' (+' + (a.fee / 10000) + '만)' : '');
          }).join(', ');
          return '- **' + mdInline(r.name) + '**: ' + areas;
        }).join('\n');
      case 'image':
        return '![' + mdInline(b.alt) + '](' + mdInline(b.src) + ')';
      default:
        return '';
    }
  }

  function exportGuideMarkdown() {
    if (!systemData) return Promise.resolve('');
    var chapters = systemData.chapters || [];
    return Promise.all(chapters.map(function (ch) {
      return loadChapter(ch.id).catch(function () { return null; });
    })).then(function (loaded) {
      var out = [];
      out.push('# ' + (systemData.fullName || '꽃배달 이용 가이드'));

      var head = [];
      if (systemData.tagline) head.push('> ' + systemData.tagline);
      head.push('> 버전 v' + (systemData.version || '') + ' · 전체 ' + chapters.length + '개 장'
        + ((systemData.counts && systemData.counts.articles) ? ' · ' + systemData.counts.articles + '개 아티클' : ''));
      out.push(head.join('\n>\n'));
      out.push('---');

      out.push('## 차례\n\n' + chapters.map(function (ch) {
        return '- **' + ch.num + '.** ' + ch.title + (ch.subtitle ? ' — ' + ch.subtitle : '');
      }).join('\n'));
      out.push('---');

      chapters.forEach(function (ch, i) {
        var data = loaded[i];
        var sec = ['## ' + ch.num + '. ' + ch.title];
        if (ch.subtitle) sec.push('*' + ch.subtitle + '*');
        if (data && data.summary) sec.push(data.summary);
        if (data && data.objective) sec.push('> **학습 목표** · ' + data.objective);
        out.push(sec.join('\n\n'));

        ((data && data.articles) || []).forEach(function (art) {
          var a = ['### ' + ch.num + '.' + art.num + ' · ' + art.title];
          if (art.summary) a.push('*' + art.summary + '*');
          (art.blocks || []).forEach(function (b) {
            var md = blockToMarkdown(b);
            if (md) a.push(md);
          });
          out.push(a.join('\n\n'));
        });
        out.push('---');
      });

      return out.join('\n\n') + '\n';
    });
  }

  function downloadAllContent() {
    var btn = document.getElementById('download-all-btn');
    var label = btn ? btn.querySelector('.download-all-label') : null;
    var original = label ? label.textContent : null;
    if (btn) btn.disabled = true;
    if (label) label.textContent = '정리하는 중…';
    return exportGuideMarkdown().then(function (md) {
      var base = (systemData && systemData.fullName ? systemData.fullName : '꽃배달 이용 가이드').replace(/\s+/g, '-');
      var name = base + '-v' + ((systemData && systemData.version) || '') + '.md';
      var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 120);
      return md;
    }).catch(function (e) {
      try { console.error('전체 내용 다운로드 생성 실패', e); } catch (x) { /* noop */ }
      return '';
    }).then(function (md) {
      if (btn) btn.disabled = false;
      if (label && original != null) label.textContent = original;
      return md;
    });
  }
  window.downloadAllContent = downloadAllContent;

  /* ============ INIT ============ */
  window.addEventListener('hashchange', route);

  function init() {
    loadSystem().then(function () {
      route();
      buildSearchIndex();
    }).catch(function () {
      route();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
