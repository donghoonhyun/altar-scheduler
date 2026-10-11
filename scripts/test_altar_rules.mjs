/**
 * Firestore 규칙 시나리오 테스트 (에뮬레이터 없이 Rules Test API 사용)
 *
 * 규칙 파일을 운영 프로젝트의 Rules Test API 로 "평가만" 한다. 배포나 ruleset 생성은 일어나지 않는다.
 * 인증은 로그인된 firebase CLI 를 그대로 쓴다 (`firebase deploy --dry-run` 의 규칙 컴파일과 같은 API).
 *
 * 사용법:
 *   node scripts/test_altar_rules.mjs                       # ../Ordo/firestore.rules 검증
 *   node scripts/test_altar_rules.mjs <firestore.rules 경로>  # 초안 파일 검증
 *
 * 알아둘 점:
 *   - rules 안의 exists()/get()/existsAfter() 는 functionMocks 로 값을 줘야 한다.
 *     경로의 괄호는 URL 인코딩된 형태(/databases/%28default%29/documents/...)로 전달된다.
 *   - "문서가 없음"(resource == null)은 이 API 로 표현할 수 없다. 그 조건이 필요한 규칙은 exists() 로 쓴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = process.argv[2] || path.resolve(__dirname, '../../Ordo/firestore.rules');
const flag = process.argv[3];
const require = createRequire(import.meta.url);
const PROJECT = 'ordo-eb11a';

const DOCS = '/databases/(default)/documents';
// rules 안에서 평가되는 경로는 괄호가 URL 인코딩된 형태로 전달된다 (probe 응답으로 확인)
const MOCK_DOCS = '/databases/%28default%29/documents';
const M = `${MOCK_DOCS}/app_datas/ordo-altar/memberships`;
const SG = `${MOCK_DOCS}/app_datas/ordo-altar/server_groups`;
const ROLES = `${MOCK_DOCS}/user_app_roles`;

// ── 목(mock) 헬퍼: rules 의 exists()/get()/existsAfter() 결과 ─────────────────
const mock = (fn, p, value) => ({ function: fn, args: [{ exactValue: p }], result: { value } });
const notSuper = (uid) => [mock('exists', `${ROLES}/${uid}`, false)];
const isSuper = (uid) => [
  mock('exists', `${ROLES}/${uid}`, true),
  mock('get', `${ROLES}/${uid}`, { data: { global_roles: ['superadmin'] } }),
];
const membership = (uid, sg, role, active = true) => [
  mock('exists', `${M}/${uid}_${sg}`, true),
  mock('get', `${M}/${uid}_${sg}`, { data: { uid, server_group_id: sg, role, active } }),
];
const noMembership = (uid, sg) => [mock('exists', `${M}/${uid}_${sg}`, false)];
const group = (sg, before, after) => [
  mock('exists', `${SG}/${sg}`, before),
  ...(after === undefined ? [] : [mock('existsAfter', `${SG}/${sg}`, after)]),
];

const cases = [];
const add = (name, expectation, { uid, method, docPath, data, existing, mocks = [] }) => {
  const request = { path: `${DOCS}/${docPath}`, method, time: '2026-10-11T12:00:00Z' };
  request.auth = uid ? { uid, token: {} } : null;
  if (data) request.resource = { data };
  const tc = { expectation, request, functionMocks: mocks };
  if (existing) tc.resource = { data: existing };
  cases.push({ name, tc });
};

const ms = (uid, sg, role, active, extra = {}) => ({ uid, server_group_id: sg, role, active, ...extra });
const mPath = (id) => `app_datas/ordo-altar/memberships/${id}`;

if (flag === '--probe') {
  add('probe', 'ALLOW', {
    uid: 'pl1', method: 'update', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], false), data: ms('p1', 'SG00001', ['server'], true),
  });
} else {
  // ── 생성 ────────────────────────────────────────────────────────────────────
  add('C1 보호자 본인 가입 신청(복사·대기)', 'ALLOW', { uid: 'p1', method: 'create', docPath: mPath('p1_SG00001'),
    data: ms('p1', 'SG00001', ['server'], false), mocks: [...notSuper('p1')] });
  add('C2 본인을 기존 복사단 어드민으로(자가 승격)', 'DENY', { uid: 'x1', method: 'create', docPath: mPath('x1_SG00001'),
    data: ms('x1', 'SG00001', ['admin', 'planner'], true), mocks: [...notSuper('x1'), ...group('SG00001', true, true), ...noMembership('x1', 'SG00001')] });
  add('C3 본인 가입을 바로 활성으로', 'DENY', { uid: 'x1', method: 'create', docPath: mPath('x1_SG00001'),
    data: ms('x1', 'SG00001', ['server'], true), mocks: [...notSuper('x1'), ...group('SG00001', true, true), ...noMembership('x1', 'SG00001')] });
  add('C4 본인을 global superadmin 으로', 'DENY', { uid: 'x1', method: 'create', docPath: mPath('x1_global'),
    data: ms('x1', 'global', ['superadmin'], true), mocks: [...notSuper('x1'), ...group('global', false, false), ...noMembership('x1', 'global')] });
  add('C5 새 복사단 생성자가 그 복사단의 어드민·플래너로', 'ALLOW', { uid: 'pl1', method: 'create', docPath: mPath('pl1_SG00007'),
    data: ms('pl1', 'SG00007', ['admin', 'planner'], true), mocks: [...notSuper('pl1'), ...group('SG00007', false, true)] });
  add('C6 어드민이 자기 복사단에 플래너 추가', 'ALLOW', { uid: 'ad1', method: 'create', docPath: mPath('u9_SG00001'),
    data: ms('u9', 'SG00001', ['planner'], true), mocks: [...notSuper('ad1'), ...membership('ad1', 'SG00001', ['admin'])] });
  add('C7 어드민이 superadmin 역할 부여', 'DENY', { uid: 'ad1', method: 'create', docPath: mPath('u9_SG00001'),
    data: ms('u9', 'SG00001', ['superadmin'], true), mocks: [...notSuper('ad1'), ...membership('ad1', 'SG00001', ['admin']), ...noMembership('ad1', 'undefined')] });
  add('C8 플래너가 자기 복사단에 복사(보호자) 멤버십 생성(복구)', 'ALLOW', { uid: 'pl1', method: 'create', docPath: mPath('p2_SG00001'),
    data: ms('p2', 'SG00001', ['server'], true), mocks: [...notSuper('pl1'), ...membership('pl1', 'SG00001', ['planner'])] });
  add('C9 플래너가 남에게 플래너 역할 부여', 'DENY', { uid: 'pl1', method: 'create', docPath: mPath('p2_SG00001'),
    data: ms('p2', 'SG00001', ['planner'], true), mocks: [...notSuper('pl1'), ...membership('pl1', 'SG00001', ['planner'])] });
  add('C10 전입: 보내는 쪽 플래너가 받는 복사단에 대기 멤버십', 'ALLOW', { uid: 'spl', method: 'create', docPath: mPath('p3_SG00001'),
    data: ms('p3', 'SG00001', ['server'], false, { moved_from_sg_id: 'SG00002' }),
    mocks: [...notSuper('spl'), ...noMembership('spl', 'SG00001'), ...membership('spl', 'SG00002', ['planner'])] });
  add('C11 전입인데 바로 활성으로', 'DENY', { uid: 'spl', method: 'create', docPath: mPath('p3_SG00001'),
    data: ms('p3', 'SG00001', ['server'], true, { moved_from_sg_id: 'SG00002' }),
    mocks: [...notSuper('spl'), ...noMembership('spl', 'SG00001'), ...membership('spl', 'SG00002', ['planner'])] });
  add('C12 권한 없는 사용자가 남의 멤버십 생성', 'DENY', { uid: 'x1', method: 'create', docPath: mPath('p3_SG00001'),
    data: ms('p3', 'SG00001', ['server'], false), mocks: [...notSuper('x1'), ...noMembership('x1', 'SG00001')] });
  add('C13 승인 대기(비활성) 플래너는 권한 없음', 'DENY', { uid: 'pl9', method: 'create', docPath: mPath('p3_SG00001'),
    data: ms('p3', 'SG00001', ['server'], true), mocks: [...notSuper('pl9'), ...membership('pl9', 'SG00001', ['planner'], false)] });

  // ── 수정 ────────────────────────────────────────────────────────────────────
  add('U1 플래너가 단원 승인(active 만 변경)', 'ALLOW', { uid: 'pl1', method: 'update', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], false), data: ms('p1', 'SG00001', ['server'], true),
    mocks: [...notSuper('pl1'), ...membership('pl1', 'SG00001', ['planner'])] });
  add('U2 본인이 자기 역할을 어드민으로(자가 승격)', 'DENY', { uid: 'p1', method: 'update', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true), data: ms('p1', 'SG00001', ['server', 'admin'], true),
    mocks: [...notSuper('p1'), ...membership('p1', 'SG00001', ['server'])] });
  add('U3 대기 중인 본인이 스스로 활성화', 'DENY', { uid: 'p1', method: 'update', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], false), data: ms('p1', 'SG00001', ['server'], true),
    mocks: [...notSuper('p1'), ...membership('p1', 'SG00001', ['server'], false)] });
  add('U4 어드민이 역할 변경', 'ALLOW', { uid: 'ad1', method: 'update', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true), data: ms('p1', 'SG00001', ['server', 'planner'], true),
    mocks: [...notSuper('ad1'), ...membership('ad1', 'SG00001', ['admin'])] });
  add('U5 플래너가 남의 역할 변경', 'DENY', { uid: 'pl1', method: 'update', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true), data: ms('p1', 'SG00001', ['server', 'planner'], true),
    mocks: [...notSuper('pl1'), ...membership('pl1', 'SG00001', ['planner'])] });
  add('U6 어드민이 superadmin 역할 추가', 'DENY', { uid: 'ad1', method: 'update', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true), data: ms('p1', 'SG00001', ['server', 'superadmin'], true),
    mocks: [...notSuper('ad1'), ...membership('ad1', 'SG00001', ['admin'])] });
  add('U7 어드민이 uid 를 바꿔치기', 'DENY', { uid: 'ad1', method: 'update', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true), data: ms('ad1', 'SG00001', ['server'], true),
    mocks: [...notSuper('ad1'), ...membership('ad1', 'SG00001', ['admin'])] });
  add('U8 슈퍼어드민이 임의 멤버십 수정', 'ALLOW', { uid: 'su1', method: 'update', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true), data: ms('p1', 'SG00001', ['planner'], false),
    mocks: [...isSuper('su1')] });
  add('U9 다른 복사단 플래너가 수정', 'DENY', { uid: 'spl', method: 'update', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], false), data: ms('p1', 'SG00001', ['server'], true),
    mocks: [...notSuper('spl'), ...noMembership('spl', 'SG00001')] });

  // ── 삭제 ────────────────────────────────────────────────────────────────────
  const docExists = (id, value) => [mock('exists', `${M}/${id}`, value)];
  add('D1 플래너가 자기 복사단 멤버십 삭제', 'ALLOW', { uid: 'pl1', method: 'delete', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true),
    mocks: [...docExists('p1_SG00001', true), ...notSuper('pl1'), ...membership('pl1', 'SG00001', ['planner'])] });
  add('D2 권한 없는 사용자가 남의 멤버십 삭제', 'DENY', { uid: 'x1', method: 'delete', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true),
    mocks: [...docExists('p1_SG00001', true), ...notSuper('x1'), ...noMembership('x1', 'SG00001')] });
  add('D3 없는 문서 삭제(배치에 포함되는 경우)', 'ALLOW', { uid: 'pl1', method: 'delete', docPath: mPath('zz_SG00001'),
    mocks: [...docExists('zz_SG00001', false), ...notSuper('pl1')] });
  add('D4 보호자가 자기 멤버십 삭제(앱에 없는 동작)', 'DENY', { uid: 'p1', method: 'delete', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true),
    mocks: [...notSuper('p1'), ...membership('p1', 'SG00001', ['server'])] });
  add('D5 비로그인 삭제', 'DENY', { uid: null, method: 'delete', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true), mocks: [...docExists('p1_SG00001', true)] });

  // ── 읽기 ────────────────────────────────────────────────────────────────────
  add('R1 본인 멤버십 읽기', 'ALLOW', { uid: 'p1', method: 'get', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true), mocks: [...notSuper('p1')] });
  // (없는 멤버십 읽기 = `resource == null` 은 테스트 API 로 표현할 수 없다. 기존 운영 규칙에서 바꾸지 않은 조항.)
  add('R3 남의 멤버십 읽기', 'DENY', { uid: 'x1', method: 'get', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true), mocks: [...notSuper('x1'), ...noMembership('x1', 'SG00001')] });
  add('R4 플래너가 자기 복사단 보호자 멤버십 읽기', 'ALLOW', { uid: 'pl1', method: 'get', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true), mocks: [...notSuper('pl1'), ...membership('pl1', 'SG00001', ['planner'])] });
  add('R5 비로그인 읽기', 'DENY', { uid: null, method: 'get', docPath: mPath('p1_SG00001'),
    existing: ms('p1', 'SG00001', ['server'], true) });

  // ── 루트 settings ───────────────────────────────────────────────────────────
  add('S1 비로그인이 카운터 쓰기', 'DENY', { uid: null, method: 'update', docPath: 'settings/counters',
    existing: { seq_server_groups: 6 }, data: { seq_server_groups: 0 } });
  add('S2 로그인 사용자가 카운터 쓰기(복사단 생성)', 'ALLOW', { uid: 'pl1', method: 'update', docPath: 'settings/counters',
    existing: { seq_server_groups: 6 }, data: { seq_server_groups: 7 } });
  add('S3 비로그인 settings 읽기(기존과 동일)', 'ALLOW', { uid: null, method: 'get', docPath: 'settings/counters',
    existing: { seq_server_groups: 6 } });

  // ── 이번에 바꾸지 않은 경로(회귀 확인) ──────────────────────────────────────
  add('X1 로그인 사용자의 단원 문서 읽기(변경 없음)', 'ALLOW', { uid: 'p1', method: 'get',
    docPath: 'app_datas/ordo-altar/server_groups/SG00001/members/m1', existing: { parent_uid: 'p1', active: true } });
  add('X2 비로그인 단원 문서 읽기', 'DENY', { uid: null, method: 'get',
    docPath: 'app_datas/ordo-altar/server_groups/SG00001/members/m1', existing: { parent_uid: 'p1', active: true } });
  add('X3 로그인 사용자의 미사 일정 쓰기(변경 없음)', 'ALLOW', { uid: 'pl1', method: 'update',
    docPath: 'app_datas/ordo-altar/server_groups/SG00001/mass_events/e1', existing: { title: 'a' }, data: { title: 'b' } });
}

// 로그인된 firebase CLI 의 자체 인증으로 호출한다 (`firebase deploy --dry-run` 의 규칙 컴파일과 같은 API)
const auth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const account = auth.getGlobalDefaultAccount();
if (!account) {
  console.error('firebase CLI 로그인이 필요합니다 (firebase login).');
  process.exit(1);
}
await requireAuth({ project: PROJECT, user: account.user, tokens: account.tokens });

const client = new Client({ urlPrefix: 'https://firebaserules.googleapis.com', apiVersion: 'v1' });
let body;
try {
  const res = await client.post(`/projects/${PROJECT}:test`, {
    source: { files: [{ name: 'firestore.rules', content: fs.readFileSync(rulesPath, 'utf-8') }] },
    testSuite: { testCases: cases.map((c) => c.tc) },
  });
  body = res.body;
} catch (e) {
  console.error('테스트 API 호출 실패:', e?.message, JSON.stringify(e?.context?.body ?? '', null, 2).slice(0, 2000));
  process.exit(1);
}
if (body.issues?.length) console.log('컴파일 이슈:', JSON.stringify(body.issues, null, 2));

if (flag === '--probe') {
  console.log(JSON.stringify(body, null, 2).slice(0, 6000));
  process.exit(0);
}

let failed = 0;
(body.testResults || []).forEach((r, i) => {
  const { name, tc } = cases[i];
  const ok = r.state === 'SUCCESS';
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  [기대 ${tc.expectation}]  ${name}`);
  if (!ok) {
    console.log('      debug:', JSON.stringify(r.debugMessages || []));
    console.log('      calls:', JSON.stringify((r.functionCalls || []).map((f) => `${f.function}(${JSON.stringify(f.args)})`)));
    if (r.errorPosition) console.log('      errorPosition:', JSON.stringify(r.errorPosition));
  }
});
console.log(`\n${failed === 0 ? '모두 통과' : failed + '건 실패'} (${cases.length}건)`);
process.exit(failed === 0 ? 0 : 1);
