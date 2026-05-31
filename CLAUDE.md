# CLAUDE.md — 기여 가이드라인

본 프로젝트(꽃배달 이용 가이드)에 변경을 가할 때 따라야 할 원칙입니다.

## 프로젝트 개요

온라인으로 꽃배달을 주문하려는 분, 특히 주문이 처음이라 막막한 고객을 위한 실전 이용 가이드. 전국꽃배달이 움직이는 방식부터 상황별 꽃 고르기·가격과 배송비·시간 맞춰 받기·메시지와 리본 문구·취소/환불·문제 해결까지 7개 장으로 주문 여정 순서대로 정리합니다. GitBook 스타일의 SPA + 통합 검색(Cmd/Ctrl+K) + 릴리즈 노트 페이지를 제공합니다.

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

### JavaScript
- ES6+ vanilla, 외부 의존성 없음
- 단일 IIFE `(function(){ 'use strict'; ... })();`
- HTML 삽입 시 사용자 데이터는 반드시 `escapeHtml()` 적용

### 본문 블록
지원 타입: `heading`, `text`, `note`, `kv`, `stats`, `structure`, `steprail`, `region-table`, `image`, `image-slot`.
새 타입을 추가할 때는 `assets/js/main.js`의 `renderBlock()` 분기와 `assets/css/main.css`의 `.blk-*` 스타일을 같이 추가.

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

## 브라우저 호환
- 최신 evergreen (Chrome, Firefox, Safari, Edge)
- ES2018+ 문법 허용

## 기여 절차
1. 변경하려는 영역 식별 (셸/데이터/문서)
2. 위 3계층 중 영향받는 모든 계층을 같은 커밋으로 묶기
3. `scripts/validate.mjs` 통과 확인
4. `index.html`을 브라우저에서 열어 라이트/다크 + 모바일 토글 + 챕터/아티클/릴리즈 라우팅 동작 확인
5. 커밋 메시지에 영향받은 계층 명시
