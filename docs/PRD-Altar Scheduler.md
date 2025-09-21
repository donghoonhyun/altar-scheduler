# 📌 Altar Scheduler PRD

## 1. 개요(Overview)

- 제품명 : Altar Scheduler (성당 복사 스케줄러)
- 용어 : 미사(mass), 복사(server), 본당(church, 성당과 같은 용어), 관리자(manager, 주로 수녀님)
- 배경 및 현재 문제점 : 현재 미사 일정 별 복사 배정은 담당수녀 등 관리자가 수작업으로 개별 연락하며 스케쥴링하고 있음. 복사의 인원이 많아지면서 한계에 이르고 있어 시스템(모바일앱 또는 PC웹)에 의한 자동화가 필요함
- 목적 및 개선방향 : 성당에서 매달 진행되는 미사 일정에 맞춰 복사들을 공정하고 효율적으로 배정하고, 변경 요청까지 손쉽게 처리할 수 있도록 지원함. 매달 반복적이므로 최대한 이전 데이터를 활용해서 중복 작업을 없애야 함.

- 대상 사용자(역할) : admin > manager > planner > server 네가지로 구분
- 성공 지표(Success Metrics) : 플래너는 쉽게 미사스케쥴과 복사를 등록하고 일정변경요창에도 쉽게 대응 할 수 있어야 하고,
  복사들도 자신의 스케쥴을 쉽게 알수 있어야 함

### 1.1 현재의 '복사 스케쥴링' 프로세스(AS-IS)

1. 플래너(주로 수녀님)가 다음달 미사 스케쥴을 달력에 확정 표시
2. 다음달 미사스케쥴을 복사들(또는 복사의 부모)에게 구글설문으로 보내서 각자 가능한 날과 안되는 날을 입력하게 함
3. 설문이 완료되면 해당 내용으로 스케쥴링을 시작하고 배정 결과를 복사들에게 통보함
4. 해당 달 운영중에 복사의 급한 사정으로, 복사가 관리자에게 변경 요청을 할 수 있음

### 1.2 개발할 앱의 '복사 스케쥴링' TO-Be 프로세스(TO-BE)

1. 미사일정 등록(플래너) : 플래너가 다음달 달력에 미사(MASS) 일정 등록
2. 미사별 복사 pool 선정(플래너) : 해당 미사에 설문할 복사 pool을 선택하여 선정
3. 차월 미사 확정(플래너)
4. 설문조사 공유(플래너) : 확정된 미사스케쥴에 대해 설문 페이지 URL 주소를 복사들에게 공유(카톡 등 SNS)
5. 설문조사 실시(복사) : 각 복사들은 해당 설문(달력형태)에 미사별 가능여부(Availability)를 가능(AVAILABLE)/불가(UNAVAILABLE) 둘 중에 하나 선택
6. 자동배정 실시(플래너) : 설문조사가 끝나면 설문확정('SURVEY-CONFIRMED'상태)하고 , 플래너가 '자동 배정' 버튼을 눌러 배정로직에 따라 자동배정함
7. 미세조정(플래너) : 자동배정된 현황을 보고, 관리자가 미세조정 후에 최종 확정('FINAL-CONFIRMED'상태)함
8. 최종결과 공유(플래너) : 확정된 내용을 복사들에게 결과 페이지 주소 링크를 보내거나 pdf 파일을 보냄 (카톡 등 SNS)
9. 긴급조정(플래너) : -> 일단 조정기능은 시스템에 반영하지 않음
10. 다음달 작업을 진행할 때 플래너가 쉽게 세팅할 수 있도록 이전 달 정보를 최대한 활용할 수 있도록 '전달 복사' 또는 '사전세팅' 같은 preset 기능이 필요함

## 2. 주요 기능(Main Functions)

### 2.1 사용자 인증

- 구글 계정을 통한 로그인 (Redirect / Popup 지원) : Android / iOS 둘다 지원해야함, 이후 kakao 등 확대 예정
- 역할 기반 접근 제어: Admin / Manager / Planner / Server

