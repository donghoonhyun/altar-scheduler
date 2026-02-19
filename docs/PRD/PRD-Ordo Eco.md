# Ordo Ecosystem Definition & Standardization (Ver 1.0.0)

## 1. 개요 (Overview)
Ordo 생태계는 **'Ordo 메인 앱'**을 부모(Parent)로 두고, 그 안에서 유기적으로 연결되는 다양한 **'기능별 자식(Child) 앱'**들로 구성되는 마이크로 프론트엔드 지향적 생태계입니다. 이 문서는 생태계 내 모든 앱이 일관된 사용자 경험(UX)과 기술적 정체성을 유지하기 위한 가이드를 제공합니다.

---

## 2. 생태계 구조 (Ecosystem Structure)
- **부모 앱 (Parent App): Ordo**
  - 생태계의 중심점이며, 사용자 진입로 역할을 합니다.
  - 공통적인 네비게이션(Bottom Nav), 대시보드 기능을 담당합니다.
  - **Unified App Viewer (`/apps/view`)**: 
    - 모든 생태계 앱(설치된 앱, 스토어 미리보기 등)은 독립 호스팅(`*.web.app`)을 가지더라도, 반드시 부모 앱의 **통합 뷰어 페이지**를 통해 실행되어야 합니다.
    - 이를 통해 하단 네비게이션(Bottom Nav) 유지, SSO 자동 처리, 테마 동기화가 보장됩니다.
- **자식 앱 (Child App): OrdoAdmin, Verbum 등**
  - 특정 비즈니스 로직(예: 관리자 기능, 성경/복음 데이터 관리 등)에 집중하는 독립적인 앱입니다.
  - **Shared Features**: 복음 읽기(TTS) 등 공통적으로 유용한 기능은 가능한 표준 구현(Web Speech API 등)을 따릅니다.

---

## 3. 구조화 및 표준화 원칙 (Standardization)
자식 앱 개발 시 다음 원칙을 반드시 준수하여 생태계의 일관성을 유지합니다.

### 3.1 UI/UX 스타일 상속
- **디자인 시스템**: 부모 앱에서 정의된 컬러 팔레트, 타이포그래피, 버튼 스타일, 카드 레이아웃 등을 그대로 계승합니다.
- **컴포넌트**: 가능한 부모 앱의 공통 컴포넌트 라이브러리(또는 스타일 가이드)를 참조하여 개발합니다.
- **브랜딩**: Ordo 생태계 소속임을 알 수 있는 로고 및 아이콘 사용 규칙을 따릅니다.
- **Navigation UX**: 자식 앱 내에서는 '로그아웃'이나 '홈으로' 같은 이탈 버튼을 최소화하거나 햄버거 메뉴(Drawer) 등으로 숨깁니다. (부모 앱의 네비게이션이 존재하기 때문)

### 3.2 명명 규칙 (Naming Convention)
- **프로젝트 명**: `ordo-[app-name]` 형식을 권장합니다.
- **코드 스타일**: 부모 프로젝트에서 사용하는 Lint/Prettier 설정을 공유하며, 파일 및 폴더 명명 규칙을 동일하게 유지합니다.

### 3.3 상태 동기화 (State Synchronization)
- **테마 동기화 (Theme Sync)**:
  - 부모 앱은 자식 앱 호출 시 URL Query Parameter로 `theme=dark|light`를 전달합니다.
  - 자식 앱은 초기 로딩(`App.tsx` 또는 `MainLayout`)에서 이 파라미터를 우선적으로 확인하여 테마를 설정해야 합니다.
- **인증 동기화 (Auth Sync)**:
  - `authtoken` 파라미터가 존재할 경우, 자식 앱은 **앱 초기화(UI 렌더링) 이전에** 해당 토큰으로 로그인을 시도해야 합니다. (Race Condition 방지)

---

## 4. 인프라 및 인증 (Infrastructure & Auth)

### 4.1 Authentication (인증)
- **공유 인증 (Shared Auth)**: 생태계 내 모든 앱은 동일한 Firebase Authentication 프로젝트를 공유합니다. 
- **SSO 메커니즘 (Custom Auth Token)**:
  - 사용자가 부모 앱에서 자식 앱으로 이동할 때, 부모 앱은 Cloud Function (`generateCrossAppAuthToken`)을 통해 **Custom Auth Token**을 생성합니다.
  - 생성된 토큰은 자식 앱 URL의 `authtoken` 파라미터로 전달됩니다. (`iframe src` 또는 리다이렉트 URL)
  - 자식 앱은 로딩 시 `signInWithCustomToken`을 사용하여 자동으로 로그인 처리합니다.

