/**
 * Firestore Rules 병합 및 동기화 스크립트
 * 
 * Ordo 메인 앱의 firestore.rules를 베이스로,
 * Altar Scheduler의 전용 Rules 섹션을 병합하여
 * 최종 firestore.rules를 생성합니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORDO_RULES_PATH = path.join(__dirname, '../../Ordo/firestore.rules');
const ALTAR_RULES_SECTION_PATH = path.join(__dirname, '../firestore.altar-section.txt');
const OUTPUT_RULES_PATH = path.join(__dirname, '../firestore.rules');

// Altar Scheduler 전용 Rules 섹션
const ALTAR_SCHEDULER_SECTION = `
    // ========================================
    // 📂 ALTAR SCHEDULER 전용 컬렉션
    // ========================================

    match /app_altar/{version} {
      
      // Server Groups
      match /server_groups/{groupId} {
        allow read: if isSignedIn();
        allow create: if isSignedIn();
        allow update, delete: if isGroupAdmin(groupId) || isSuperAdmin();
        
        // Availability Surveys
        match /availability_surveys/{surveyId} {
          allow read: if isSignedIn();
          allow write: if isSignedIn();
          
          match /responses/{responseId} {
            allow read, write: if isSignedIn();
          }
        }

        // 하위 컬렉션 기본 규칙 -> Planner도 접근 허용
        match /{document=**} {
          allow read: if isSignedIn();
          allow write: if isGroupPlanner(groupId) || isSuperAdmin();
        }

        // 복사단원(members) 등록은 로그인한 사용자면 누구나 가능
        match /members/{memberId} {
          allow create: if isSignedIn() && request.resource.data.parent_uid == request.auth.uid;
          allow delete: if (isSignedIn() && resource.data.parent_uid == request.auth.uid) || isGroupPlanner(groupId) || isSuperAdmin();
        }
      }

      // Memberships
      match /memberships/{membershipId} {
        allow read, write: if isSignedIn();
      }
      
      // Counters
      match /counters/{counterId} {
        allow read, write: if isSignedIn();
      }

      // Notifications
      match /notifications/{logId} {
         allow read: if isSuperAdmin();
      }

      // SMS Logs
      match /sms_logs/{logId} {
        allow read: if isSuperAdmin();
      }

      // Settings
      match /settings/{settingId} {
        allow read: if isSignedIn();
        allow write: if isSuperAdmin();
      }
    }
    
    // ========================================
    // 📂 Collection Group Query 허용
    // ========================================
    
    match /{path=**}/members/{memberId} {
      allow read: if isSignedIn();
    }
    match /{path=**}/role_requests/{requestId} {
      allow read, write: if isSignedIn();
    }
`;

// Altar Scheduler 헬퍼 함수
const ALTAR_HELPER_FUNCTIONS = `
    // ⚠️ Altar Scheduler 슈퍼어드민 체크 (memberships 기반)
    function isSuperAdminAltar() {
      let globalAdminPath = /databases/$(database)/documents/app_altar/v1/memberships/$(request.auth.uid + '_global');
      return isSignedIn() && exists(globalAdminPath) && 'superadmin' in get(globalAdminPath).data.role;
    }
    
    // Altar Scheduler 헬퍼 함수
    function isGroupAdmin(groupId) {
      let membershipPath = /databases/$(database)/documents/app_altar/v1/memberships/$(request.auth.uid + '_' + groupId);
      return isSignedIn() && exists(membershipPath) && get(membershipPath).data.role.hasAny(['admin']);
    }
    function isGroupPlanner(groupId) {
      let membershipPath = /databases/$(database)/documents/app_altar/v1/memberships/$(request.auth.uid + '_' + groupId);
      return isSignedIn() && exists(membershipPath) && get(membershipPath).data.role.hasAny(['admin', 'planner']);
    }
`;

function mergeRules() {
    console.log('🔄 Merging Firestore Rules...\n');

    // 1. Ordo Rules 읽기
    if (!fs.existsSync(ORDO_RULES_PATH)) {
        console.error(`❌ Ordo rules file not found: ${ORDO_RULES_PATH}`);
        console.error('   Please ensure Ordo project is in the correct location.');
        process.exit(1);
    }

    let ordoRules = fs.readFileSync(ORDO_RULES_PATH, 'utf-8');
    console.log(`✅ Read Ordo rules: ${ORDO_RULES_PATH}`);

    // 2. isSuperAdmin() 함수 수정 (Ordo + Altar 통합)
    ordoRules = ordoRules.replace(
        /function isSuperAdmin\(\) \{[\s\S]*?\n    \}/,
        `// ⚠️ Ordo 슈퍼어드민 체크 (users 컬렉션 기반)
    function isSuperAdminOrdo() {
      let userPath = /databases/$(database)/documents/users/$(request.auth.uid);
      return isSignedIn() && exists(userPath) && get(userPath).data.roles.hasAny(['superadmin']);
    }
${ALTAR_HELPER_FUNCTIONS}
    
    // 통합 슈퍼어드민 (둘 중 하나라도 만족하면 슈퍼어드민)
    function isSuperAdmin() {
      return isSuperAdminOrdo() || isSuperAdminAltar();
    }`
    );

    // 3. Altar Scheduler 섹션 추가 (마지막 } 직전에 삽입)
    const lastBraceIndex = ordoRules.lastIndexOf('  }\n}');
    if (lastBraceIndex === -1) {
        console.error('❌ Could not find insertion point in Ordo rules');
        process.exit(1);
    }

    const mergedRules =
        ordoRules.substring(0, lastBraceIndex) +
        ALTAR_SCHEDULER_SECTION +
        '\n' +
        ordoRules.substring(lastBraceIndex);

    // 4. 결과 저장
    fs.writeFileSync(OUTPUT_RULES_PATH, mergedRules, 'utf-8');
    console.log(`✅ Merged rules saved: ${OUTPUT_RULES_PATH}\n`);

    // 5. 요약 출력
    console.log('📊 Summary:');
    console.log(`   - Ordo base rules: ${ORDO_RULES_PATH}`);
    console.log(`   - Added Altar Scheduler section`);
    console.log(`   - Output: ${OUTPUT_RULES_PATH}`);
    console.log('\n✨ Firestore Rules merge completed!');
    console.log('⚠️  Remember: Deploy rules from Ordo project only!');
}

// 실행
mergeRules();
