/**
 * migrate_auth.ts
 * Firebase Authentication 사용자 이관
 *
 * 전략:
 * - Source(altar-scheduler-dev) 사용자를 Target(ordo-eb11a)에 merge
 * - 이미 Ordo에 동일 email이 있으면 → UID 매핑만 기록, Ordo 계정 건드리지 않음
 * - Ordo에 없으면 → 동일 UID로 생성 시도 (UID 충돌 시 새 UID 발급)
 * - UID 매핑은 uid_map.json에 영구 저장 (재실행 시 재사용)
 */
import { sourceAuth, targetAuth } from './init_migration';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UID_MAP_FILE = path.resolve(__dirname, 'uid_map.json');

// UID 매핑: { sourceUid: targetUid }
export let uidMap: Record<string, string> = {};

export function loadUidMap() {
  // 이미 인메모리에 데이터가 있으면 파일 로드 불필요 (같은 프로세스에서 migrateAuth 실행 후인 경우)
  if (Object.keys(uidMap).length > 0) {
    console.log(`📂 UID 맵 이미 로드됨 (${Object.keys(uidMap).length}개 항목, 파일 로드 건너뜀)`);
    return;
  }
  if (existsSync(UID_MAP_FILE)) {
    uidMap = JSON.parse(readFileSync(UID_MAP_FILE, 'utf-8'));
    console.log(`📂 uid_map.json 로드 완료 (${Object.keys(uidMap).length}개 항목)`);
  } else {
    uidMap = {};
    console.log('📂 uid_map.json 없음 (Auth 이관을 먼저 실행하거나 DRY_RUN=false로 재실행 필요)');
  }
}

export function saveUidMap() {
  writeFileSync(UID_MAP_FILE, JSON.stringify(uidMap, null, 2), 'utf-8');
  console.log(`💾 uid_map.json 저장 완료 (${Object.keys(uidMap).length}개 항목)`);
}

export async function migrateAuth(dryRun = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔐 [Auth 이관] DryRun=${dryRun}`);
  console.log(`${'='.repeat(60)}`);

  loadUidMap();

  let pageToken: string | undefined;
  const stats = { total: 0, skipped_no_email: 0, already_mapped: 0, exists_in_ordo: 0, created: 0, errors: 0 };

  do {
    const result = await sourceAuth.listUsers(1000, pageToken);

    for (const srcUser of result.users) {
      stats.total++;
      const { uid, email } = srcUser;

      // 이메일 없는 계정 건너뜀
      if (!email) {
        console.warn(`  ⚠️  [SKIP] UID=${uid} (이메일 없음)`);
        stats.skipped_no_email++;
        continue;
      }

      // 이미 매핑된 UID → 건너뜀
      if (uidMap[uid] !== undefined) {
        stats.already_mapped++;
        continue;
      }

      try {
        // Target에 동일 이메일 존재 여부 확인
        let existingTargetUser = null;
        try {
          existingTargetUser = await targetAuth.getUserByEmail(email);
        } catch (e: any) {
          if (e.code !== 'auth/user-not-found') throw e;
        }

        if (existingTargetUser) {
          // Ordo에 이미 존재 → 매핑만 기록, 계정 수정 없음
          uidMap[uid] = existingTargetUser.uid;
          stats.exists_in_ordo++;
          const suffix = uid !== existingTargetUser.uid ? ` ⚠️ UID변경: ${uid} → ${existingTargetUser.uid}` : '';
          console.log(`  ✅ [EXISTS] ${email}${suffix}`);
        } else {
          // Ordo에 없음 → 신규 생성
          if (!dryRun) {
            try {
              await targetAuth.createUser({
                uid,
                email,
                emailVerified: srcUser.emailVerified,
                displayName: srcUser.displayName || undefined,
                photoURL: srcUser.photoURL || undefined,
                disabled: srcUser.disabled,
              });
              uidMap[uid] = uid;
              stats.created++;
              console.log(`  ✨ [CREATE] ${email} (uid=${uid})`);
            } catch (createErr: any) {
              if (createErr.code === 'auth/uid-already-exists') {
                // UID만 충돌 (이메일은 없는데 UID가 이미 있는 희귀 케이스)
                const newUser = await targetAuth.createUser({
                  email,
                  emailVerified: srcUser.emailVerified,
                  displayName: srcUser.displayName || undefined,
                });
                uidMap[uid] = newUser.uid;
                stats.created++;
                console.warn(`  ⚠️  [CREATE-NEW-UID] UID 충돌로 새 UID 발급: ${email} (${uid} → ${newUser.uid})`);
              } else {
                throw createErr;
              }
            }
          } else {
            // DryRun: 실제 생성하지 않음
            console.log(`  📋 [DRYRUN] 생성 예정: ${email} (uid=${uid})`);
            stats.created++;
          }
        }
      } catch (err) {
        stats.errors++;
        console.error(`  ❌ [ERROR] ${email}:`, err);
      }
    }

    pageToken = result.pageToken;
  } while (pageToken);

  // DryRun이 아닌 경우에만 저장
  if (!dryRun) {
    saveUidMap();
  } else {
    console.log('\n  (DryRun: uid_map.json 저장 건너뜀)');
  }

  console.log('\n📊 [Auth 이관 결과]');
  console.log(`  전체:              ${stats.total}`);
  console.log(`  이메일 없어 건너뜀:  ${stats.skipped_no_email}`);
  console.log(`  이미 매핑됨:        ${stats.already_mapped}`);
  console.log(`  Ordo에 이미 존재:   ${stats.exists_in_ordo}`);
  console.log(`  신규 생성:          ${stats.created}`);
  console.log(`  오류:              ${stats.errors}`);
}
