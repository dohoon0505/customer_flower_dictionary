# 꽃배달 상담 챗봇 — AI 백엔드 (OpenAI GPT · RAG)

가이드(`꽃배달 이용 가이드`) 전체를 GPT에게 **지식으로 주입**하고, 사용자의 질문에 대해 GPT가 그 내용에 근거해 **직접 생각하여 답을 생성**하는 백엔드입니다. (chapter.json을 그대로 보여주는 검색이 아니라, AI가 이해해 문장으로 답합니다.)

- **방식**: RAG·컨텍스트 그라운딩 (가이드를 시스템 지시로 주입) — 파인튜닝 불필요, 가이드를 고치면 즉시 반영
- **모델**: OpenAI GPT (기본 `gpt-5.4-nano`, 환경변수로 교체 가능) · OpenAI **Responses API** 사용
- **의존성 0 · 플랫폼 비종속**: 표준 `fetch`만 사용 → Cloudflare Workers / Vercel / Node / Deno 어디서나 동작

```
chatbot-backend/
├── core.mjs          ← 답변 생성 핵심(OpenAI 호출 + 가이드 컨텍스트 + 구조화 출력)
├── worker.mjs        ← 엣지/서버리스 진입점(Cloudflare/Vercel Edge/Deno)
├── node-server.mjs   ← Node 단독 서버 진입점
├── wrangler.toml     ← Cloudflare 배포 설정
├── .env.example      ← Node용 환경변수 예시
└── package.json
```

---

## 0. API 키 발급 (공통)

1. https://platform.openai.com/api-keys 에서 키 생성 (`sk-...`).
2. **Billing**에서 결제수단/크레딧 등록. 키는 **백엔드에만** 두고 절대 프런트(브라우저)에 노출하지 마세요.

> 모델 ID: 기본값은 `gpt-5.4-nano`입니다. 사용하려는 모델의 정확한 ID가 다르면 `OPENAI_MODEL` 환경변수만 바꾸면 됩니다(코드 수정 불필요).

---

## 1. 배포 — 셋 중 하나

### A) Cloudflare Workers (추천 · 무료 티어)

```bash
cd chatbot-backend
npx wrangler login
npx wrangler secret put OPENAI_API_KEY     # 프롬프트에 키 붙여넣기
npx wrangler deploy
```

배포되면 `https://flower-chat-backend.<계정>.workers.dev` 주소가 나옵니다. 모델·KNOWLEDGE_URL·CORS는 `wrangler.toml`의 `[vars]`에서 조정합니다.

### B) Node 단독 서버 / VPS

```bash
cd chatbot-backend
cp .env.example .env        # .env 를 채우기 (OPENAI_API_KEY 등)
# 셸에서 직접:
OPENAI_API_KEY=sk-... node node-server.mjs
# → http://localhost:8787 에서 대기
```

리버스 프록시(nginx 등) 뒤에 두고 HTTPS 도메인을 붙이세요.

### C) Vercel (Edge Function)

`worker.mjs`의 `export default { fetch }`를 Vercel Edge Function 형태로 감싸 배포할 수 있습니다(프로젝트 구조에 맞게 `api/chat.js`에서 `core.mjs`의 `answer()`를 호출). 환경변수 `OPENAI_API_KEY` 등을 프로젝트 설정에 등록하세요.

---

## 2. 위젯에 연결

배포로 받은 백엔드 URL을 임베드 스크립트의 `data-api`에 넣으면 끝입니다. 그 순간부터 챗봇은 내장 검색 대신 **GPT가 생성한 답변**을 사용합니다(호출 실패 시 자동으로 내장 검색으로 폴백).

```html
<script src="https://YOUR-HOST/assets/chatbot/embed.js"
        data-api="https://flower-chat-backend.<계정>.workers.dev" defer></script>
```

---

## 3. 가이드를 고쳤다면 — 지식 갱신

답변의 근거가 되는 `assets/chatbot/knowledge.md`는 가이드 데이터로부터 생성됩니다. 챕터(`analyses/{id}/chapter.json`)를 수정한 뒤 한 번 다시 만들어 배포하면 AI 답변도 최신화됩니다.

```bash
node scripts/build-chatbot-knowledge.mjs    # → assets/chatbot/knowledge.md 갱신
```

백엔드는 `KNOWLEDGE_URL`(배포된 knowledge.md)을 읽어 메모리에 약 10분 캐시합니다.

---

## 4. API 규격

- 요청: `POST {백엔드 URL}` · `Content-Type: application/json`
  ```json
  { "message": "근조화환 얼마예요?", "history": [{ "role": "user", "text": "..." }, { "role": "assistant", "text": "..." }] }
  ```
- 응답:
  ```json
  { "reply": "근조화환은 기본 59,000원…", "refs": [{ "title": "근조화환", "route": "chapter/products/condolence-wreath" }], "chips": ["고급형은 얼마예요?", "당일배송 되나요?"] }
  ```

`refs`·`chips`는 비어 있을 수 있습니다. 위젯은 `reply`를 말풍선으로, `refs`를 "자세히 보기" 링크로, `chips`를 추천 질문으로 렌더링합니다.

> 내부적으로 OpenAI **Responses API**(`POST /v1/responses`)에 가이드를 `instructions`로 주입하고, 구조화 출력(`text.format` = json_schema)으로 `reply/refs/chips`를 한 번에 받습니다. 추론 비용·지연을 줄이려 `reasoning.effort: low`를 씁니다 — 모델이 이 파라미터를 거부하면 `core.mjs`에서 해당 줄만 지우면 됩니다.