### 4.2 Firestore (데이터베이스)
- **공유 데이터**: 생태계 공통 기능(사용자 프로필의 기본 정보, 설정 등)은 부모 프로젝트의 Firestore `users` 컬렉션을 공유합니다.
- **앱별 데이터 분리 (Data Isolation Strategy)**:
  - 각 자식 앱은 자신의 고유 데이터를 `users` 컬렉션 하위에 두지 않고, **앱 전용 루트 컬렉션** (예: `users_verbum`, `users_ordo`)을 사용하여 관리합니다.
  - 이는 `users` 컬렉션의 비대화를 방지하고, 앱 간 데이터 독립성과 쿼리 효율성을 보장하기 위함입니다.
- **앱 메타데이터 관리**: 
  - 메인 DB의 `apps/` 컬렉션에 생태계 내 모든 자식 앱의 메타정보(이름, 경로, 권한 등)를 저장하고 관리합니다.
  - 해당 앱 리스트 및 메타정보의 관리 UI는 **OrdoAdmin** 앱에서 전담하여 처리합니다.

### 4.3 Cloud Functions (Server-side Logic)
- **배포 주체 (Deployment Source)**:
  - 생태계 전체에서 사용되는 Cloud Functions(알림 발송, 스케줄러, 크롤러 등)의 소스 코드와 배포 권한은 **OrdoAdmin** 프로젝트로 이관되었습니다.
  - **Ordo (Parent App)**은 순수 프론트엔드 호스팅 역할에 집중하며, 백엔드 로직은 포함하지 않습니다.

- **Cloud Functions 배포 격리 (Deployment Isolation)** ⚠️ **[CRITICAL]**
  - 여러 앱이 같은 Firebase 프로젝트를 공유하므로, 함수 배포 시 서로의 코드를 덮어쓰지 않도록 반드시 `codebase` 설정을 분리해야 합니다.
  - **설정 방법**: 각 앱 프로젝트의 `firebase.json` 파일에서 `functions[].codebase` 속성에 고유한 별칭(Alias)을 부여합니다.
    ```json
    // firebase.json 예시
    {
      "functions": [
        {
          "source": "functions",
          "codebase": "altar-scheduler", // 또는 "ordo-admin" 등 앱별 고유 명칭
          "ignore": [...]
        }
      ]
    }
    ```
  - **기대 효과**: `firebase deploy --only functions` 실행 시, 해당 `codebase`에 정의된 함수만 배포/업데이트되며, 다른 `codebase` 소속의 함수는 삭제되지 않고 안전하게 유지됩니다.

- **역할 분담**:
  - **Ordo**: 클라이언트 사이드 렌더링, PWA 호스팅, 사용자 인터페이스.
  - **OrdoAdmin**: 시스템 관리자 기능 + **Cloud Functions 백엔드 호스팅**.

---

## 5. 개발 및 운영 (Development & Operations)

### 5.1 로컬 개발 환경
- 로컬 개발 시 생산성을 위해 서버의 실시간 Authentication 및 Firestore(Staging 또는 Production/Development 환경)에 직접 연결하여 개발을 진행할 수 있습니다.

### 5.2 Firestore Security Rules & Indexes 관리 정책 ⚠️ **[CRITICAL]**

> **🚨 매우 중요**: Firestore Security Rules와 Indexes는 **Firebase 프로젝트당 단 1개만 존재**합니다.  
> 여러 앱이 프로젝트(`ordo-eb11a`)를 공유하므로, **무분별한 Rules 배포는 다른 앱을 즉시 파괴**할 수 있습니다! 이를 방지하기 위해 **'상대 경로 링크'** 방식을 사용하여 모든 앱이 동일한 마스터 파일을 바라보게 합니다.

#### 5.2.1 Rules 관리 원칙 (Fundamental Fix)

1. **단일 진실 공급원 (Single Source of Truth)**:
   - **Ordo 메인 앱**의 `firestore.rules`와 `firestore.indexes.json`이 **마스터(Master)**입니다.
   - 모든 자식 앱은 자신의 로컬 파일을 관리하지 않고, **Ordo 프로젝트의 마스터 파일을 직접 참조**하도록 설정합니다.

