import { sourceAuth, targetAuth, sourceDB, targetDB } from './init_migration';
import { UserRecord } from 'firebase-admin/auth';
import * as admin from 'firebase-admin';

// -------------------------------------------------------------
// 1. 사용자 마이그레이션 (Auth)
// -------------------------------------------------------------

async function migrateUsers() {
  console.log('🚀 Starting User Migration...');

  let pageToken: string | undefined;

  do {
    // 1-1. Source(Altar) 사용자 목록 가져오기 (1000명씩)
    const listUsersResult = await sourceAuth.listUsers(1000, pageToken);
    const sourceUsers = listUsersResult.users;

    for (const sourceUser of sourceUsers) {
      const uid = sourceUser.uid;
      const email = sourceUser.email;

      if (!email) {
        console.warn(`⚠️ Skipping user ${uid} (No Email)`);
        continue;
      }

      try {
        // 1-2. Target(Ordo)에 동일한 이메일의 유저가 있는지 확인
        let existingUser: UserRecord | null = null;
        try {
          existingUser = await targetAuth.getUserByEmail(email);
        } catch (error: any) {
          if (error.code !== 'auth/user-not-found') throw error;
        }

        if (existingUser) {
          console.log(`✅ User exists in Ordo: ${email} (UID: ${existingUser.uid})`);
          // TODO: UID 매핑 정보 저장 (필요 시)
          // Altar UID -> Ordo UID 매핑 테이블이 필요할 수 있음.
          // 하지만 여기선 일단 "기존 Altar UID를 그대로 사용"하는 것을 최우선으로 시도.
          // 만약 Ordo에 이미 존재하는 유저라면, Altar 데이터의 UID 참조를 Ordo UID로 바꿔야 함.
          await mapUserUid(uid, existingUser.uid);
        } else {
          // 1-3. Ordo에 유저 없음 -> 신규 생성 (Altar UID 그대로 사용 시도)
          try {
            await targetAuth.createUser({
              uid: uid, // Altar UID 유지
              email: email,
              emailVerified: sourceUser.emailVerified,
              displayName: sourceUser.displayName,
              photoURL: sourceUser.photoURL,
              phoneNumber: sourceUser.phoneNumber,
              disabled: sourceUser.disabled,
              // Password Hash는 별도 처리가 필요하거나, 유저에게 재설정 요청.
              // 여기서는 프로필 정보만 마이그레이션.
              // 비밀번호까지 옮기려면 export/import 명령어를 써야 함 (스크립트로는 불가).
            });
            console.log(`✨ Imported user to Ordo: ${email} (UID: ${uid})`);
            await mapUserUid(uid, uid); // Same UID
          } catch (createError: any) {
            if (createError.code === 'auth/uid-already-exists') {
              // UID 충돌 -> Ordo UID 생성 후 매핑 필요
              // (매우 드문 케이스, 이메일은 없는데 UID만 같은 경우)
              const newUser = await targetAuth.createUser({
                email: email,
                emailVerified: sourceUser.emailVerified,
                displayName: sourceUser.displayName,
              });
              console.warn(`⚠️ UID Collision! User created with NEW UID: ${newUser.uid}`);
              await mapUserUid(uid, newUser.uid);
            } else {
              throw createError;
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error migrating user ${email}:`, err);
      }
    }
    pageToken = listUsersResult.pageToken;
  } while (pageToken);

  console.log('✅ User Migration Completed.');
}

// -------------------------------------------------------------
// 2. UID 매핑 저장용 (메모리 or 파일)
// -------------------------------------------------------------
const uidMap: Record<string, string> = {}; // { AltarUID: OrdoUID }

async function mapUserUid(altarUid: string, ordoUid: string) {
  uidMap[altarUid] = ordoUid;
}

export { migrateUsers, uidMap };
