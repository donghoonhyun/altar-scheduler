# 플래너 권한 신청 프로세스 설계 가이드

## 1. 개요
현재는 회원가입 후 무조건 복사 등록 화면(`/add-member`)으로 이동하지만, 플래너 사용자의 경우 복사 등록이 아닌 **권한 신청** 과정이 필요합니다. 이를 위해 플래너 권한 신청 화면을 신설하고, 승인 요청을 저장하는 프로세스를 구축합니다.

## 2. 데이터베이스 스키마 설계
권한 요청 데이터를 관리하기 위해 각 복사단 하위에 `role_requests` 컬렉션을 신설합니다.

- **Collection Path**: `server_groups/{serverGroupId}/role_requests`
- **Document ID**: `{userId}` (사용자 UID)
- **Fields**:
  ```typescript
  interface RoleRequest {
    uid: string;             // 사용자 UID
    email: string;           // 사용자 이메일
    user_name: string;        // 이름
    baptismal_name: string;   // 세례명
    phone: string;           // 전화번호
    role: 'planner';         // 요청 권한 (현재는 플래너 고정)
    status: 'pending';       // 상태 (pending | approved | rejected)
    created_at: FieldValue;  // 생성일시
    updated_at: FieldValue;  // 수정일시
  }
  ```

## 3. 화면 및 흐름 설계

### 3.1. 진입점 연결 (`AddMember.tsx`)
복사 등록 화면 하단에 플래너 권한 신청 페이지로 이동하는 링크/버튼을 추가합니다.
> "플래너로 활동하실 예정인가요? [플래너 권한 신청]"

### 3.2. 신규 화면: 플래너 권한 신청 (`RequestPlannerRole.tsx`)
- **경로**: `/request-planner-role`
- **주요 기능**:
  1. **성당/복사단 선택**: `AddMember`와 동일한 로직으로 성당 및 복사단을 선택합니다.
  2. **신청자 정보 입력**: 이름, 세례명, 전화번호를 입력합니다. (기존 프로필 정보가 있다면 프리필)
  3. **신청 완료**: DB `role_requests` 컬렉션에 문서를 생성합니다.
  4. **완료 처리**: 신청 완료 후 "승인 대기 중입니다" 메시지를 띄우고 홈(또는 대기 화면)으로 이동합니다.

### 3.3. 라우팅 처리 (`AppRoutes.tsx`)
- 신규 페이지 `/request-planner-role`에 대한 라우트를 추가합니다.

## 4. 이후 승인 프로세스 (참고용)
해당 복사단의 관리자(Admin)는 추후 '멤버 관리' 메뉴에서 `role_requests`의 `pending` 목록을 조회하고 승인(`approve`) 처리를 할 수 있습니다. 승인 시 `memberships` 컬렉션에 해당 사용자를 `planner`로 등록하게 됩니다.

---

## 5. 구현 단계
1. `src/pages/RequestPlannerRole.tsx` 생성 및 UI 구현
2. `src/routes/AppRoutes.tsx` 라우트 등록
3. `src/pages/AddMember.tsx` 하단에 플래너 신청 링크 추가