2. **firebase.json 설정 (권장 방식)**:
   - 자식 앱의 `firebase.json`에서 `firestore` 섹션을 다음과 같이 수정하여 Ordo 프로젝트의 파일을 바라보게 합니다.
   ```json
   {
     "firestore": {
       "rules": "../Ordo/firestore.rules",
       "indexes": "../Ordo/firestore.indexes.json"
     }
   }
   ```
   - 이렇게 설정하면 에뮬레이터 실행 및 배포 시 자동으로 Ordo의 최신 Rules/Indexes가 사용되므로 별도의 동기화 작업이 필요 없습니다.

3. **자식 앱의 Rules 추가 프로세스**:
   - 자식 앱 개발 시 새로운 Rules가 필요하면, **Ordo 프로젝트의 `firestore.rules`**에 해당 섹션을 추가한 후 저장합니다.
   - 이후 어떤 앱에서 `firebase deploy --only firestore`를 실행하더라도 항상 동일한 마스터 파일이 배포됩니다.

4. **절대 금지 사항** ❌:
   - ❌ 자식 앱 프로젝트 내에 별도의 `firestore.rules` 생성 및 배포
   - ❌ 마스터 파일(`../Ordo/firestore.rules`)의 기존 규칙 임의 수정/삭제

#### 5.2.2 Rules 파일 구조 예시 (Master)
... (기존 예시 유지)

#### 5.2.3 스토리지 규칙 (Storage Rules)
- Storage 역시 동일하게 `Ordo/storage.rules`를 마스터로 사용하며, 각 앱의 `firebase.json`에서 아래와 같이 설정합니다.
  ```json
  "storage": {
    "rules": "../Ordo/storage.rules"
  }
  ```

```javascript
// firestore.rules (Ordo 메인 앱 마스터)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ========================================
    // 📂 ORDO 공통 컬렉션 (유지 필수!)
    // ========================================
    match /users/{userId} { ... }
    match /parishes/{parishCode} { ... }
    match /apps/{appId} { ... }
    // ... 기타 Ordo 공통 Rules
    
    // ========================================
    // 📂 VERBUM 앱 전용
    // ========================================
    match /users_verbum/{userId}/{document=**} { ... }
    
    // ========================================
    // 📂 ALTAR SCHEDULER 앱 전용
    // ========================================
    match /app_altar/{version} {
      match /server_groups/{groupId} { ... }
      match /memberships/{membershipId} { ... }
      // ... Altar Scheduler 전용 Rules
    }
    
    // ========================================
    // 📂 기타 자식 앱들...
    // ========================================
  }
}
```

#### 5.2.3 비상 복구 절차

만약 실수로 잘못된 Rules가 배포되어 앱이 작동하지 않을 경우:

1. **Firebase Console**에서 이전 버전 Rules 확인:
   - Console → Firestore → Rules → "Manage Versions"
   
2. **즉시 롤백**:
   ```bash
   # Firebase Console에서 이전 버전으로 복원 또는
   # Ordo 프로젝트의 Git 히스토리에서 복구 후 재배포
   cd /path/to/Ordo
   git checkout HEAD~1 -- firestore.rules
   firebase deploy --only firestore:rules
   ```

#### 5.2.4 Rules 동기화 스크립트 (권장)

자식 앱 프로젝트에 다음 스크립트 추가:

```json
// package.json (자식 앱)
{
  "scripts": {
    "sync-rules": "cp ../Ordo/firestore.rules ./firestore.rules",
    "deploy:rules": "echo '⚠️  Rules는 Ordo 메인 앱에서만 배포하세요!' && exit 1"
  }
}
```

---

### 5.3 보안 규칙 테스트 (Rules Testing)
- 이 문서(`PRD-Ordo Eco.md`)는 생태계의 헌법과 같습니다. 
- 업데이트 시 반드시 버전을 명시하며, 자식 앱 개발자는 항상 **최신 버전의 Eco PRD**를 참조하여 개발 중 발생할 수 있는 충돌을 최소화합니다.

---

## 6. 문서 관리 규정
- **위치**: 모든 프로젝트(부모/자식 포함)의 `docs/PRD/` 폴더 내에 위치해야 합니다.
- **동기화**: 생태계 정책 변경 시, 모든 앱의 해당 가이드 파일이 최신 상태로 업데이트되어야 합니다.

---

*본 문서는 Ordo 생태계의 지속 가능한 확장을 위해 작성되었습니다.*
