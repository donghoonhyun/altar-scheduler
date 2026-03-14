# PRD: altar-scheduler-dev → ordo-eb11a 마이그레이션 가이드

> 최초 작성: 2026-02-27
> 목적: altar-scheduler-dev(구 프로젝트)의 데이터를 ordo-eb11a(Ordo 통합 프로젝트)로 이관하는 절차를 문서화하여, 향후 재이관 시 참조한다.

---

## 1. 개요

### 배경

Altar Scheduler는 원래 독립 Firebase 프로젝트(`altar-scheduler-dev`)로 운영되다가, Ordo 에코시스템(`ordo-eb11a`)으로 통합됐다. 통합 과정에서 사용자 인증(Auth)과 Firestore 데이터를 신규 프로젝트로 이관해야 한다.

### 이관 대상 / 제외 대상

| 구분 | 컬렉션 | 비고 |
|------|--------|------|
| ✅ 이관 | `authentication` | Auth 사용자 계정 |
| ✅ 이관 | `/users` | 사용자 프로필 (Ordo 스키마 필드만) |
| ✅ 이관 | `/memberships` | 복사단 멤버십/역할 |
| ✅ 이관 | `/server_groups` | 복사단 + 전체 서브컬렉션 |
| ❌ 제외 | `/parishes` | Ordo 공용 데이터, 충돌 위험 |
| ❌ 제외 | `/counters` | Ordo에서 별도 관리 |
| ❌ 제외 | `/system_notification_logs` | 운영 로그, 이관 불필요 |
| ❌ 제외 | `/system_settings` | 운영 설정, 이관 불필요 |
| ❌ 제외 | `/system_sms_logs` | 운영 로그, 이관 불필요 |

### Firestore 경로 매핑

| Source (altar-scheduler-dev) | Target (ordo-eb11a) |
|------------------------------|---------------------|
| `/users/{uid}` | `/users/{mappedUid}` (루트 공용) |
| `/memberships/{id}` | `app_datas/ordo-altar/memberships/{id}` |
| `/server_groups/{sgId}/**` | `app_datas/ordo-altar/server_groups/{sgId}/**` |

---

## 2. 스크립트 구조

```
scripts/migration/
├── init_migration.ts       # Firebase App 초기화 (source/target 2개)
├── migrate_auth.ts         # Auth 이관 + UID 매핑 관리
├── migrate_users.ts        # /users 컬렉션 이관
├── migrate_collections.ts  # /memberships, /server_groups 이관
├── run_migration.ts        # 오케스트레이터 (환경변수로 제어)
└── uid_map.json            # (실행 후 생성) 구 UID → Ordo UID 매핑 파일
```

### Service Account 파일 위치

| 파일 | 대상 프로젝트 |
|------|-------------|
| `scripts/service-account.json` | altar-scheduler-dev (Source) |
| `../Ordo/service-account.json` | ordo-eb11a (Target) |

---

## 3. 핵심 설계 원칙

### 3.1 Auth 이관 전략 (안전한 Merge)

```
Source 사용자 (altar-scheduler-dev)
    ↓
이메일로 Ordo(target)에 존재하는지 확인
    ├── 존재 → UID 매핑만 기록, Ordo 계정 절대 수정 안 함
    └── 없음 → 동일 UID로 생성 시도
                ├── 성공 → UID 매핑: srcUid → srcUid (동일)
                └── UID 충돌 → 새 UID 발급, UID 매핑: srcUid → newUid
```

### 3.2 UID 매핑 (`uid_map.json`)

- **목적**: 구 altar-scheduler-dev UID와 Ordo UID가 다른 경우를 추적
- **저장 시점**: `DRY_RUN=false` 실행 시 Auth 이관 완료 후 자동 저장
- **재사용**: 이후 단계(users, collections)에서 인메모리 또는 파일에서 로드
- **활용**: Firestore 문서 내 `uid`, `user_id`, `parent_uid`, `member_ids`, `not_available_members` 필드에 자동 적용

**2026-02-27 이관 시 UID 변경된 사용자 (2명):**

| 이메일 | 구 UID (altar-dev) | 신규 UID (ordo) |
|--------|-------------------|----------------|
| jeltoo.sim@gmail.com | `C8X6VrM2FAUjJ1KloHRbPVMFbM83` | `wrJBK1iqviXbF94hmTb9Uo9wDz13` |
| pongso.hyun@gmail.com | `CqpbZdWNnUMv8dEFdvHlZ5MjtX93` | `xAqzydKC9CMbMYGO8GUKft4LUTg2` |

