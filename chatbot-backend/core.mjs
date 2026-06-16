/* ================================================================
   꽃배달 상담 챗봇 — AI 백엔드 코어 (OpenAI GPT / RAG·컨텍스트 그라운딩)
   ----------------------------------------------------------------
   플랫폼 비종속. 표준 fetch만 사용하므로 Cloudflare Workers / Vercel /
   Node 18+ / Deno 어디서나 동작한다. 진입점(worker.mjs · node-server.mjs)이
   HTTP·CORS를 감싸고, 실제 답변 생성은 이 파일의 answer()가 한다.

   동작: 가이드 전체(knowledge.md)를 모델의 시스템 컨텍스트로 주고,
   사용자의 질문에 대해 GPT가 그 내용에 근거해 직접 답변을 "생성"한다.
   (검색·붙여넣기 아님) — OpenAI Responses API 사용.

   필요 환경변수(env):
   - OPENAI_API_KEY  (필수)  platform.openai.com 에서 발급
   - OPENAI_MODEL    (선택)  기본 gpt-5.4-nano.
                             (정확한 모델 ID가 다르면 이 값만 바꾸세요)
   - KNOWLEDGE_URL   (선택)  배포된 knowledge.md 의 공개 URL
   ================================================================ */

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_KNOWLEDGE_URL =
  'https://dohoon0505.github.io/flower_dictionary/assets/chatbot/knowledge.md';

const SYSTEM_PROMPT = [
  '당신은 "도랑플라워"의 꽃배달 상담 도우미입니다. 처음 주문하는 고객을 친절하게 돕습니다.',
  '',
  '## 규칙',
  '- 아래 제공된 "꽃배달 이용 가이드"의 내용에만 근거해 답하세요. 가이드에 없는 가격·정책·사실을 지어내지 마세요.',
  '- 가이드에서 답을 찾을 수 없으면, 모른다고 솔직히 말하고 전화 상담(1668-1840)이나 카카오톡 채널을 안내하세요.',
  '- 한국어 존댓말로, 따뜻하고 간결하게. 2~4문장 정도로 핵심을 전달하고 불필요하게 길게 쓰지 마세요.',
  '- 단순 검색 결과를 그대로 붙여넣지 말고, 질문에 맞춰 직접 이해하기 쉽게 정리해 답하세요.',
  '- 연락처: 전화 1668-1840, 카카오톡 https://pf.kakao.com/_xmcrwn, 홈페이지 https://dorangflower.com/',
  '',
  '## 출력 형식 (반드시 JSON 스키마를 따름)',
  '- reply: 사용자에게 보여줄 답변 텍스트.',
  '- refs: 답변과 관련된 가이드 아티클을 최대 2개. 각 항목은 {title, route}. route는 가이드 본문의 "(route: chapter/…/…)" 값을 그대로 사용. 관련 항목이 없으면 빈 배열.',
  '- chips: 사용자가 이어서 물어볼 만한 자연스러운 후속 질문 2~3개(짧은 한국어 문장).',
  '',
  '아래는 "꽃배달 이용 가이드" 전체입니다.'
].join('\n');

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    refs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, route: { type: 'string' } },
        required: ['title', 'route'],
        additionalProperties: false
      }
    },
    chips: { type: 'array', items: { type: 'string' } }
  },
  required: ['reply', 'refs', 'chips'],
  additionalProperties: false
};

/* ---- knowledge.md 를 가져와 메모리에 캐시(런타임 인스턴스 수명 동안) ---- */
let _knowledge = null;
let _knowledgeAt = 0;
const KNOWLEDGE_TTL = 10 * 60 * 1000; // 10분

async function getKnowledge(env) {
  const url = (env && env.KNOWLEDGE_URL) || DEFAULT_KNOWLEDGE_URL;
  const now = Date.now();
  if (_knowledge && (now - _knowledgeAt) < KNOWLEDGE_TTL) return _knowledge;
  const r = await fetch(url);
  if (!r.ok) throw new Error('knowledge fetch failed: ' + r.status + ' ' + url);
  _knowledge = await r.text();
  _knowledgeAt = now;
  return _knowledge;
}

/* ---- 클라이언트가 보낸 history({role,text} 또는 {role,content})를 입력 메시지로 ---- */
function toInput(history, message) {
  const msgs = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-8)) {
      const role = h && h.role === 'assistant' ? 'assistant' : 'user';
      const content = String((h && (h.content ?? h.text)) || '').slice(0, 2000);
      if (content) msgs.push({ role, content });
    }
  }
  msgs.push({ role: 'user', content: String(message || '').slice(0, 2000) });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift(); // 첫 메시지는 user
  return msgs;
}

/* ---- OpenAI Responses API 응답에서 출력 텍스트 추출 ---- */
function extractText(data) {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  let s = '';
  for (const item of (data.output || [])) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if ((c.type === 'output_text' || c.type === 'text') && typeof c.text === 'string') s += c.text;
      }
    }
  }
  return s;
}

/* ---- 핵심: 질문을 받아 GPT로 답변 생성 → {reply, refs, chips} ---- */
export async function answer({ message, history }, env) {
  if (!env || !env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY 가 설정되지 않았습니다.');
  if (!message || !String(message).trim()) return { reply: '무엇을 도와드릴까요?', refs: [], chips: [] };

  const knowledge = await getKnowledge(env);

  const body = {
    model: (env.OPENAI_MODEL || 'gpt-5.4-nano'),
    // 가이드 전체를 시스템 지시로 주입(= RAG 컨텍스트)
    instructions: SYSTEM_PROMPT + '\n\n' + knowledge,
    input: toInput(history, message),
    // 구조화 출력 — reply/refs/chips 를 한 번에 받음
    text: {
      format: {
        type: 'json_schema',
        name: 'flower_reply',
        strict: true,
        schema: REPLY_SCHEMA
      }
    },
    // 추론 비용·지연을 낮춤(FAQ 응대). 모델이 거부하면 이 줄을 지우세요.
    reasoning: { effort: 'low' },
    max_output_tokens: 2048
  };

  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.OPENAI_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error('OpenAI API ' + r.status + ': ' + detail.slice(0, 500));
  }

  const data = await r.json();
  const text = extractText(data);
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { parsed = { reply: text || '죄송해요, 잠시 후 다시 시도해 주세요.', refs: [], chips: [] }; }

  return {
    reply: String(parsed.reply || ''),
    refs: Array.isArray(parsed.refs) ? parsed.refs.slice(0, 3) : [],
    chips: Array.isArray(parsed.chips) ? parsed.chips.slice(0, 4) : []
  };
}
