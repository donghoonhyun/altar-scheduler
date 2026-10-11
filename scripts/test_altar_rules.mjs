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

  // ══ 나단계: 복사단 하위 문서 쓰기 제한 ═══════════════════════════════════════
  // 등장인물: pl1=SG00001 플래너, ad1=SG00001 어드민, p1=SG00001 활동 보호자(복사 역할),
  //          pp=SG00001 승인 대기 보호자, spl=SG00002 플래너, x1=관계없는 로그인 사용자, su1=superadmin
  const g1 = (sub) => `app_datas/ordo-altar/server_groups/SG00001/${sub}`;
  const planner = [...notSuper('pl1'), ...membership('pl1', 'SG00001', ['planner'])];
  const admin = [...notSuper('ad1'), ...membership('ad1', 'SG00001', ['admin'])];
  const parent = [...notSuper('p1'), ...membership('p1', 'SG00001', ['server'])];
  const pendingParent = [...notSuper('pp'), ...membership('pp', 'SG00001', ['server'], false)];
  const outsider = [...notSuper('x1'), ...noMembership('x1', 'SG00001')];
  const sourcePlanner = [...notSuper('spl'), ...noMembership('spl', 'SG00001'), ...membership('spl', 'SG00002', ['planner'])];
  const child = (parentUid, active, confirmed, extra = {}) => ({ parent_uid: parentUid, name_kor: '테스트', active, request_confirmed: confirmed, ...extra });

  // 단원
  add('N1 보호자가 자녀를 승인 대기로 등록', 'ALLOW', { uid: 'x1', method: 'create', docPath: g1('members/n1'),
    data: child('x1', false, false), mocks: outsider });
  add('N2 보호자가 자녀를 바로 활동 상태로 등록', 'DENY', { uid: 'x1', method: 'create', docPath: g1('members/n1'),
    data: child('x1', true, true), mocks: outsider });
  add('N3 남의 자녀로 등록', 'DENY', { uid: 'x1', method: 'create', docPath: g1('members/n1'),
    data: child('p1', false, false), mocks: outsider });
  add('N4 플래너가 단원 직접 추가', 'ALLOW', { uid: 'pl1', method: 'create', docPath: g1('members/n1'),
    data: child('', true, true), mocks: planner });
  add('N5 전입: 보내는 쪽 플래너가 승인 대기로 등록', 'ALLOW', { uid: 'spl', method: 'create', docPath: g1('members/n1'),
    data: child('p9', false, false, { moved_from_sg_id: 'SG00002' }), mocks: sourcePlanner });
  add('N6 전입인데 바로 활동 상태로', 'DENY', { uid: 'spl', method: 'create', docPath: g1('members/n1'),
    data: child('p9', true, true, { moved_from_sg_id: 'SG00002' }), mocks: sourcePlanner });
  add('N7 보호자가 자녀를 스스로 승인', 'DENY', { uid: 'p1', method: 'update', docPath: g1('members/m1'),
    existing: child('p1', false, false), data: child('p1', true, true), mocks: parent });
  add('N8 플래너가 단원 승인', 'ALLOW', { uid: 'pl1', method: 'update', docPath: g1('members/m1'),
    existing: child('p1', false, false), data: child('p1', true, true), mocks: planner });
  add('N9 전입 요청으로 활동 중인 단원을 덮어쓰기', 'DENY', { uid: 'spl', method: 'update', docPath: g1('members/m1'),
    existing: child('p1', true, true), data: child('p1', false, false, { moved_from_sg_id: 'SG00002' }), mocks: sourcePlanner });
  add('N10 보호자가 자기 대기 신청 취소', 'ALLOW', { uid: 'pp', method: 'delete', docPath: g1('members/m2'),
    existing: child('pp', false, false), mocks: pendingParent });
  add('N11 보호자가 활동 중인 자녀 문서 삭제', 'DENY', { uid: 'p1', method: 'delete', docPath: g1('members/m1'),
    existing: child('p1', true, true), mocks: parent });
  add('N12 관계없는 사용자가 단원 삭제', 'DENY', { uid: 'x1', method: 'delete', docPath: g1('members/m1'),
    existing: child('p1', true, true), mocks: outsider });
  add('N13 로그인 사용자의 단원 읽기(변경 없음)', 'ALLOW', { uid: 'p1', method: 'get', docPath: g1('members/m1'),
    existing: child('p1', true, true) });
  add('N14 비로그인 단원 읽기', 'DENY', { uid: null, method: 'get', docPath: g1('members/m1'),
    existing: child('p1', true, true) });
  add('N15 보호자가 휴지통 읽기', 'DENY', { uid: 'p1', method: 'get', docPath: g1('del_members/m9'),
    existing: child('p9', false, true), mocks: parent });
  add('N16 플래너가 휴지통으로 이동', 'ALLOW', { uid: 'pl1', method: 'create', docPath: g1('del_members/m9'),
    data: child('p9', false, true), mocks: planner });

  // 미사 일정·월 상태·프리셋·백업
  const mass = { title: '주일 미사', event_date: '20261018', member_ids: [] };
  add('E1 플래너가 미사 일정 수정', 'ALLOW', { uid: 'pl1', method: 'update', docPath: g1('mass_events/e1'),
    existing: mass, data: { ...mass, member_ids: ['m1'] }, mocks: planner });
  add('E2 보호자가 배정을 직접 수정', 'DENY', { uid: 'p1', method: 'update', docPath: g1('mass_events/e1'),
    existing: mass, data: { ...mass, member_ids: ['m1'] }, mocks: parent });
  add('E3 관계없는 사용자가 미사 일정 삭제', 'DENY', { uid: 'x1', method: 'delete', docPath: g1('mass_events/e1'),
    existing: mass, mocks: outsider });
  add('E4 다른 복사단 플래너가 미사 일정 생성', 'DENY', { uid: 'spl', method: 'create', docPath: g1('mass_events/e2'),
    data: mass, mocks: sourcePlanner });
  add('E5 로그인 사용자의 미사 일정 읽기(변경 없음)', 'ALLOW', { uid: 'p1', method: 'get', docPath: g1('mass_events/e1'), existing: mass });
  add('E6 superadmin 이 미사 일정 수정', 'ALLOW', { uid: 'su1', method: 'update', docPath: g1('mass_events/e1'),
    existing: mass, data: { ...mass, title: '변경' }, mocks: isSuper('su1') });
  add('E7 보호자가 월 상태 변경', 'DENY', { uid: 'p1', method: 'update', docPath: g1('month_status/202610'),
    existing: { status: 'MASS-CONFIRMED' }, data: { status: 'FINAL-CONFIRMED' }, mocks: parent });
  add('E8 플래너가 월 상태 변경', 'ALLOW', { uid: 'pl1', method: 'update', docPath: g1('month_status/202610'),
    existing: { status: 'MASS-CONFIRMED' }, data: { status: 'FINAL-CONFIRMED' }, mocks: planner });
  add('E9 보호자가 프리셋 수정', 'DENY', { uid: 'p1', method: 'update', docPath: g1('mass_presets/default'),
    existing: { a: 1 }, data: { a: 2 }, mocks: parent });
  add('E10 플래너가 백업 생성', 'ALLOW', { uid: 'pl1', method: 'create', docPath: g1('mass_backups/b1'),
    data: { events: [] }, mocks: planner });
  add('E11 플래너가 AI 분석 결과를 직접 쓰기', 'DENY', { uid: 'pl1', method: 'create', docPath: g1('ai_insights/202610'),
    data: { content: 'x' }, mocks: planner });

  // 설문
  const survey = (status, responses = {}) => ({ status, member_ids: ['m1', 'm2'], responses });
  const myAnswer = { m1: { uid: 'm1', unavailable: ['e1'] } };
  add('V1 활동 보호자가 열린 설문에 응답', 'ALLOW', { uid: 'p1', method: 'update', docPath: g1('availability_surveys/202611'),
    existing: survey('OPEN'), data: survey('OPEN', myAnswer), mocks: parent });
  add('V2 보호자가 설문 상태를 바꿈', 'DENY', { uid: 'p1', method: 'update', docPath: g1('availability_surveys/202611'),
    existing: survey('CLOSED'), data: survey('OPEN'), mocks: parent });
  add('V3 마감된 설문에 응답', 'DENY', { uid: 'p1', method: 'update', docPath: g1('availability_surveys/202611'),
    existing: survey('CLOSED'), data: survey('CLOSED', myAnswer), mocks: parent });
  add('V4 승인 대기 보호자가 응답', 'DENY', { uid: 'pp', method: 'update', docPath: g1('availability_surveys/202611'),
    existing: survey('OPEN'), data: survey('OPEN', myAnswer), mocks: pendingParent });
  add('V5 관계없는 사용자가 응답', 'DENY', { uid: 'x1', method: 'update', docPath: g1('availability_surveys/202611'),
    existing: survey('OPEN'), data: survey('OPEN', myAnswer), mocks: outsider });
  add('V6 플래너가 설문 생성', 'ALLOW', { uid: 'pl1', method: 'create', docPath: g1('availability_surveys/202611'),
    data: survey('OPEN'), mocks: planner });
  add('V7 플래너가 설문 마감', 'ALLOW', { uid: 'pl1', method: 'update', docPath: g1('availability_surveys/202611'),
    existing: survey('OPEN', myAnswer), data: survey('CLOSED', myAnswer), mocks: planner });
  add('V8 보호자가 설문 삭제', 'DENY', { uid: 'p1', method: 'delete', docPath: g1('availability_surveys/202611'),
    existing: survey('OPEN'), mocks: parent });
  add('V9 보호자가 대상자 목록까지 같이 바꿈', 'DENY', { uid: 'p1', method: 'update', docPath: g1('availability_surveys/202611'),
    existing: survey('OPEN'), data: { ...survey('OPEN', myAnswer), member_ids: ['m1'] }, mocks: parent });

  // 플래너 권한 신청
  const req = (uid, status) => ({ uid, role: 'planner', status, user_name: '테스트' });
  add('Q1 본인이 플래너 권한 신청', 'ALLOW', { uid: 'x1', method: 'create', docPath: g1('role_requests/x1'),
    data: req('x1', 'pending'), mocks: outsider });
  add('Q2 남의 이름으로 신청', 'DENY', { uid: 'x1', method: 'create', docPath: g1('role_requests/p1'),
    data: req('p1', 'pending'), mocks: outsider });
  add('Q3 처음부터 승인 상태로 신청', 'DENY', { uid: 'x1', method: 'create', docPath: g1('role_requests/x1'),
    data: req('x1', 'approved'), mocks: outsider });
  add('Q4 본인이 자기 신청을 승인', 'DENY', { uid: 'x1', method: 'update', docPath: g1('role_requests/x1'),
    existing: req('x1', 'pending'), data: req('x1', 'approved'), mocks: outsider });
  add('Q5 어드민이 신청 승인', 'ALLOW', { uid: 'ad1', method: 'update', docPath: g1('role_requests/x1'),
    existing: req('x1', 'pending'), data: req('x1', 'approved'), mocks: admin });
  add('Q6 플래너(어드민 아님)가 신청 승인', 'DENY', { uid: 'pl1', method: 'update', docPath: g1('role_requests/x1'),
    existing: req('x1', 'pending'), data: req('x1', 'approved'), mocks: planner });
  add('Q7 반려된 뒤 본인이 재신청', 'ALLOW', { uid: 'x1', method: 'update', docPath: g1('role_requests/x1'),
    existing: req('x1', 'rejected'), data: req('x1', 'pending'), mocks: outsider });
  add('Q8 본인이 신청 취소', 'ALLOW', { uid: 'x1', method: 'delete', docPath: g1('role_requests/x1'),
    existing: req('x1', 'pending'), mocks: outsider });
  add('Q9 남의 신청 삭제', 'DENY', { uid: 'x1', method: 'delete', docPath: g1('role_requests/p1'),
    existing: req('p1', 'pending'), mocks: outsider });
  add('Q10 남의 신청 읽기', 'DENY', { uid: 'x1', method: 'get', docPath: g1('role_requests/p1'),
    existing: req('p1', 'pending'), mocks: outsider });
  add('Q11 본인 신청 읽기', 'ALLOW', { uid: 'x1', method: 'get', docPath: g1('role_requests/x1'),
    existing: req('x1', 'pending'), mocks: outsider });
  add('Q12 어드민이 신청 읽기', 'ALLOW', { uid: 'ad1', method: 'get', docPath: g1('role_requests/x1'),
    existing: req('x1', 'pending'), mocks: admin });

  // 복사단 문서·카운터
  const sgDoc = { name: '초등부 복사단', parish_code: 'P1', active: true };
  add('G1 어드민이 복사단 설정 수정', 'ALLOW', { uid: 'ad1', method: 'update', docPath: 'app_datas/ordo-altar/server_groups/SG00001',
    existing: sgDoc, data: { ...sgDoc, name: '새 이름' }, mocks: admin });
  add('G2 플래너가 복사단 설정 수정', 'DENY', { uid: 'pl1', method: 'update', docPath: 'app_datas/ordo-altar/server_groups/SG00001',
    existing: sgDoc, data: { ...sgDoc, name: '새 이름' }, mocks: planner });
  add('G3 관계없는 사용자가 기존 복사단 덮어쓰기', 'DENY', { uid: 'x1', method: 'update', docPath: 'app_datas/ordo-altar/server_groups/SG00001',
    existing: sgDoc, data: { name: '탈취', parish_code: 'P1', active: true }, mocks: outsider });
  add('G4 새 복사단 생성', 'ALLOW', { uid: 'pl1', method: 'create', docPath: 'app_datas/ordo-altar/server_groups/SG00007',
    data: sgDoc, mocks: [...notSuper('pl1')] });
  add('G5 어드민이 복사단 삭제', 'DENY', { uid: 'ad1', method: 'delete', docPath: 'app_datas/ordo-altar/server_groups/SG00001',
    existing: sgDoc, mocks: admin });
  add('G6 로그인 사용자가 앱 카운터 수정', 'DENY', { uid: 'pl1', method: 'update', docPath: 'app_datas/ordo-altar/counters/c1',
    existing: { seq: 1 }, data: { seq: 0 }, mocks: planner });
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