### 3.3 `/users` 이관 전략

- **Ordo 스키마 허용 필드만 복사** (무관 필드 무단 추가 금지)
  - 허용: `uid`, `email`, `user_name`, `baptismal_name`, `user_category`, `phone`, `created_at`, `updated_at`
  - 제외: `role` (구 시스템 필드), `fcm_tokens` (운영 중 자동 관리), `managerParishes` (어드민 캐시)
- **Target에 이미 존재하면 건너뜀** → Ordo 기존 사용자 데이터 보호

### 3.4 컬렉션 이관 전략

- `{ merge: true }` 옵션으로 기존 데이터 보호 (없으면 생성, 있으면 업데이트)
- 서브컬렉션 재귀 이관
- `memberships` 문서 ID 재매핑: `{srcUid}_{sgId}` → `{targetUid}_{sgId}`

---

## 4. 실행 방법

### 전제 조건

1. `scripts/service-account.json` (altar-scheduler-dev Admin SDK 키) 존재
2. `../Ordo/service-account.json` (ordo-eb11a Admin SDK 키) 존재
3. `npm install` 완료 (firebase-admin, tsx 필요)

### 명령어

```bash
# 드라이런 (기본값) — 실제 쓰기 없이 이관 예정 내용 확인
npm run migrate

# 실제 이관 실행
npm run migrate:run

# 단계별 개별 실행
## Auth + UID 맵만 (파일 저장까지)
SKIP_USERS=true SKIP_COLLECTIONS=true DRY_RUN=false npx tsx scripts/migration/run_migration.ts

## 컬렉션만 재실행 (uid_map.json 있어야 함)
SKIP_AUTH=true SKIP_USERS=true DRY_RUN=false npx tsx scripts/migration/run_migration.ts

## /users만 재실행 (uid_map.json 있어야 함)
SKIP_AUTH=true SKIP_COLLECTIONS=true DRY_RUN=false npx tsx scripts/migration/run_migration.ts
```

### 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DRY_RUN` | `true` | `false`로 설정해야 실제 쓰기 실행 |
| `SKIP_AUTH` | `false` | `true`: Auth 이관 건너뜀 |
| `SKIP_USERS` | `false` | `true`: /users 이관 건너뜀 |
| `SKIP_COLLECTIONS` | `false` | `true`: 컬렉션 이관 건너뜀 |

---

## 5. 이관 이력

### 2026-02-27 (2차 이관)

| 항목 | 결과 |
|------|------|
| Auth 전체 | 103명 |
| Auth 신규 생성 | 0명 (전원 이미 Ordo에 존재) |
| UID 변경 감지 | 2명 자동 매핑 |
| `/users` 신규 생성 | 0건 (83건 이미 존재, 19건 이메일 없음) |
| `/memberships` 이관 | 110건 |
| `/server_groups` 이관 | 418건 (서브컬렉션 포함) |
| 총 Firestore 쓰기 | **528건** |
| 소요 시간 | 약 43초 |

### 이전 이관 이력

- **2026-01 (1차 이관)**: 최초 시도. 스크립트 원형(`migrate_users.ts`, `migrate_firestore.ts`) 작성.

---

## 6. 주의사항 및 재실행 시 체크리스트

### 재이관 전 확인 사항

- [ ] `uid_map.json` 존재 여부 확인 (없으면 Auth 단계부터 실행)
- [ ] Target DB(`ordo-eb11a`)의 `app_datas/ordo-altar` 경로 기존 데이터 확인
- [ ] Source DB(`altar-scheduler-dev`)에 새로 추가된 사용자/데이터 확인
- [ ] 드라이런 먼저 실행 후 결과 검토

### 안전 장치

- `DRY_RUN=true` (기본값): 실제 쓰기 없이 예정 내용만 출력
- 실제 실행 시 3초 카운트다운 표시
- `/users` 이관 시 Ordo에 이미 존재하는 문서는 절대 덮어쓰지 않음 (skip)
- Auth 이관 시 Ordo 기존 계정 수정 없음 (UID 매핑만 기록)

### 알려진 한계

- **Auth 비밀번호 미이관**: Firebase Admin SDK로는 비밀번호 해시 이동 불가. 신규 사용자는 비밀번호 재설정 필요 (현재 이관에서는 해당 없음)
- **이메일 없는 users 문서 19건**: altar-scheduler-dev의 테스트/고아 데이터로 추정. 이관 제외됨
- **`merge: true` 정책**: 컬렉션 이관 시 기존 Target 데이터를 덮어쓸 수 있음. 필요시 skip 정책으로 변경 고려
