/**
 * Firestore 규칙 강화(1단계) 사전 점검 — 읽기 전용
 *
 * 운영 Firestore(ordo-eb11a)의 복사 스케줄러 데이터가 새 규칙의 전제를 만족하는지 확인한다.
 *   - 건수와 문서 ID 형식만 출력한다. 이름·전화번호 등 개인정보는 출력하지 않는다.
 *   - get()/count() 만 사용하며 쓰기 작업은 없다.
 *
 * 사용법:  npx tsx scripts/audit_altar_rules_readiness.ts
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const admin = require('firebase-admin');

const EXPECTED_PROJECT = 'ordo-eb11a';
const APP_ROOT = 'app_datas/ordo-altar';

const candidates = [
  path.resolve(__dirname, 'service-account.json'),
  path.resolve(__dirname, '../../Ordo/service-account.json'),
];
const serviceAccountPath = candidates.find((p) => {
  if (!fs.existsSync(p)) return false;
  return require(p).project_id === EXPECTED_PROJECT;
});
if (!serviceAccountPath) {
  console.error(`❌ ${EXPECTED_PROJECT} 용 service-account.json 을 찾지 못했습니다.`);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
const db: FirebaseFirestore.Firestore = admin.firestore();

type Counter = Record<string, number>;
const inc = (c: Counter, key: string) => {
  c[key] = (c[key] || 0) + 1;
};
const mask = (uid: unknown) => (typeof uid === 'string' && uid.length > 6 ? `${uid.slice(0, 4)}…` : String(uid));
const typeOf = (v: unknown) => (v === undefined ? '(없음)' : Array.isArray(v) ? 'array' : typeof v);
const fmt = (c: Counter) =>
  Object.entries(c)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${v}`)
    .join(', ') || '(없음)';

async function main() {
  console.log(`\n프로젝트: ${EXPECTED_PROJECT} (읽기 전용 점검)\n`);

  // ── 1) memberships ──────────────────────────────────────────────────────────
  const membershipSnap = await db.collection(`${APP_ROOT}/memberships`).get();
  const roleTypes: Counter = {};
  const roleValues: Counter = {};
  const activeTypes: Counter = {};
  const idMismatch: string[] = [];
  let missingFields = 0;
  const membershipIds = new Set<string>();
  const activeMembershipIds = new Set<string>();
  const superadminDocs: { id: string; uid: string }[] = [];
  const managersByGroup: Record<string, { admin: number; planner: number }> = {};

  membershipSnap.forEach((doc) => {
    const d = doc.data();
    membershipIds.add(doc.id);
    if (d.active === true) activeMembershipIds.add(doc.id);

    inc(roleTypes, typeOf(d.role));
    inc(activeTypes, `${typeOf(d.active)}:${String(d.active)}`);
    const roles: string[] = Array.isArray(d.role) ? d.role : d.role ? [d.role] : [];
    roles.forEach((r) => inc(roleValues, String(r)));

    if (!d.uid || !d.server_group_id) missingFields++;
    if (doc.id !== `${d.uid}_${d.server_group_id}`) {
      idMismatch.push(`${mask(doc.id.split('_')[0])}_${doc.id.split('_').slice(1).join('_')}  (uid=${mask(d.uid)}, sg=${d.server_group_id})`);
    }
    if (roles.includes('superadmin')) superadminDocs.push({ id: doc.id, uid: d.uid });

    if (d.active === true && d.server_group_id) {
      const g = (managersByGroup[d.server_group_id] ||= { admin: 0, planner: 0 });
      if (roles.includes('admin')) g.admin++;
      if (roles.includes('planner')) g.planner++;
    }
  });

  console.log('■ memberships');
  console.log(`  전체: ${membershipSnap.size}`);
  console.log(`  role 타입: ${fmt(roleTypes)}`);
  console.log(`  role 값: ${fmt(roleValues)}`);
  console.log(`  active 값: ${fmt(activeTypes)}`);
  console.log(`  uid 또는 server_group_id 누락: ${missingFields}`);
  console.log(`  문서 ID ≠ {uid}_{server_group_id}: ${idMismatch.length}`);
  idMismatch.slice(0, 15).forEach((s) => console.log(`     - ${s}`));

  // ── 2) 슈퍼어드민 ───────────────────────────────────────────────────────────
  const rolesSnap = await db.collection('user_app_roles').get();
  const globalSuperadmins = new Set<string>();
  rolesSnap.forEach((doc) => {
    const g = doc.data().global_roles;
    if (Array.isArray(g) && g.includes('superadmin')) globalSuperadmins.add(doc.id);
  });
  console.log('\n■ 슈퍼어드민');
  console.log(`  user_app_roles.global_roles 에 superadmin: ${globalSuperadmins.size}명`);
  console.log(`  memberships 에 superadmin 역할 문서: ${superadminDocs.length}건`);
  superadminDocs.forEach(({ id, uid }) => {
    const suffix = id.split('_').slice(1).join('_');
    console.log(
      `     - ${mask(uid)}_${suffix}  → user_app_roles 에도 superadmin: ${globalSuperadmins.has(uid) ? '예' : '아니오'}`
    );
  });

  // ── 3) server_groups 와 하위 컬렉션 ─────────────────────────────────────────
  const groupSnap = await db.collection(`${APP_ROOT}/server_groups`).get();
  const badGroupIds = groupSnap.docs.filter((d) => !/^SG\d{5}$/.test(d.id)).map((d) => d.id);
  console.log('\n■ server_groups');
  console.log(`  전체: ${groupSnap.size} (active=true ${groupSnap.docs.filter((d) => d.data().active === true).length})`);
  console.log(`  ID 형식이 SG00000 이 아닌 것: ${badGroupIds.length} ${badGroupIds.slice(0, 10).join(', ')}`);

  let maxSeq = 0;
  for (const g of groupSnap.docs) {
    const m = /^SG(\d{5})$/.exec(g.id);
    if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
  }
  const counterDoc = await db.doc('settings/counters').get();
  console.log(`  settings/counters.seq_server_groups: ${counterDoc.data()?.seq_server_groups} (실제 최대 번호 ${maxSeq})`);

  console.log('\n■ 복사단별');
  for (const g of groupSnap.docs) {
    const sgId = g.id;
    const membersSnap = await g.ref.collection('members').get();
    let active = 0;
    let pending = 0;
    let withParent = 0;
    let withUid = 0;
    let noLink = 0;
    let withPhone = 0;
    let idIsAccount = 0;
    const parents = new Set<string>();
    const parentsOfActive = new Set<string>();

    membersSnap.forEach((doc) => {
      const d = doc.data();
      if (d.active === true) active++;
      if (d.active !== true && d.request_confirmed === false) pending++;
      if (d.parent_uid) {
        withParent++;
        parents.add(d.parent_uid);
        if (d.active === true) parentsOfActive.add(d.parent_uid);
      }
      if (d.uid) withUid++;
      if (!d.parent_uid && !d.uid) noLink++;
      if (d.phone_student || d.phone_guardian || d.phone) withPhone++;
      if (membershipIds.has(`${doc.id}_${sgId}`)) idIsAccount++;
    });

    const parentsWithoutMembership = [...parents].filter((p) => !membershipIds.has(`${p}_${sgId}`)).length;
    const activeParentsInactiveMembership = [...parentsOfActive].filter(
      (p) => membershipIds.has(`${p}_${sgId}`) && !activeMembershipIds.has(`${p}_${sgId}`)
    ).length;

    const requestsSnap = await g.ref.collection('role_requests').get();
    const requestStatus: Counter = {};
    let requestIdMismatch = 0;
    requestsSnap.forEach((doc) => {
      inc(requestStatus, String(doc.data().status));
      if (doc.id !== doc.data().uid) requestIdMismatch++;
    });

    const surveysSnap = await g.ref.collection('availability_surveys').get();
    let surveysWithMap = 0;
    let responseSubDocs = 0;
    for (const s of surveysSnap.docs) {
      const responses = s.data().responses;
      if (responses && typeof responses === 'object' && Object.keys(responses).length > 0) surveysWithMap++;
      responseSubDocs += (await s.ref.collection('responses').count().get()).data().count;
    }

    const mgr = managersByGroup[sgId] || { admin: 0, planner: 0 };
    console.log(`  [${sgId}] active=${g.data().active === true}  admin ${mgr.admin}명, planner ${mgr.planner}명`);
    console.log(
      `     members ${membersSnap.size} (활동 ${active}, 승인대기 ${pending}) · parent_uid 있음 ${withParent} · uid 필드 있음 ${withUid} · 계정 연결 없음 ${noLink}`
    );
    console.log(`     전화번호 필드가 있는 member 문서: ${withPhone} · 문서 ID 가 계정 uid 인 member: ${idIsAccount}`);
    console.log(
      `     보호자 ${parents.size}명 중 멤버십 문서 없음 ${parentsWithoutMembership}명 · 활동 자녀가 있는데 멤버십 비활성 ${activeParentsInactiveMembership}명`
    );
    console.log(`     role_requests ${requestsSnap.size} (${fmt(requestStatus)}) · 문서 ID ≠ uid ${requestIdMismatch}`);
    console.log(
      `     availability_surveys ${surveysSnap.size} · responses 맵 사용 ${surveysWithMap} · responses 서브컬렉션 문서 ${responseSubDocs}`
    );
  }

  console.log('\n점검 완료 (쓰기 없음)\n');
}

main().catch((e) => {
  console.error('❌ 점검 실패:', e);
  process.exit(1);
});
