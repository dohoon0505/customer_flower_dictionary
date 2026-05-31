#!/usr/bin/env node
/**
 * 꽃배달 창업 백과사전 — Validator
 * Usage: node scripts/validate.mjs
 *
 * 검증 항목:
 * 1. system.json 파싱 + 필수 필드 (name, version, chapters, releases)
 * 2. chapters[].id 와 analyses/{id}/ 폴더 일치
 * 3. analyses/{id}/chapter.json 파싱 + id 일치
 * 4. analyses/ 폴더에 있으나 system.json 미등재인 챕터 경고
 * 5. 필수 파일 존재 (index.html, css, js)
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warns = [];
const info = [];

function ok(msg)   { info.push('✓ ' + msg); }
function warn(msg) { warns.push('⚠ ' + msg); }
function fail(msg) { errors.push('✗ ' + msg); }

function readJSON(relPath) {
  const full = join(ROOT, relPath);
  if (!existsSync(full)) { fail('파일 없음: ' + relPath); return null; }
  try { return JSON.parse(readFileSync(full, 'utf-8')); }
  catch (e) { fail('JSON 파싱 실패 (' + relPath + '): ' + e.message); return null; }
}

// 1. system.json
const system = readJSON('system.json');
if (!system) process.exit(1);

if (!system.name) fail('system.json: name 필드 없음');
if (!system.version) fail('system.json: version 필드 없음');
if (!Array.isArray(system.chapters) || system.chapters.length === 0) {
  fail('system.json: chapters 배열 없음');
} else {
  ok('system.json — ' + system.chapters.length + '개 챕터 정의');
}
if (!Array.isArray(system.releases)) {
  warn('system.json: releases 배열 없음 (릴리즈 노트가 비어 보입니다)');
} else {
  ok('system.json — ' + system.releases.length + '개 릴리즈 등재');
}

// 2. chapters 검증
const chapters = system.chapters || [];
const registeredIds = new Set(chapters.map(c => c.id));
let totalArticles = 0;

for (const ch of chapters) {
  if (!ch.id) { fail('chapter에 id 없음'); continue; }
  if (!ch.title) warn(ch.id + ': title 필드 없음');
  if (!ch.num) warn(ch.id + ': num 필드 없음');

  const dir = join(ROOT, 'analyses', ch.id);
  if (!existsSync(dir)) {
    fail(ch.id + ': analyses/' + ch.id + '/ 폴더 없음');
    continue;
  }

  const chapter = readJSON('analyses/' + ch.id + '/chapter.json');
  if (!chapter) continue;
  if (chapter.id !== ch.id) {
    fail(ch.id + ': chapter.json의 id "' + chapter.id + '" !== system.json의 "' + ch.id + '"');
  }
  const articles = Array.isArray(chapter.articles) ? chapter.articles : [];
  totalArticles += articles.length;
  if (articles.length === 0) {
    warn(ch.id + ': articles 배열이 비어 있음 (콘텐츠 미작성)');
  } else {
    ok(ch.id + ' — ' + articles.length + '개 아티클');
  }
}

if (system.counts && typeof system.counts.articles === 'number') {
  if (system.counts.articles !== totalArticles) {
    warn('counts.articles(' + system.counts.articles + ') !== 실제 아티클 수(' + totalArticles + ')');
  }
}

// 3. analyses/ 폴더에 있으나 system.json에 미등재 확인
const analysesDir = join(ROOT, 'analyses');
if (existsSync(analysesDir)) {
  try {
    const dirs = readdirSync(analysesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    for (const d of dirs) {
      if (!registeredIds.has(d)) {
        warn('analyses/' + d + '/ 가 system.json.chapters[]에 미등재');
      }
    }
  } catch (e) {
    warn('analyses/ 디렉터리 읽기 실패: ' + e.message);
  }
}

// 4. 필수 파일 존재
['index.html', 'assets/css/main.css', 'assets/js/main.js'].forEach(f => {
  if (existsSync(join(ROOT, f))) ok(f + ' 존재');
  else fail(f + ' 없음');
});

// 결과
console.log('\n' + info.join('\n'));
if (warns.length) console.log('\n' + warns.join('\n'));
if (errors.length) console.log('\n' + errors.join('\n'));
console.log('\n결과: ' + info.length + ' OK / ' + warns.length + ' warn / ' + errors.length + ' error');
process.exit(errors.length ? 1 : 0);