#### 2.1.1 사용자 진입 routing

- root URL 진입 시, 로그인 여부와 사용자 역할/소속에 따라 초기 화면을 분기한다.
- 로그인 안 된 경우 → 로그인 페이지(/login)로 이동.
- 로그인 된 경우:
  ① Admin → 바로 대시보드 또는 본당/복사단 선택 화면.
  ② Manager → 담당 본당 선택 후 해당 복사단 리스트 진입.
  ③ Planner/Server:
    소속 복사단이 1개면 바로 해당 복사단 대시보드.
    복수 소속이면 복사단 선택 화면(/select-server-group).
  ④ 권한 없음 → 접근 불가 안내 페이지(/forbidden).
- 딥링크로 복사단 URL(/:serverGroupId/...) 접근 시:
  ① 해당 복사단에 대한 권한이 있으면 그대로 접근.
  ② 권한이 없으면 본당 선택 또는 접근 불가 페이지로 안내.
- 상태 보존: 사용자가 마지막으로 선택한 복사단은 저장해 두어, 다음 로그인 시 기본 진입 지점으로 사용.

### 2.2 역할 및 권한 구조

- 모든 기능은 사용자의 스코프(본당/복사단) 내 데이터에만 접근 가능: admin(전역) / manager(본당 단위) / planner(복사단 단위) / server(복사 본인정보와 일부 복사단 내 정보).

#### 2.2.1 역할(role)정의

