/* ================================================================
   꽃배달 상담 챗봇 — Node 단독 서버 진입점
   ----------------------------------------------------------------
   자체 서버/VPS/로컬에서 그대로 실행. 의존성 없음(Node 18+).

   실행:  ANTHROPIC_API_KEY=sk-ant-... node chatbot-backend/node-server.mjs
   포트:  PORT 환경변수(기본 8787)
   ================================================================ */
import http from 'node:http';
import { answer } from './core.mjs';

const PORT = process.env.PORT || 8787;
const ORIGIN = process.env.ALLOW_ORIGIN || '*';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'POST') { res.writeHead(405); return res.end('POST only'); }

  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    try {
      const { message, history } = JSON.parse(body || '{}');
      const out = await answer({ message, history }, process.env);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    }
  });
});

server.listen(PORT, () => console.log(`flower-chat AI backend listening on :${PORT}`));
