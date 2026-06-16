/* ================================================================
   build-chatbot-knowledge.mjs
   ----------------------------------------------------------------
   system.json + 전 analyses/{id}/chapter.json 을 읽어 AI 챗봇이
   컨텍스트로 쓰는 단일 지식 파일(assets/chatbot/knowledge.md)을 만든다.
   - 소스 전용 메타데이터(accuracy)는 포함하지 않는다(프론트 비노출 규칙).
   - 각 아티클에 route(chapter/{cid}/{aid})를 달아 AI가 출처를 인용할 수 있게 한다.

   사용:  node scripts/build-chatbot-knowledge.mjs
   ================================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTACT = '전화 1668-1840 · 카카오톡 https://pf.kakao.com/_xmcrwn · 홈페이지 https://dorangflower.com/';

function blockToMd(b) {
  switch (b.type) {
    case 'heading': return `\n### ${b.value || ''}`;
    case 'text':
    case 'note': return b.value || '';
    case 'kv':
      return (b.items || []).map((it) => `- **${it.label}**: ${it.value || ''}`).join('\n');
    case 'structure':
    case 'steprail':
      return (b.items || []).map((it) =>
        `- **${it.label}**${it.tag ? ` (${it.tag})` : ''}: ${it.desc || it.value || ''}`).join('\n');
    case 'stats':
      return (b.items || []).map((it) =>
        `- ${it.label}: ${it.number || ''}${it.suffix || ''}`).join('\n');
    case 'region-table':
      return (b.regions || []).map((rg) =>
        `- ${rg.name}: ` + (rg.areas || []).map((a) => {
          const fee = a.fee ? `${a.fee.toLocaleString ? a.fee.toLocaleString() : a.fee}원` : '추가 없음';
          return `${a.name} ${fee}`;
        }).join(', ')).join('\n');
    default: return b.value || '';
  }
}

function build() {
  const sys = JSON.parse(readFileSync(join(ROOT, 'system.json'), 'utf8'));
  const out = [];
  out.push(`# ${sys.fullName} — 챗봇 지식베이스`);
  out.push(sys.description || '');
  out.push(`상담/주문 연락처: ${CONTACT}`);
  out.push('');
  out.push('> 아래는 "꽃배달 이용 가이드"의 전체 내용입니다. 답변은 이 내용에 근거해 작성하세요.');

  let articleCount = 0;
  for (const ch of sys.chapters || []) {
    let chapter;
    try { chapter = JSON.parse(readFileSync(join(ROOT, ch.data), 'utf8')); }
    catch { continue; }
    out.push(`\n\n# ${ch.num}. ${chapter.title || ch.title}`);
    if (chapter.summary) out.push(chapter.summary);
    for (const art of (chapter.articles || [])) {
      articleCount++;
      out.push(`\n## ${art.title || ''}  (route: chapter/${ch.id}/${art.id})`);
      if (art.summary) out.push(art.summary);
      if (Array.isArray(art.keywords) && art.keywords.length) {
        out.push(`관련 키워드: ${art.keywords.join(', ')}`);
      }
      for (const b of (art.blocks || [])) {
        const md = blockToMd(b);
        if (md && md.trim()) out.push(md);
      }
    }
  }

  const text = out.join('\n') + '\n';
  const dest = join(ROOT, 'assets/chatbot/knowledge.md');
  writeFileSync(dest, text, 'utf8');
  const chars = text.length;
  console.log(`✓ knowledge.md 생성 — ${articleCount}개 아티클 · ${chars.toLocaleString()}자 (약 ${Math.round(chars / 2.2 / 1000)}K 토큰 추정)`);
  console.log(`  → ${dest}`);
}

build();
