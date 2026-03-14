/**
 * run_migration.ts
 * altar-scheduler-dev → ordo-eb11a 마이그레이션 오케스트레이터
 *
 * 사용법:
 *   # 드라이런 (기본값): 실제 쓰기 없이 이관 예정 내용 확인
 *   npx tsx scripts/migration/run_migration.ts
 *
 *   # Auth만 드라이런
 *   SKIP_USERS=true SKIP_COLLECTIONS=true npx tsx scripts/migration/run_migration.ts
 *
 *   # 실제 이관 (주의! 되돌리기 어려움)
 *   DRY_RUN=false npx tsx scripts/migration/run_migration.ts
 *
 *   # 단계별 개별 실행
 *   SKIP_AUTH=true npx tsx scripts/migration/run_migration.ts           # Auth 건너뜀
 *   SKIP_USERS=true npx tsx scripts/migration/run_migration.ts          # /users 건너뜀
 *   SKIP_COLLECTIONS=true npx tsx scripts/migration/run_migration.ts    # 컬렉션 건너뜀
 *
 * 환경변수:
 *   DRY_RUN         = "false" 로 설정 시 실제 쓰기 실행 (기본: true = 드라이런)
 *   SKIP_AUTH       = "true" 로 설정 시 Auth 이관 건너뜀
 *   SKIP_USERS      = "true" 로 설정 시 /users 이관 건너뜀
 *   SKIP_COLLECTIONS= "true" 로 설정 시 컬렉션 이관 건너뜀
 */

import { migrateAuth } from './migrate_auth';
import { migrateUsers } from './migrate_users';
import { migrateCollections } from './migrate_collections';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const SKIP_AUTH = process.env.SKIP_AUTH === 'true';
const SKIP_USERS = process.env.SKIP_USERS === 'true';
const SKIP_COLLECTIONS = process.env.SKIP_COLLECTIONS === 'true';

async function main() {
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log('🏁 altar-scheduler-dev → ordo-eb11a 마이그레이션 시작');
  console.log('='.repeat(60));
  console.log(`  DRY_RUN:          ${DRY_RUN} ${DRY_RUN ? '(실제 쓰기 없음)' : '⚠️  실제 쓰기 실행!'}`);
  console.log(`  SKIP_AUTH:        ${SKIP_AUTH}`);
  console.log(`  SKIP_USERS:       ${SKIP_USERS}`);
  console.log(`  SKIP_COLLECTIONS: ${SKIP_COLLECTIONS}`);
  console.log('='.repeat(60));

  if (!DRY_RUN) {
    console.log('\n⚠️  실제 이관 모드입니다. 3초 후 시작합니다...');
    await new Promise(r => setTimeout(r, 3000));
  }

  try {
    // Step 1: Auth 이관
    if (!SKIP_AUTH) {
      await migrateAuth(DRY_RUN);
    } else {
      console.log('\n⏭️  [SKIP] Auth 이관 건너뜀');
    }

    // Step 2: /users 컬렉션 이관
    if (!SKIP_USERS) {
      await migrateUsers(DRY_RUN);
    } else {
      console.log('\n⏭️  [SKIP] /users 이관 건너뜀');
    }

    // Step 3: /memberships, /server_groups 이관
    if (!SKIP_COLLECTIONS) {
      await migrateCollections(DRY_RUN);
    } else {
      console.log('\n⏭️  [SKIP] 컬렉션 이관 건너뜀');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log(`✅ 마이그레이션 완료! (소요시간: ${elapsed}초)`);
    if (DRY_RUN) {
      console.log('   ※ DryRun 모드였습니다. 실제 이관하려면 DRY_RUN=false 설정 필요.');
    }
    console.log('='.repeat(60));
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error);
    process.exit(1);
  }
}

main();
