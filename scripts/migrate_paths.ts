/**
 * Firestore 경로 이동 마이그레이션 (Same-project: ordo-eb11a)
 *
 * 이동 대상:
 *   1. app_altar/v1/*          -> app_datas/ordo-altar/*
 *   2. daily_verses/*          -> ordo_contents/daily_contents/daily_verses/*
 *   3. dashboard_news/*        -> ordo_contents/dashboard_news/items/*
 *   4. users_verbum/{uid}/saved_verses/* -> app_datas/ordo-verbum/users/{uid}/saved_verses/*
 *
 * 사용법:
 *   드라이런 (기본):  npx tsx scripts/migrate_paths.ts
 *   실제 실행:        DRY_RUN=false npx tsx scripts/migrate_paths.ts
 *   이전 경로 삭제:   DRY_RUN=false DELETE_OLD=true npx tsx scripts/migrate_paths.ts
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const admin = require('firebase-admin');

// ── 환경 설정 ──────────────────────────────────────────────────
const DRY_RUN  = process.env.DRY_RUN  !== 'false';   // 기본: dry-run
const DELETE_OLD = process.env.DELETE_OLD === 'true' && !DRY_RUN;

const serviceAccountPath = path.resolve(__dirname, '../../Ordo/service-account.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db: FirebaseFirestore.Firestore = admin.firestore();

const BATCH_SIZE = 400;

console.log('');
console.log('══════════════════════════════════════════════');
console.log('  Firestore 경로 마이그레이션 (ordo-eb11a)');
console.log('══════════════════════════════════════════════');
console.log(`  MODE: ${DRY_RUN ? '🔍 DRY RUN (읽기 전용)' : '⚡ EXECUTE (실제 쓰기)'}`);
console.log(`  DELETE_OLD: ${DELETE_OLD ? '🗑️ 이전 경로 삭제 ON' : 'OFF'}`);
console.log('══════════════════════════════════════════════');
console.log('');

// ── 공통: 컬렉션 재귀 복사 ─────────────────────────────────────
async function copyCollection(
  sourcePath: string,
  targetPath: string,
  depth = 0,
): Promise<number> {
  const indent = '  '.repeat(depth);
  const snapshot = await db.collection(sourcePath).get();

  if (snapshot.empty) {
    console.log(`${indent}  (빈 컬렉션: ${sourcePath})`);
    return 0;
  }

  let total = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    const targetRef = db.collection(targetPath).doc(docSnap.id);

    if (!DRY_RUN) {
      batch.set(targetRef, docSnap.data(), { merge: true });
      batchCount++;
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    total++;

    // 서브컬렉션 재귀
    const subcols = await docSnap.ref.listCollections();
    for (const subcol of subcols) {
      const subSource = `${sourcePath}/${docSnap.id}/${subcol.id}`;
      const subTarget = `${targetPath}/${docSnap.id}/${subcol.id}`;
      console.log(`${indent}    ↳ 서브컬렉션: ${subcol.id}`);
      total += await copyCollection(subSource, subTarget, depth + 2);
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  return total;
}

// ── 공통: 컬렉션 재귀 삭제 ─────────────────────────────────────
async function deleteCollection(colPath: string, depth = 0): Promise<number> {
  const indent = '  '.repeat(depth);
  const snapshot = await db.collection(colPath).get();
  if (snapshot.empty) return 0;

  let total = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    // 서브컬렉션 먼저 재귀 삭제
    const subcols = await docSnap.ref.listCollections();
    for (const subcol of subcols) {
      total += await deleteCollection(`${colPath}/${docSnap.id}/${subcol.id}`, depth + 1);
    }

    batch.delete(docSnap.ref);
    batchCount++;
    total++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();

  console.log(`${indent}  🗑️  삭제 완료: ${colPath} (${total}건)`);
  return total;
}

// ── Task 1: app_altar/v1/* → app_datas/ordo-altar/* ──────────────
async function migrateAppAltar() {
  console.log('▶ [1/4] app_altar/v1 서브컬렉션 → app_datas/ordo-altar/');

  // 루트 문서 확인
  const v1Ref = db.doc('app_altar/v1');
  const subcols = await v1Ref.listCollections();

  if (subcols.length === 0) {
    console.log('  (서브컬렉션 없음, 스킵)');
    return;
  }

  // app_datas/ordo-altar 루트 문서 생성 (서브컬렉션 탐색 가능하도록)
  if (!DRY_RUN) {
    await db.doc('app_datas/ordo-altar').set(
      { migrated_at: admin.firestore.Timestamp.now(), source: 'app_altar/v1' },
      { merge: true },
    );
  }

  for (const subcol of subcols) {
    const sourcePath = `app_altar/v1/${subcol.id}`;
    const targetPath = `app_datas/ordo-altar/${subcol.id}`;
    console.log(`  📦 ${sourcePath} → ${targetPath}`);
    const count = await copyCollection(sourcePath, targetPath, 1);
    console.log(`     ✅ ${count}건 ${DRY_RUN ? '(dry-run)' : '복사 완료'}`);
  }

  if (DELETE_OLD) {
    for (const subcol of subcols) {
      await deleteCollection(`app_altar/v1/${subcol.id}`, 1);
    }
    // 루트 문서 삭제
    await v1Ref.delete();
    console.log('  🗑️  app_altar/v1 루트 문서 삭제 완료');
  }
}

// ── Task 2: daily_verses/* → ordo_contents/daily_contents/daily_verses/* ──
async function migrateDailyVerses() {
  console.log('▶ [2/4] daily_verses/ → ordo_contents/daily_contents/daily_verses/');

  // 중간 문서 생성
  if (!DRY_RUN) {
    await db.doc('ordo_contents/daily_contents').set(
      { migrated_at: admin.firestore.Timestamp.now() },
      { merge: true },
    );
  }

  const count = await copyCollection('daily_verses', 'ordo_contents/daily_contents/daily_verses', 1);
  console.log(`  ✅ ${count}건 ${DRY_RUN ? '(dry-run)' : '복사 완료'}`);

  if (DELETE_OLD) {
    await deleteCollection('daily_verses', 1);
  }
}

// ── Task 3: dashboard_news/* → ordo_contents/dashboard_news/items/* ──
async function migrateDashboardNews() {
  console.log('▶ [3/4] dashboard_news/ → ordo_contents/dashboard_news/items/');

  // 중간 문서 생성
  if (!DRY_RUN) {
    await db.doc('ordo_contents/dashboard_news').set(
      { migrated_at: admin.firestore.Timestamp.now() },
      { merge: true },
    );
  }

  const count = await copyCollection('dashboard_news', 'ordo_contents/dashboard_news/items', 1);
  console.log(`  ✅ ${count}건 ${DRY_RUN ? '(dry-run)' : '복사 완료'}`);

  if (DELETE_OLD) {
    await deleteCollection('dashboard_news', 1);
  }
}

// ── Task 4: users_verbum/{uid}/saved_verses → app_datas/ordo-verbum/users/{uid}/saved_verses ──
async function migrateUsersVerbum() {
  console.log('▶ [4/4] users_verbum/{uid}/saved_verses → app_datas/ordo-verbum/users/{uid}/saved_verses');

  // listDocuments()를 사용해야 필드 없이 서브컬렉션만 가진 "가상 문서"도 포함됨
  // (get()은 실제 필드가 있는 문서만 반환)
  const userDocRefs = await db.collection('users_verbum').listDocuments();

  if (userDocRefs.length === 0) {
    console.log('  (users_verbum 컬렉션 비어있음, 스킵)');
    return;
  }

  console.log(`  사용자 ${userDocRefs.length}명 발견`);

  let totalUsers = 0;
  let totalVerses = 0;

  for (const userRef of userDocRefs) {
    const uid = userRef.id;
    const savedVersesSnap = await db
      .collection(`users_verbum/${uid}/saved_verses`)
      .get();

    if (savedVersesSnap.empty) {
      console.log(`  👤 ${uid}: saved_verses 없음, 스킵`);
      continue;
    }

    totalUsers++;
    const targetBase = `app_datas/ordo-verbum/users/${uid}/saved_verses`;

    let batch = db.batch();
    let batchCount = 0;

    for (const verseDoc of savedVersesSnap.docs) {
      if (!DRY_RUN) {
        const ref = db.collection(targetBase).doc(verseDoc.id);
        batch.set(ref, verseDoc.data(), { merge: true });
        batchCount++;
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
      totalVerses++;
    }

    if (!DRY_RUN && batchCount > 0) await batch.commit();

    console.log(`  👤 ${uid}: saved_verses ${savedVersesSnap.size}건 ${DRY_RUN ? '(dry-run)' : '복사 완료'}`);
  }

  console.log(`  ✅ 총 ${totalUsers}명, ${totalVerses}건 ${DRY_RUN ? '(dry-run)' : '복사 완료'}`);

  if (DELETE_OLD) {
    // 각 사용자 문서의 saved_verses 서브컬렉션 삭제 후 가상 문서는 자동 소멸
    for (const userRef of userDocRefs) {
      await deleteCollection(`users_verbum/${userRef.id}/saved_verses`, 1);
    }
    console.log('  🗑️  users_verbum 삭제 완료');
  }
}

// ── 메인 ──────────────────────────────────────────────────────────
async function main() {
  try {
    await migrateAppAltar();
    console.log('');
    await migrateDailyVerses();
    console.log('');
    await migrateDashboardNews();
    console.log('');
    await migrateUsersVerbum();

    console.log('');
    console.log('══════════════════════════════════════════════');
    console.log(`  ${DRY_RUN ? '🔍 DRY RUN 완료 (실제 변경 없음)' : '✅ 마이그레이션 완료'}`);
    if (DRY_RUN) {
      console.log('  실제 실행: DRY_RUN=false npx tsx scripts/migrate_paths.ts');
    }
    console.log('══════════════════════════════════════════════');
    process.exit(0);
  } catch (err) {
    console.error('❌ 마이그레이션 실패:', err);
    process.exit(1);
  }
}

main();
