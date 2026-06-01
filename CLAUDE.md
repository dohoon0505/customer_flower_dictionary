# CLAUDE.md — 기여 가이드라인

본 프로젝트(꽃배달 이용 가이드)에 변경을 가할 때 따라야 할 원칙입니다.

## 프로젝트 개요

온라인으로 꽃배달을 주문하려는 분, 특히 주문이 처음이라 막막한 고객을 위한 실전 이용 가이드. 전국꽃배달이 움직이는 방식부터 상품별 특성·상황별 추천·꽃말과 색상·기념일 캘린더·리본과 카드 문구·주문과 결제·배송·받은 꽃 관리·취소/환불·FAQ 50선·용어사전까지 12개 장(46개 아티클)으로 주문 여정 순서대로 정리합니다. GitBook 스타일의 SPA + 통합 검색(Cmd/Ctrl+K) + 릴리즈 노트 페이지를 제공합니다.

## 3계층 동시 갱신

어떤 변경이든 다음 세 계층을 동시에 갱신해야 일관성이 깨지지 않습니다.

| 계층 | 위치 | 역할 |
|------|------|------|
| **운영 소스** | `index.html`, `assets/css/main.css`, `assets/js/main.js` | 실제 동작하는 셸과 로직 |
| **데이터 매니페스트** | `system.json`, `analyses/{id}/chapter.json` | 시스템 메타데이터 + 챕터/아티클 콘텐츠 |
| **문서** | `README.md`, `AGENTS.md`, 본 파일 | 기여자/에이전트 가이드 |

예시 1: 새 아티클 추가 시 → `analyses/{chapter-id}/chapter.json`의 `articles[]`에 항목 추가 + `system.json.counts.articles` 갱신 + 사이드바 자동 반영.

예시 2: 새 릴리즈 발행 시 → `system.json.version` + `releases[]` 동시 갱신.

## 컨벤션

### 파일 경로
- 단일 진입점: `index.html`
- 정적 자원: `assets/css/`, `assets/js/`
- 챕터 데이터: `analyses/{chapter-id}/chapter.json`
- 스크립트: `scripts/` (ESM, Node 18+)

### 네이밍
- 챕터/아티클 ID: `^[a-z0-9][a-z0-9-]*$` (영소문자 시작, 영소문자/숫자/하이픈만)
- 챕터 번호(`num`): `"01" ~ "07"` 같은 2자리 zero-padded 문자열
- 날짜: ISO 8601 (`YYYY-MM-DD`)
- 릴리즈 버전: SemVer `MAJOR.MINOR.PATCH`
- 컬러: hex (`#RRGGBB` 또는 `#RRGGBBAA`)

### CSS 토큰
- Primitive: `--p-{family}-{step}` (예: `--p-rose-500`, `--p-sage-300`, `--p-neutral-80`)
- Semantic: `--sm-{role}-{variant}` (예: `--sm-content-brand`, `--sm-interactive-accent-subtle`)
- 뱃지 타이포: 모든 태그·뱃지는 `--badge-font`(600·12px·Pretendard) + `--badge-tracking`(-0.01em)를 공유. 새 뱃지도 개별 `font`를 쓰지 말고 이 토큰을 따른다.

### JavaScript
- ES6+ vanilla, 외부 의존성 없음
- 단일 IIFE `(function(){ 'use strict'; ... })();`
- HTML 삽입 시 사용자 데이터는 반드시 `escapeHtml()` 적용

### 본문 블록
지원 타입: `heading`, `text`, `note`, `kv`, `stats`, `structure`, `steprail`, `region-table`, `image`, `image-slot`.
새 타입을 추가할 때는 `assets/js/main.js`의 `renderBlock()` 분기와 `assets/css/main.css`의 `.blk-*` 스타일을 같이 추가.

### 정확도(accuracy) 메타데이터 — 소스 전용, 프론트 비노출
아티클(`articles[].accuracy`)과 본문 블록(`blocks[].accuracy`)은 선택적 `accuracy`(0~100 정수)를 가집니다. **데이터(소스)에만 저장하며 UI에는 절대 렌더링하지 않습니다.**
- **100** = 1차 자료(논문 등 저자가 직접 작성·검증)에서 온 사실.
- **0~99** = "정보의 바다"에서 습득한 자료를 다양한 리서치로 교차검증해 추정한 정확도.
- 아티클 `accuracy`는 글 전체의 대표 신뢰도, 블록 `accuracy`는 그 블록(사실 단위)의 신뢰도. 순수 상호참조(내비) 노트에는 부여하지 않습니다.
- 값은 `chapter.json`에만 존재하고 `renderBlock()`·검색 인덱스는 이를 읽거나 표시하지 않습니다(향후 블록 추가 시에도 비노출 유지).

### 관련 키워드(keywords) — 선택, 검색·표시용
아티클은 선택적 `keywords`(문자열 배열)를 가질 수 있습니다. accuracy와 달리 **프론트에 노출되는 정상 메타데이터**로, 아티클 헤더에 태그(통일 뱃지 토큰 `--badge-font`)로 표시되고 통합검색 색인(haystack)에 포함됩니다. 표시는 `assets/js/main.js`의 `renderArticle()`, 검색 포함은 `buildSearchIndex()`에서 처리합니다.

## 안전 / 보안
- `chapter.json`의 사용자 제공 텍스트(`title`, `summary`, `value` 등)는 모두 escape 후 렌더링.
- 외부 링크는 `target="_blank" rel="noopener noreferrer"` 적용.

## 검증

```bash
node scripts/validate.mjs
```

수정 시 예상되는 동작:
- `system.json` 등록과 실제 폴더가 어긋나면 error
- 폴더는 있는데 등록 안 됨 → warning
- 필수 필드 누락 → error
- `articles` 배열이 비어 있으면 warning (콘텐츠 미작성 신호)
- `counts.articles`와 실제 아티클 수가 다르면 warning
- 아티클/블록 `accuracy`가 0~100 정수가 아니면 error, 아티클에 `accuracy`가 없으면 warning (표기율·논문 100% 개수도 집계)

## 브라우저 호환
- 최신 evergreen (Chrome, Firefox, Safari, Edge)
- ES2018+ 문법 허용

## 기여 절차
1. 변경하려는 영역 식별 (셸/데이터/문서)
2. 위 3계층 중 영향받는 모든 계층을 같은 커밋으로 묶기
3. `scripts/validate.mjs` 통과 확인
4. `index.html`을 브라우저에서 열어 라이트/다크 + 모바일 토글 + 챕터/아티클/릴리즈 라우팅 동작 확인
5. 커밋 메시지에 영향받은 계층 명시