- Admin: 전역, 시스템 모든 권한 (Admin은 모든 본당에 권한을 가져야 함(모든 본당 관리자 collection에 포함되도록 설정)
- Manager: parish_code 단위 (본당내 모든 복사단 포함, 1명 또는 최소인원으로 관리)
- Planner: server_group_id 단위 (미사 일정 등록, 복사 배정 확정, 긴급 교체 처리)
- Server: 복사단에 속해있는 복사단원 (본인 스케줄/설문/교체 요청)

#### 2.2.2 권한 구조 (다음 3가지 컬렉션으로 분리)

- (1) system_roles/{uid} → 전역 admin
  (2) parish_roles/{uid}_{parish_code} → manager
  (3) memberships/{uid}_{server_group_id} → planner/server
- 권한 판정의 SSOT는 system_roles, parish_roles, **전역 memberships**이며, server_groups/{sg}/memberships는 선택적 미러(표시/캐시)로 사용한다.

#### 2.2.3 보안 규칙

- 접근 조건: isAdmin() ∨ isManagerOfParish(parish_code) ∨ isPlanner(server_group_id) ∨ isServer(server_group_id)
- manager가 같은 본당 소속 복사단에 Planner를 위임 가능.

### 2.3 플래너 메인 관리 (Dashboard)

- 권한관리 : home url로 접근시 플래너 메인 페이지와 그 외 복사 메인 페이지를 분리해야함.

#### 2.3.1 복사단(server group) 생성

- 경로: `/parish/${parishCode}/server-groups/new`
- 실제적으로 최상위 운영 담위임(server_groups 컬렉션)
- 권한: Admin 또는 해당 본당 Manager
- 필드: parish_code(카탈로그 선택), name, timezone, locale, active(사용/미사용), created_at, updated_at
- 본당 코드(parish_code)는 자동채번 금지, src/config/parishes.ts 카탈로그에서 선택

##### 2.3.2 복사단(server group) 코드 채번

- 형식: "SG" + zero-padding(5자리) → SG00001, SG00002 … SG99999
- 운영 단계: 전역(Global) 시퀀스 증가 방식
  . server_group_counters/global 문서에 last_seq 보관
  . 새 그룹 생성 시 Firestore 트랜잭션으로 last_seq + 1 → SG00XXX 발급
- 확장성: 최대 99,999개 그룹 (SG99999)
- 코드 예시:
  SG00001 → SG00002 → SG00003 … (본당 구분 없이 전역 고유)

#### 2.3.3 복사단별 플래너(planner) 지정

#### 2.3.4 플래너 메인 페이지 대시보드(Dashboard.tsx)

- 표시내용 : 나의정보 / 복사단 현황 / 차월 계획 / 미사달력 순서
  (1) 나의 정보 : 관리자 나의 본당명, 나의 이름
  (2) 소속 복사단 현황 : 총인원수(링크 누르면 복사관리 페이지로 이동), 설문현황(링크누르면 다음달 가용성설문 현황페이지로 이동)
  (3) 차월 계획 : 차월 미사 스케쥴을 계획하는 <2.6 미사계획> 화면으로 이동
  (4) 달력형태의 미사일정 : 일~토 일반형태의 월 달력에 날짜별 미사명/배정복사명 표시, 날짜cell 링크 누르면 상세변경 페이지로 이동. -> 이 달력은 복사 페이지에서도 readonly로 보여주도록 재사용함(component로 )

### 2.4 복사 메인 페이지 (ServerMain.tsx)

- home url로 접근시 관리자가 아닌 경우, 복사 메인 페이지로 이동해서 표시함
- 표시내용 :
  . 월별 달력 : 배정이 완료된 상태의 전체 미사일정과 미사별 배정된 복사들 이름 표시
  . 본인 미사는 강조 표시함
  . 설문이 시작 된 경우 '설문 참여' 링크 표시하고 클릭시 <2.6 가용성설문> 페이지로 이동

### 2.5 복사 관리 (ServersList.tsx)

- 기능 : 복사 명단 리스트/검색 지원
- 권한관리 : manager(본당 단위) 또는 해당 복사단의 planner 권한자
- Firebase Store Collection : pk='name_kor||baptismal_name' <- 이후 중복 체크시 한국이름과 세례명을 합쳐서 체크함, 동명이인은 이름에 숫자등을 넣어서 구분함
- 필수입력 Collection field : name_kor, baptismal_name, grade(학년, value=E1/E2/E3/E4/E5/E6/M1/M2/M3/H1/H2/H3), create_at, updated_at
- optoinal field : uid (users/{uid}와 연결될 경우), phone_guardian, phone_student, notes(비고)
- 중복 체크 기준:
  . 동일 성당 내에서는 name_kor + baptismal_name 조합으로 중복 방지
  . 이메일(users/{uid}.email)은 로그인 계정 중복 체크에 사용
- 등록 기능:
  . CSV 일괄 업로드 지원 (replace 모드, 주의문구 표시, 템플릿 제공)
  . 리스트 화면에서 개별 add/modify/delete 가능

#### 2.5.1 복사 리스트 표형태로 표시

#### 2.5.2 복사 명단 등록

- 일괄업로드 기능 : CSV 일괄 업로드, replace 되므로 주의문구 표시, 양식 제공
- 복사 리스트에서 직접 modify/add/delete 가능
- add 등록시 중복 체크 : email_id로 체크

### 2.6 미사 일정 관리 (MassEvent)

- 기능 : 매월 반복되는 미사 일정 등록
- 권한관리 : 해당본당 관리자만 권한있음, manager only
- 상태관리 : 월별 4가지 상태(순서대로 흐름)
  . 'MASS-NOTCONFIRMED' (미사일정 미확정, Blue)
  . 'MASS-CONFIRMED' (미사일정 확정, Orange) -> 가용성 설문시작 상태
  . 'SURVEY-CONFIRMED' (설문 확정, Sky Blue)
  . 'FINAL-CONFIRMED' (최종 확정, Green)
- 표시내용 : 현재 월상태 표시, 필요한 각종 버튼 표시, 차월 기준 달력 표시
  . 현재 월상태 표시 : 선택된 월의 현재 상태를 표시하고 색깔로 구분 - 기능 버튼들 : 전월미사정보가져오기, 미사일정 확정/확정취소, 설문링크복사, 자동배정(2.7)
  . 월달력 표시 : 차월을 기본으로 보여주고 달 전후 이동이 가능하며, 확정/미확정에 따라 색깔이 다르게 표시됨

#### 2.6.1 전월 미사정보 가져오기 버튼

- 표시 : 'MASS-NOTCONFIRMED'(미사일정 미확정) 상태에서만 버튼 활성화됨
- 사전 경고 : "전월 미사정보 가져오기를 하면 현재 월에 입력된 미사일정과 복사설문 정보가 모두 삭제됩니다" 메세지 표시
- 기능 : 미확정 상태의 월정보()를 삭제하고 이전달 정보로 insert

#### 2.6.2 달력 기반 일정 보기/편집

- 날짜를 클릭해서 수정 : 새 페이지로 이동하지 말고 modal로 입력수정 영역(component) 열어서 수정
- 'MASS-CONFIRMED' (미사일정 확정) : 관리자가 '미사일정 확정' 버튼으로 일정을 확정하면, 복사의 설문기능이 중지 된다(조회 수정 불가)

#### 2.6.3 필요 인원 설정

- 조건 : 1~6까지 radio button으로 선택, default=미선택

#### 2.6.4 차월 미사 일정 확정

- <미사일정확정> 버튼 클릭 : 가용성 설문을 할 수 있는 상태(MASS-CONFIRMED)가 되고, <설문링크복사> 버튼 활성화되고 설문 페이지<2.6 가용성 설문> 링크주소를 복사해서 카톡방에 공유해서 설문 진행을 유도함
- 차월 미사가 확정되기 전(MASS-CONFIRMED가 아닌 상태)에는 복사가 해당 링크페이지에 들어가도 "미사가 확정되지 않았습니다" 메세지 표시하고 해당월의 미사 일정이 조회 및 설문 저장이 되지 않아야 함

#### 2.6.5 가용성설문 링크 보내기

- 별도의 시스템 기능 없이 카톡 대화방에서 공유예정

#### 2.6.6 자동배정 버튼

- 설문확정( 'SURVEY-CONFIRMED') 상태에서만 버튼이 활성화 됨
- 버튼클릭시 : "자동배정을 실행하면 기존 복사배정정보가 삭제됩니다" 경고 메세지 표시 후 <2.7 자동배정> 로직으로 function 처리,
  기존 복사배정(Assign)정보만 삭제하고 미사일정정보(massevent)는 삭제하지 않음

### 2.7 복사 가용성 설문 (Availability)

- 기능 : 복사(또는 학부모)가 **해당 월의 각 미사 일정(event_id)** 별로 자신의 가용 여부를 입력하고 제출한다.  
  제출된 응답은 이후 자동 배정(2.8)과 플래너의 수동 조정에 활용된다.
- 권한관리 : 본당 관리자(manager), 복사(server) 모두 접근 가능. 단, 복사는 본인 응답만 수정 가능
- 미사별 일자별 가용성의 2가지 상태 관리 : 'AVAILABLE'(가능) / 'UNAVAILABLE'(불가)
- **데이터 저장 구조 (Firestore)**  

  ```ts
  server_groups/{sg}/availability_surveys/{month_id}/responses/{member_id}
    responses: {
      [event_id: string]: "AVAILABLE" | "UNAVAILABLE"
    }
    created_at: timestamp
    updated_at: timestamp
  ```

  (예시:)
  {
    "responses": {
      "event_20250915_1900": "AVAILABLE",
      "event_20250916_0900": "UNAVAILABLE",
      "event_20250917_1100": "AVAILABLE"
    },
    "created_at": "2025-09-01T10:00:00Z",
    "updated_at": "2025-09-01T10:15:00Z"
  }

- 모든 미사 일정이 있는 날짜에 2가지 상태중 하나를 지정해야 최종 '확정제출' 할 수 있음
- 확정 제출 조건
  . 응답자가 해당 월의 모든 미사 이벤트에 대해 상태를 지정해야만 최종 “확정 제출” 가능
  . 제출 이후에도 마감('SURVEY-CONFIRMED') 전까지는 '제출취소' 후에 수정 허용
- UI/UX 고려사항
  . 모바일 우선 달력 UI 제공 (아이콘/색상 활용)
  . 해당 월에서 이벤트가 있는 날짜에 대해 두 가지 상태 중 하나를 직관적으로 선택 가능해야 함

### 2.8 자동 배정 (Auto Assignment) 로직

- **구현 방식**  
  Cloud Function 기반 자동 배정 로직으로 구현한다.  
  복사들의 가용성 설문(2.7)을 기반으로 각 미사 이벤트에 필요한 인원을 자동 배정한다.

- **배정 조건**  
  1. 각 미사 이벤트(event_id)에는 주복사(Main) 1명 이상이 반드시 배정되어야 한다.  
  2. Rookie(신입 복사)는 기본적으로 Main 배정에서 제외하되, 필수 인원이 부족할 경우 보완적으로 포함할 수 있다.  
  3. 공정성을 고려하여, 동일 복사에게 과도하게 편중되지 않도록 한다.  
  4. 가용성은 **`AVAILABLE`(가능) / `UNAVAILABLE`(불가)** 두 가지 값만 사용한다.  
     - `UNAVAILABLE` → 절대 배정하지 않는다.  
     - `AVAILABLE` → 배정 가능 대상으로 고려한다.  

- **데이터 저장 구조 (Firestore)**  

  ```ts
  server_groups/{sg}/schedules/{month_id}
    assignments: {
      [event_id: string]: string[]   // event_id별 배정된 member_id 배열
    }
  ```
  
  (예시:)
  {
    "assignments": {
      "event_20250915_1900": ["member_001", "member_002"],
      "event_20250916_0900": ["member_003", "member_004"],
      "event_20250917_1100": ["member_005"]
    }
  }

- 플래너 검토 단계
  . 자동 배정 후, 플래너가 결과를 확인하고 필요 시 수동 조정 가능
  . 최종 확정 시 FINAL-CONFIRMED 상태로 변경

### 2.9 교체 요청 (<- 일단 기능 구현 안함)

### 2.10 공유/알림 (향후계획)

- 기능: 복사/관리자에게 배정 관련 메시지 전달
- 위치: server_groups/{sg}/notifications/{notif_id}
- 배정표 PDF/이미지 생성 및 공유
- 알림(Notification): 앱 내, 이메일, 또는 메시지

### 2.11 시스템 Admin 관리기능

- 신규 본당 추가 = 카탈로그(parishes.ts) 업데이트 + parish_roles 문서 생성

#### 2.11.1 본당별 관리자(manager) 지정

- admin이 최초 1회 일단 수작업으로 지정, 본당별 여러명일 수 있음.
- parish_roles/{uid}_{parish_code} 문서 구조, Admin 직권 등록 또는 승인 워크플로우 추가.

### 2.12 App UI & UX

- 반응형 웹 : 모바일이 기본이므로 작은 모바일 화면에 표현되도록 UI설계해야함. 추가로 PC브라우저에서도 깨지지 않게 반응해야함.
- dark mode / white mode 모두 감안하여 css color 고려해야함

## 3. 비기능 요구사항

### 3.1 App 환경

- front end : SPA(Single Page Architecture) + vite + react.js + TailWind CSS
- back end : Google platform Firebase 기반
- data storage : Firestore (NoSQL)
- hosting/deploy: Google Firebase Hosting, Functions, Auth
- Localization: 여러 성당에서 사용 가능 (parish_code로 구분)
- Sesurity: Google Firebase Security Rules로 역할별 접근 제어
- 유지보수성: CSV Import/Export, Emulator 기반 테스트 지원
- CI/CD

### 3.2 1인-개발 환경

- IDE OS : windows 11
- IDE : visual code studio
    ESLint/TS 규칙
- brower : chrome
- Firebase Emulator local 환경

#### 3.2.1 TypeScript import 규칙

- TypeScript 4.5 이상에서는 타입 전용 import(import type) 규칙을 반드시 따른다.
- interface, type alias, enum 등 런타임에 필요 없는 타입 선언은 다음과 같이 가져온다:
  예) import type { CreateServerGroupRequest, CreateServerGroupResponse } from "../types/firestore";
