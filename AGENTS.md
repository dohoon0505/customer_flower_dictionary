# AGENTS.md — AI 에이전트 진입점

> **대상**: LLM·에이전트·자동화 도구. 이 저장소의 *꽃배달 이용 가이드*를 **읽고 · 찾고 · 추가**할 때 이 문서부터 읽으면 모든 쿼리를 **1–2 파일 read**로 해결할 수 있습니다.
>
> **사람 읽기용**: [CLAUDE.md](CLAUDE.md) · [README.md](README.md)

---

## 핵심 원칙

1. **단일 진입점** — `system.json` (루트)에서 모든 리소스로 분기.
2. **챕터 콘텐츠는 JSON canonical** — `analyses/{chapter-id}/chapter.json`이 정본.
3. **12개 장 구조 (v3.1, 고객 주문 여정)** — 꽃배달이 처음이라면 → 상품별 특성 알아보기 → 상황별 상품 추천 → 꽃말과 색상의 의미 → 기념일 캘린더 → 리본·카드 메시지 문구 → 주문하고 결제하기 → 시간 맞춰 배송 받기 → 받은 꽃 오래 보기 → 취소·환불·품질 보상 → 자주 묻는 질문 50선 → 꽃배달 용어 사전. (총 48개 아티클)
4. **릴리즈는 매니페스트 내부** — `system.json.releases[]`에 누적. 별도 파일 없음.
5. **검색** — 클라이언트에서 system.json + 모든 chapter.json을 합쳐 in-memory 인덱스를 만들고 substring 매칭. 별도 인덱스 빌드 스크립트 없음.

---

## "I want to... → Read this"

| 목표 | 첫 번째 read | 두 번째 read (필요 시) |
| --- | --- | --- |
| 시스템 전체 파악 | `system.json` | — |
| 등록된 모든 챕터 | `system.json` → `chapters[]` | — |
| 특정 챕터의 아티클 | `analyses/{chapter-id}/chapter.json` | — |
| 릴리즈 변경 이력 | `system.json` → `releases[]` | — |
| 프로젝트 기여 가이드 | `CLAUDE.md` | — |

---

## 새 아티클 추가

1. 대상 챕터 결정 (`system.json.chapters[]`에서 선택)
2. `analyses/{chapter-id}/chapter.json` 의 `articles[]` 배열에 새 항목 추가
   - 필수: `id`, `num`, `title`, `summary`, `blocks`
   - 권장: `readTime`, `accuracy`(0~100, 소스 전용 — 아래 "정확도 메타데이터" 참고)
3. `node scripts/validate.mjs` 실행
4. `system.json.counts.articles` 갱신

## 새 챕터 추가

1. `system.json.chapters[]` 배열에 엔트리 추가 (`id`, `num`, `title`, `subtitle`, `desc`, `icon`, `data`)
2. `analyses/{id}/chapter.json` 작성 (필수: `id`, `num`, `title`, `summary`, `objective`, `articles`)
3. `system.json.counts.chapters` 갱신
4. `node scripts/validate.mjs` 실행

## 릴리즈 노트 항목 추가

1. `system.json.releases[]` 배열 맨 앞에 새 객체 추가
   - 필수: `version`, `date`, `title`, `changes[]`
   - 권장: `tag`, `highlight`
   - `changes[].type`: `added` | `improved` | `fixed` | `changed` | `removed`
2. `system.json.version` 도 새 버전으로 동기화
3. `system.json.counts.releases` 갱신

---

## 본문 블록 타입

`chapter.json` 의 `articles[].blocks[]`에서 사용:

| type | 용도 |
|------|------|
| `heading` | 섹션 제목 (h2 수준) |
| `text` | 본문 단락 |
| `note` | 강조 박스 (왼쪽 컬러 바) |
| `kv` | 키-값 카드 그리드 (`columns: 1 \| 2`) |
| `stats` | 큰 숫자 통계 (number/suffix/label) |
| `structure` | 단계·목록 (label/tag/desc) |
| `steprail` | 단계형 주문 레일 — 번호 매겨진 세로 흐름 (title + items[label/tag/desc]) |
| `region-table` | 지역별 배송비 표 (legend[tier/label] + regions[name/areas[name/fee]]) |
| `image` | 실제 이미지 (src/alt/caption) |
| `image-slot` | 이미지 삽입 예정 placeholder + 디자인 가이드(guide) |

각 블록·아티클은 선택적 `accuracy`(0~100 정수)도 가질 수 있습니다 — 아래 참고.

---

## 정확도(accuracy) 메타데이터 — 소스 전용

아티클(`articles[].accuracy`)과 본문 블록(`blocks[].accuracy`)에 0~100 정수로 부여. **데이터에만 저장하고 프론트(UI)에는 절대 렌더링하지 않습니다.**

- **100** = 논문 등 1차 자료에서 저자가 직접 작성·검증한 사실.
- **0~99** = "정보의 바다"에서 습득한 자료를 리서치로 교차검증해 추정한 정확도.
- 아티클 = 글 전체 대표 신뢰도, 블록 = 사실 단위 신뢰도. 순수 상호참조(내비) 노트에는 생략.
- `node scripts/validate.mjs` 가 범위(0~100 정수)·표기율·논문 100% 개수를 검증·집계.

---

## 파일 구조

```
flower_dictionary/
├── system.json                 ← AI 진입점 (chapters + releases)
├── AGENTS.md                   ← (이 문서)
├── CLAUDE.md                   ← 기여 가이드
├── README.md                   ← 프로젝트 소개
│
├── analyses/                   ← 챕터 콘텐츠 데이터
│   └── {chapter-id}/
│       └── chapter.json        ← JSON canonical
│
├── scripts/
│   └── validate.mjs            ← 무결성 검증
│
├── index.html                  ← 운영 진본 (브라우저용 사이트)
├── assets/css/main.css
└── assets/js/main.js
```

---

## AI가 실수하기 쉬운 것

1. **chapter.json의 id와 폴더명 불일치** — 검증 스크립트가 잡아냄.
2. **system.json에만 등록하고 폴더 미생성** — 검증 스크립트가 잡아냄.
3. **사용자 입력 미이스케이프** — title, summary 등은 반드시 `escapeHtml()` 적용 (JS에서 자동).
4. **외부 링크에 noopener 누락** — `target="_blank" rel="noopener noreferrer"` 필수.
5. **릴리즈 type 오타** — `add`(X) / `added`(O), `improve`(X) / `improved`(O) 등.
6. **정확도(accuracy)를 화면에 노출** — accuracy는 소스 전용 메타데이터. `renderBlock()` 등에서 렌더링 금지.
