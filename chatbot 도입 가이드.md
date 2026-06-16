# 꽃배달 상담 챗봇 — 도입 가이드

> 어느 웹사이트든 **스크립트 한 줄**로 우하단 “상담하기” 버튼과 우측 풀하이트 상담 패널(iframe 챗봇)을 설치하는 방법을 정리한 문서입니다.
> 백엔드·API 키·빌드 과정이 필요 없습니다.

---

## 목차

1. [한눈에 보기](#1-한눈에-보기)
2. [빠른 시작 — 한 줄 설치](#2-빠른-시작--한-줄-설치)
3. [설치 전 준비](#3-설치-전-준비)
4. [설치 옵션 (`data-*`)](#4-설치-옵션-data-)
5. [버튼으로 직접 열고 닫기 (`window.FlowerChat`)](#5-버튼으로-직접-열고-닫기-windowflowerchat)
6. [챗봇은 어떻게 답하나 (동작 원리)](#6-챗봇은-어떻게-답하나-동작-원리)
7. [내용·디자인 바꾸기](#7-내용디자인-바꾸기)
8. [(선택) 실제 LLM 백엔드 연결](#8-선택-실제-llm-백엔드-연결)
9. [설치 체크리스트](#9-설치-체크리스트)
10. [자주 묻는 질문 · 트러블슈팅](#10-자주-묻는-질문--트러블슈팅)
11. [보안 메모](#11-보안-메모)

---

## 1. 한눈에 보기

| 항목 | 내용 |
|------|------|
| 설치 방법 | `<script>` 한 줄 (어느 사이트·어느 도메인이든) |
| 화면 형태 | 우하단 **상담하기** FAB → 화면 우측에 꽉 차는 **풀하이트 패널**이 오른쪽에서 슬라이드 |
| 답변 데이터 | 꽃배달 가이드의 `system.json` + 전 챕터 `chapter.json`을 **실시간으로 읽어** 답함 |
| 백엔드 | **없음** — 브라우저 안에서 도는 한국어 검색 엔진 (원하면 LLM 백엔드 연결 가능) |
| 테마 | 화이트 모드 고정 (Pinterest 팔레트) · 모바일은 전체화면 |
| 반응 | ESC·닫기 버튼·`window.FlowerChat` API로 제어 |

핵심: **챗봇용 데이터를 따로 만들지 않습니다.** 가이드 콘텐츠(`chapter.json`)를 고치면 챗봇 답변도 함께 최신화됩니다.

---

## 2. 빠른 시작 — 한 줄 설치

설치할 페이지의 `</body>` 바로 앞에 아래 한 줄을 넣습니다.

```html
<script src="https://YOUR-HOST/assets/chatbot/embed.js" defer></script>
```

- `YOUR-HOST` 를 이 챗봇 파일이 호스팅된 도메인으로 바꾸면 끝입니다.
  예) `https://dohoon0505.github.io/flower_dictionary/assets/chatbot/embed.js`
- 챗봇 UI(`chatbot.html`)와 데이터 경로는 스크립트가 **자기 위치에서 자동으로** 찾습니다. 그래서 **다른 도메인(쇼핑몰·블로그·랜딩 페이지)에 붙여도** 그대로 동작합니다.
- 설치되면 우하단에 “상담하기” 버튼이 뜨고, 누르면 우측 패널이 열립니다.

> **미리 보고 싶다면**: 배포된 `chatbot-demo.html` 페이지를 열어 동작과 옵션을 확인할 수 있습니다.

---

## 3. 설치 전 준비

### 3-1. 챗봇 파일을 웹에 올려두기

챗봇은 다음 파일들이 **HTTP(S)로 접근 가능한 한 곳**에 함께 올라가 있어야 동작합니다. (가이드 저장소를 GitHub Pages 등으로 배포하면 이 구조가 그대로 유지됩니다.)

```
(배포 루트)/
├── chatbot.html                    ← 챗봇 iframe UI 본체
├── system.json                     ← 답변에 쓰는 데이터(매니페스트)
├── analyses/{챕터}/chapter.json    ← 답변에 쓰는 챕터 콘텐츠
└── assets/chatbot/
    ├── embed.js                    ← 설치 스크립트 (← 이 파일을 <script>로 부름)
    ├── chatbot.css
    └── chatbot.js
```

- **폴더 구조를 유지**하세요. `embed.js`는 자기 주소에서 `assets/chatbot/embed.js`를 `chatbot.html`로 바꿔 iframe 경로를 찾습니다. 구조를 바꿔야 한다면 [`data-src`](#4-설치-옵션-data-)로 직접 지정할 수 있습니다.

### 3-2. `file://` 로는 동작하지 않습니다

챗봇은 `system.json`·`chapter.json`을 `fetch`로 읽기 때문에, 파일을 더블클릭해 `file://`로 여는 환경에서는 데이터가 로드되지 않습니다(이 경우 최소 답변만 가능). **반드시 웹 서버로 띄워** 테스트하세요.

```bash
# 로컬 미리보기 (둘 중 하나)
powershell -File scripts/serve.ps1
python -m http.server 8000
```

---

## 4. 설치 옵션 (`data-*`)

`<script>` 태그에 `data-*` 속성을 붙여 동작과 외형을 바꿉니다.

```html
<script src="https://YOUR-HOST/assets/chatbot/embed.js"
        data-title="도랑플라워 상담"
        data-subtitle="전국 당일배송 · 24시간 상담"
        data-label="꽃 상담하기"
        data-accent="#e60023"
        data-position="right"
        defer></script>
```

| 속성 | 기본값 | 설명 |
|------|--------|------|
| `data-title` | `꽃배달 상담 도우미` | 패널 헤더의 제목 |
| `data-subtitle` | (비우면 기본 문구 유지) | 패널 헤더의 부제 |
| `data-label` | `상담하기` | 우하단 버튼(FAB)에 표시되는 글자 |
| `data-accent` | `#e60023` | **버튼(FAB)의 색**. 패널 내부 색은 7번 참고 |
| `data-position` | `right` | 패널이 붙는 쪽. `right` 또는 `left` |
| `data-open` | (없음) | `"true"`면 페이지 로드 시 자동으로 열림 |
| `data-api` | (없음) | LLM 백엔드 엔드포인트. 지정 시 그쪽으로 답변 위임 → [8번](#8-선택-실제-llm-백엔드-연결) |
| `data-src` | (자동) | 챗봇 iframe(`chatbot.html`) 경로를 직접 지정(폴더 구조를 바꾼 경우) |

> `data-accent`는 **런처 버튼 색**만 바꿉니다. 패널 안의 강조색(빨강)까지 바꾸려면 [7-2](#7-2-색상포인트-색-바꾸기)를 참고하세요.

---

## 5. 버튼으로 직접 열고 닫기 (`window.FlowerChat`)

설치되면 전역 객체 `window.FlowerChat`이 생깁니다. 페이지의 다른 버튼·링크에서 상담창을 열 수 있습니다.

```html
<button onclick="FlowerChat.open()">지금 상담하기</button>
<button onclick="FlowerChat.close()">닫기</button>
<button onclick="FlowerChat.toggle()">상담창 토글</button>
```

| 메서드 | 동작 |
|--------|------|
| `FlowerChat.open()` | 패널 열기 (처음 열 때 iframe을 지연 로드) |
| `FlowerChat.close()` | 패널 닫기 |
| `FlowerChat.toggle()` | 열림/닫힘 전환 |

- `ESC` 키로도 닫힙니다.
- 패널 헤더의 **×** 버튼은 내부적으로 부모 페이지에 닫기 신호(`postMessage`)를 보내 패널을 닫습니다.

---

## 6. 챗봇은 어떻게 답하나 (동작 원리)

1. 패널을 처음 열면 `chatbot.html`(iframe)이 로드되고, `chatbot.js`가 **`system.json` + 모든 `chapter.json`**을 읽어 옵니다.
2. FAQ 문항과 본문 블록(단계·표·키값 등)을 잘게 쪼개 **질문–답변 지식베이스(KB)**를 만듭니다.
3. 사용자가 질문하면,
   - 먼저 **인사·감사·연락처 요청** 같은 의도를 처리하고,
   - 아니면 **한국어 검색 엔진**으로 가장 가까운 답을 찾습니다.
     (조사·동사 어미 정리 → 불용어 제거 → IDF 희소어 가중 → 글자 바이그램 → “얼마/가격” 같은 가격 의도 보정)
4. 답변 아래에는 원문으로 가는 **“가이드에서 자세히 보기”** 링크와 **관련 질문 칩**이 함께 나옵니다.
5. 데이터를 못 불러오면(오프라인 등) **최소 핵심 답변**으로 폴백합니다.

따라서 답변 품질·정확도는 가이드 콘텐츠에 그대로 연동됩니다. **챗봇만을 위한 별도 데이터/학습은 없습니다.**

---

## 7. 내용·디자인 바꾸기

> 아래는 챗봇 소스(`assets/chatbot/`, `chatbot.html`)를 직접 손볼 때의 안내입니다. 설치만 할 때는 4번 옵션으로 충분합니다.

### 7-1. 연락처 바꾸기 (전화·카카오톡·홈페이지)

`assets/chatbot/chatbot.js` 상단의 `CONTACT` 상수를 수정합니다.

```js
var CONTACT = {
  phone: '1668-1840',
  kakao: 'https://pf.kakao.com/_xmcrwn',
  site:  'https://dorangflower.com/'
};
```

헤더의 “전화 상담 / 카카오톡” 버튼 링크는 `chatbot.html`의 `#dfc-call`·`#dfc-kakao`에서도 확인할 수 있습니다(스크립트가 위 상수로 다시 채워 줍니다).

### 7-2. 색상(포인트 색) 바꾸기

패널 내부 색은 `assets/chatbot/chatbot.css` 상단 토큰에서 바꿉니다.

```css
--p-red-500: #e60023;   /* 브랜드 강조색(버튼·사용자 말풍선·링크) */
--c-bg:      #fbfbf9;   /* 패널 배경 */
```

런처 버튼(FAB)만 바꿀 때는 `data-accent` 옵션이 더 간단합니다.

### 7-3. 인사말·추천 질문 바꾸기

`assets/chatbot/chatbot.js`의 `starterChips()`(첫 화면 추천 질문)와 인사말 분기(`localAnswer`의 `greet`)를 수정합니다.

```js
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
```

### 7-4. 헤더 뱃지·문구 바꾸기

`chatbot.html`의 `.dfc-badges`(전국 당일배송 등 칩)와 헤더 영역에서 바꿉니다.

### 7-5. 새 본문 블록 타입을 추가했다면

가이드에 새 블록 타입을 추가했다면, 챗봇이 그 내용을 답변에 쓰도록 `assets/chatbot/chatbot.js`의 `indexChapter()` 추출 분기에도 같은 타입을 더해야 합니다(없으면 챗봇 검색에서 누락됩니다).

---

## 8. (선택) 실제 LLM 백엔드 연결

기본 검색 엔진 대신 LLM 백엔드로 답하게 하려면 `data-api`에 엔드포인트를 지정합니다.

```html
<script src="https://YOUR-HOST/assets/chatbot/embed.js"
        data-api="https://your-backend.example/chat" defer></script>
```

- 챗봇은 해당 URL로 `POST { "message": "사용자 질문" }`을 보냅니다.
- 백엔드는 아래 형태의 JSON으로 응답하면 됩니다.

```json
{
  "reply": "답변 텍스트",
  "refs":  [{ "title": "근조화환", "route": "chapter/products/funeral-wreath" }],
  "chips": ["관련 질문 1", "관련 질문 2"]
}
```

- `refs`·`chips`는 선택입니다. 호출이 실패하면 **자동으로 내장 검색 엔진으로 폴백**합니다.
- ⚠️ API 키가 필요한 모델을 쓴다면, 키는 **백엔드에 두고** 그 백엔드를 `data-api`로 가리키세요. 키를 프런트(브라우저)에 노출하면 안 됩니다.

---

## 9. 설치 체크리스트

- [ ] `chatbot.html`, `assets/chatbot/*`, `system.json`, `analyses/`가 **같은 호스트**에 올라가 있다.
- [ ] 설치 페이지에 `<script src=".../assets/chatbot/embed.js" defer></script>` 한 줄을 넣었다.
- [ ] `https://`(또는 로컬 서버)로 열었다. `file://` 아님.
- [ ] 우하단 “상담하기” 버튼이 보이고, 누르면 우측 패널이 슬라이드로 열린다.
- [ ] 질문을 했을 때 답변 + “가이드에서 자세히 보기” 링크가 나온다.
- [ ] (필요 시) `data-title`·`data-label`·`data-position` 등으로 외형을 맞췄다.

---

## 10. 자주 묻는 질문 · 트러블슈팅

**Q. 버튼은 뜨는데 답변이 “콕 집어 답하기 어렵네요”만 나와요.**
→ 데이터(`system.json`/`chapter.json`)를 못 읽는 경우입니다. ① `file://`로 열지 않았는지, ② 챗봇 파일과 데이터가 같은 호스트에 있는지, ③ 브라우저 콘솔(F12)에 404가 없는지 확인하세요.

**Q. 버튼 자체가 안 보여요.**
→ ① `<script>` 경로(특히 `assets/chatbot/embed.js`)가 맞는지, ② 콘솔에 스크립트 로드 404가 없는지, ③ 같은 페이지에 챗봇이 **중복 설치**되지 않았는지(중복 설치는 무시됩니다) 확인하세요.

**Q. 다른 도메인(우리 쇼핑몰)에 붙였더니 안 떠요.**
→ `embed.js`는 절대경로 `src`에서 iframe 경로를 도출합니다. `<script src>`가 **전체 URL(https://…)**인지 확인하세요. 경로 구조를 바꿨다면 `data-src`로 `chatbot.html` 전체 주소를 지정하세요.

**Q. 패널을 왼쪽에 띄우고 싶어요.**
→ `data-position="left"` — 패널이 왼쪽에 도킹되고 왼쪽에서 슬라이드됩니다.

**Q. 페이지 들어오자마자 열고 싶어요.**
→ `data-open="true"`.

**Q. 다크 모드는요?**
→ 챗봇은 화이트 모드로 고정되어 있습니다(시스템이 다크여도 항상 밝게).

**Q. 답변 내용을 바꾸려면?**
→ 가이드 콘텐츠(`analyses/{챕터}/chapter.json`)를 수정하면 챗봇 답변도 자동 반영됩니다. 별도 챗봇 데이터는 없습니다.

---

## 11. 보안 메모

- 답변·추천 칩·사용자 입력은 모두 `escapeHtml()` 처리되어 화면에 안전하게 삽입됩니다.
- 외부 링크에는 `target="_blank" rel="noopener noreferrer"`가 적용됩니다.
- iframe은 챗봇 호스트와 같은 출처에서 자기 데이터를 읽으므로, 다른 사이트에 임베드해도 그 사이트의 데이터에 접근하지 않습니다.
- LLM 백엔드를 쓸 경우 **API 키는 절대 프런트에 두지 말고 백엔드**에 두세요(8번).

---

*문서 버전 1.0 · 대상: 꽃배달 상담 챗봇 위젯 (가이드 v4.1.0 기준)*