- 런타임 코드에서 실제로 쓰이는 객체/함수(firebase, react, zustand 등)는 일반 import를 사용한다.

#### 3.2.2 타입 관리 원칙

- Cloud Functions의 요청/응답 타입은 공용 타입 파일(src/types/firestore.ts)에 정의하고,
  프론트엔드 페이지/컴포넌트에서는 반드시 import type 으로 참조한다.
- ESLint/TS 규칙에서 no-explicit-any를 활성화하여, 타입 안정성을 유지한다.
- 새 Cloud Function 추가 시 반드시 Request / Response 타입을 정의하여 문서화한다.

### 3.3 Test

- 개발 중에 admin / manager / planner / server 역할을 오가며 재빨리 테스트 할수 있어야 함
- test user : 역할에 따른 테스트 유저
  . admin user : <admin@test.com>
  . manager user : <manager@test.com>
  . planner user : <planner@test.com>
  . server user : <server@test.com>
- 운영 환경에서는 차단, 개발 환경에서만 허용.
- 개발 중 역할 테스트:
  ① 에뮬레이터 시드 스크립트(admin/manager/planner/server + 샘플 서버그룹)
  ② Dev 전용 Role Switcher UI(개발 모드 한정)
  ③ Quick Sign-in 버튼(개발 모드 한정)

