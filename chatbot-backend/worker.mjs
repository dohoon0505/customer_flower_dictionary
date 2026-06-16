/* ================================================================
   꽃배달 상담 챗봇 — 엣지/서버리스 진입점
   ----------------------------------------------------------------
   Cloudflare Workers · Vercel Edge Functions · Deno Deploy 호환.
   표준 Request/Response + fetch 핸들러 형태(export default { fetch }).

   배포(Cloudflare 예):  npx wrangler deploy
   비밀 키 등록:         npx wrangler secret put ANTHROPIC_API_KEY
   ================================================================ */
import { answer } from './core.mjs';

function cors(env) {
  return {
    'Access-Control-Allow-Origin': (env && env.ALLOW_ORIGIN) || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type'
  };
}

export default {
  async fetch(request, env) {
    const headers = cors(env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response('POST only', { status: 405, headers });
    try {
      const { message, history } = await request.json();
      const out = await answer({ message, history }, env);
      return new Response(JSON.stringify(out), {
        headers: { 'content-type': 'application/json', ...headers }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String((e && e.message) || e) }), {
        status: 502,
        headers: { 'content-type': 'application/json', ...headers }
      });
    }
  }
};
