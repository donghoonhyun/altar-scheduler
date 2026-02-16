# Ordo 플랫폼 통합을 위한 마이그레이션 계획서 (Altar Scheduler)

## 1. 개요 (Overview)
본 문서는 `Altar Scheduler` 애플리케이션을 Ordo 플랫폼의 생태계로 통합하기 위한 기술적 마이그레이션 계획을 기술합니다. 
Ordo 플랫폼은 여러 가톨릭 관련 앱들이 공유하는 통합 환경을 제공하며, 이를 위해 공통 데이터(사용자, 본당 정보 등)와 인증 시스템(Authentication)을 통합 관리합니다.

### 1.1 목표 (Goals)
1.  **Auth 통합**: `Altar Scheduler`의 인증 시스템을 Ordo 통합 Firebase Authentication (`ordo-eb11a`)으로 전환합니다.
    *   **사용자 영향도**: 기존 사용자는 Ordo Auth로 재인증(로그인)이 필요합니다.
2.  **DB 구조 통합**: `Altar Scheduler`의 데이터를 Ordo Firestore로 이전하되, **공통 영역**과 **앱 전용 영역**(Versioned)으로 구분하여 재구성합니다.
3.  **기존 앱 유지 (Seamless Experience)**: `Altar Scheduler` 애플리케이션 코드를 수정하여 Ordo 백엔드와 통신하도록 설정하고, 기존 도메인(`altar-scheduler-dev.web.app`)을 유지하여 사용자가 동일한 경험을 하도록 합니다.

---

## 2. 타겟 아키텍처 (Target Architecture)

### 2.1 Firebase 프로젝트
*   **Target Project**: `ordo-eb11a` (Production)
*   **Authentication**: Ordo 프로젝트의 Authentication을 사용 (SSO 효과).

### 2.2 Firestore 데이터 구조 (Schema Design)
Ordo 생태계의 데이터 구조 원칙(PRD-Ordo Eco 참조)에 따라 다음과 같이 매핑합니다.
**앱 전용 데이터는 `/app_altar/v1/...` 구조를 채택하여 버전 관리 및 데이터 격리를 수행합니다.**

| 구분 | 기존 컬렉션 (Altar Scheduler) | 변경 후 경로 (Ordo) | 설명 |
| :--- | :--- | :--- | :--- |
| **공통 (Shared)** | `/users/{uid}` | `/users/{uid}` | Ordo 통합 사용자 프로필. 필요한 경우 `/users/{uid}/app_altar_profile` 서브컬렉션 사용. |
| **공통 (Shared)** | `/parishes/{code}` | `/parishes/{code}` | Ordo 통합 본당 정보. |
| **앱 전용 (App Specific)** | `/server_groups/{id}` | `/app_altar/v1/server_groups/{id}` | 전례단 그룹 정보. |
| **앱 전용 (App Specific)** | `/memberships/{id}` | `/app_altar/v1/memberships/{id}` | 그룹 멤버십 정보. |
| **앱 전용 (App Specific)** | `/counters/{id}` | `/app_altar/v1/counters/{id}` | ID 생성용 카운터. |
| **앱 전용 (App Specific)** | `/system_notifications/{id}` | `/app_altar/v1/notifications/{id}` | 알림. |
| **앱 전용 (App Specific)** | `/system_settings/{id}` | `/app_altar/v1/settings/{id}` | 시스템 설정. |
| **앱 전용 (App Specific)** | `/system_sms_logs/{id}` | `/app_altar/v1/sms_logs/{id}` | SMS 로그. |

---

## 3. 마이그레이션 전략 (Migration Strategy)

### 3.1 단계별 진행 계획

#### [Step 1] 데이터 및 Auth 백업 (Export)
*   기존 `altar-scheduler-dev` 프로젝트 등의 데이터를 전체 백업합니다.
*   Firebase CLI를 사용하여 Auth 사용자 목록(password hash 포함)을 내보냅니다.
    ```bash
    firebase auth:export users_altar.json --format=json --project altar-scheduler-dev
    ```

#### [Step 2] 데이터 변환 및 매핑 (Transform)
*   로컬 스크립트를 작성하여 기존 데이터를 Ordo 스키마(`/app_altar/v1/...`)에 맞게 변환합니다.
*   **User Mapping**:
    *   기존 Altar 사용자가 Ordo에 이미 존재하는지 이메일 기준으로 확인.
    *   존재할 경우: 기존 Ordo UID를 사용하도록 Altar 데이터의 `uid` 참조를 업데이트.
    *   없을 경우: Ordo Auth에 신규 사용자로 Import (가능하면 기존 UID 유지).
*   **Path Mapping**:
    *   `collection(db, 'server_groups')` -> `collection(db, 'app_altar', 'v1', 'server_groups')`

#### [Step 3] Ordo DB로 데이터 Import
*   변환된 데이터를 `ordo-eb11a` 프로젝트의 Firestore에 업로드합니다.
*   Auth 사용자 정보를 Ordo Auth에 Import합니다.
    ```bash
    firebase auth:import users_altar.json --hash-config=hash_config.json --project ordo-eb11a
    ```

#### [Step 4] 앱 코드 수정 (Refactoring)
기존 `altar-scheduler` 프로젝트의 소스 코드를 수정하여 `ordo-eb11a` 프로젝트와 연결합니다.
1.  **환경 변수 교체 (`.env`)**: Ordo 프로젝트의 Firebase Config 값으로 `VITE_FIREBASE_...` 키값 변경.
2.  **Firebase 초기화 변경**: `src/firebase.ts` (또는 해당 파일)에서 Ordo Config 사용 확인.
3.  **Firestore 경로 수정**:
    *   `src/services`, `hooks` 등에서 사용되는 모든 컬렉션 경로를 새로운 구조(`/app_altar/v1/...`)로 변경.
    *   `const SERVER_GROUPS_PATH = 'app_altar/v1/server_groups';` 와 같이 상수화하여 관리 권장.
4.  **Cloud Functions 수정**:
    *   Functions의 트리거 경로 및 내부 로직(DB 참조)을 변경된 스키마에 맞게 수정.
    *   Functions 배포 타겟을 `ordo-eb11a`로 변경.

#### [Step 5] 검증 및 배포 (Verification & Deploy)
*   로컬(`npm run dev`)에서 Ordo 프로젝트(개발환경 또는 Prod)에 연결하여 동작 확인.
*   **Hosting 배포**: 수정된 React 앱을 기존 `altar-scheduler` Hosting에 배포하되, 내부는 Ordo 백엔드를 바라보도록 함.
    *   `firebase use altar-scheduler-dev` (Hosting 타겟)
    *   앱 빌드 (`npm run build`) -> 앱 내부는 `ordo-eb11a` 정보 포함.
    *   `firebase deploy --only hosting`

## 4. 사전 점검 사항 (Checklist)
*   [x] Ordo 프로젝트 ID 확인 (`ordo-eb11a`).
*   [x] Ordo Firebase Config 확보 완료.
*   [ ] Altar Scheduler 사용자의 Ordo 계정 중복 여부 확인 필요.

## 5. 실행 계획 (Action Items)
1.  `scripts/migration` 폴더 생성.
2.  데이터 마이그레이션 스크립트 작성 및 실행.
3.  앱 코드 내 Firebase Config 및 컬렉션 경로 일괄 수정.
4.  Cloud Functions 수정 및 배포.