#### 3.3.1 시드(Seed) 데이터 전략

- 개발/테스트 환경에서는 **Firebase Admin SDK 기반 seed 스크립트** 제공
- 시드 스크립트 동작:
  . Auth Emulator에 테스트 계정 4개 생성 (admin, manager, planner, server)
  . Firestore에 대응 문서 자동 생성
    system_roles, parish_roles, memberships, users, server_groups
- 테스트 기본 값:
  . parish_code: `"DAEGU-BEOMEO"`
  . server_group_id: `"SG0001"`
- 예시:  

  . `system_roles/admin-test-uid` → `{ role: "admin" }`  
  . `parish_roles/manager-test-uid_DAEGU-BEOMEO` → `{ parish_code: "DAEGU-BEOMEO", role: "manager" }`  
  . `memberships/planner-test-uid_SG0001` → `{ server_group_id: "SG0001", parish_code: "DAEGU-BEOMEO", role: "planner" }`  
  . `memberships/server-test-uid_SG0001` → `{ server_group_id: "SG0001", parish_code: "DAEGU-BEOMEO", role: "server" }`  
  . `server_groups/SG0001` → `{ parish_code: "DAEGU-BEOMEO", name: "범어성당 복사단 1그룹" }`  

### 3.4 Google Firebase app config

- 앱이름 : Altar Scheduler
- const firebaseConfig = {
  apiKey: " ",
  authDomain: "altar-scheduler-dev.firebaseapp.com",
  projectId: "altar-scheduler-dev",
  storageBucket: "altar-scheduler-dev.firebasestorage.app",
  messagingSenderId: "675620470359",
  appId: "1:675620470359:web:5bf093ffed79f292c2ad12",
  measurementId: "G-S1FVFYKDVH"
  };

### 3.4.1 Firestore doc modeling (서브컬렉션로 단위 격리)

- 구조 :
memberships/{uid}_{server_group_id}   // 전역 권한 SSOT
server_groups/{server_group_id} // 최상위 단위
/members/{member_id}
/memberships/{uid} // 캐시/미러(표시용)
/mass_events/{event_id}
/availability_surveys/{month_id}/responses/{member_id}
/schedules/{month_id}
/replacement_requests/{req_id}
/notifications/{notif_id}

- 캐시/미러는 선택 사항으로 향후 사용자가 많아질 경우 성능을 위해 고려해야함

## 4. 향후 확장

- 다국어 지원 (한국어/영어/스페인어 등)
- 복사/부모 전용 앱 (푸시 알림 연동)
- 교구 단위 통계/리포트
