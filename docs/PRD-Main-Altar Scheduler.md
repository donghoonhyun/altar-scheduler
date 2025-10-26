# 📚 Altar Scheduler Main PRD (PRD-Main-Altar Scheduler.md)

## 🎯1. 개요(Overview)

- 제품명 : Altar Scheduler (성당 복사 스케줄러)
- 용어 : 미사(mass), 복사(server), 본당(church, 성당과 같은 용어), 플래너(Planner, 주로 수녀님), 관리자(manager)
- 배경 및 현재 문제점 : 현재 미사 일정 별 복사 배정은 담당수녀 등 관리자가 수작업으로 개별 연락하며 스케쥴링하고 있음. 복사의 인원이 많아지면서 한계에 이르고 있어 시스템(모바일앱 또는 PC웹)에 의한 자동화가 필요함
- 목적 및 개선방향 : 성당에서 매달 진행되는 미사 일정에 맞춰 복사들을 공정하고 효율적으로 배정하고, 변경 요청까지 손쉽게 처리할 수 있도록 지원함. 매달 반복적이므로 최대한 이전 데이터를 활용해서 중복 작업을 없애야 함.
- 대상 사용자(역할) : Planner > Server 두가지로 구분
- 성공 지표(Success Metrics) : 플래너는 쉽게 미사스케쥴과 복사를 등록하고 일정변경요창에도 쉽게 대응 할 수 있어야 하고,
  복사들도 자신의 스케쥴을 쉽게 알수 있어야 함
- 아래 프로젝트 파일들을 보조로 함께 참고해야함:  
  . Folder Structure of App.txt: App의 폴더와 파일 기본 구조
  . PRD-2.13-App-UIUX.md: App의 UI/UX 기본 구조
  . PRD-2.4.2.3-TimezoneHandling.md: 글로벌사용을 위한 timezone 처리가이드
  . Firestore Collections.md: Firebase Firestore의 컬렉션과 doc 구조 설명  
  . PRD-3.4.1-Firebase Setup.md: Cloud Functions 환경구성과 개발표준 설명
  . 개발표준가이드 지침.txt: 그외 개발가이드
  . 그외 파일명이 'PRD-'로 시작하는 프로젝트 파일 모두 참조해야함.

### 📍1.1 현재의 '복사 스케쥴링' 프로세스(AS-IS)

1. 플래너(주로 수녀님)가 다음달 미사 스케쥴을 달력에 확정 표시
2. 다음달 미사스케쥴을 복사들(또는 복사의 부모)에게 구글설문으로 보내서 각자 가능한 날과 안되는 날을 입력하게 함
3. 설문이 완료되면 해당 내용으로 스케쥴링을 시작하고 배정 결과를 복사들에게 통보함
4. 해당 달 운영중에 복사의 급한 사정으로, 복사가 관리자에게 변경 요청을 할 수 있음

### 📍1.2 개발할 앱의 '복사 스케쥴링' TO-Be 프로세스(TO-BE)

1. 미사일정 등록(플래너) : 플래너가 다음달 달력에 미사(MASS) 일정 등록
2. 미사별 복사 pool 선정(플래너) : 해당 미사에 설문할 복사 pool을 선택하여 선정
3. 차월 미사 확정(플래너)
4. 설문조사 공유(플래너) : 확정된 미사스케쥴에 대해 설문 페이지 URL 주소를 복사들에게 공유(카톡 등 SNS)
5. 설문조사 실시(복사) : 각 복사들은 해당 설문(달력형태)에 미사별 가능여부(Availability)를 가능(AVAILABLE)/불가(UNAVAILABLE) 둘 중에 하나 선택
6. 자동배정 실시(플래너) : 설문조사가 끝나면 설문확정('SURVEY-CONFIRMED'상태)하고 , 플래너가 '자동 배정' 버튼을 눌러 배정로직에 따라 자동배정함 (아래 2.8 항목참조)
7. 미세조정(플래너) : 자동배정된 현황을 보고, 관리자가 미세조정 후에 최종 확정('FINAL-CONFIRMED'상태)함
8. 최종결과 공유(플래너) : 확정된 내용을 복사들에게 결과 페이지 주소 링크를 보내거나 pdf 파일을 보냄 (카톡 등 SNS)
9. 긴급조정(플래너) : -> 일단 조정기능은 시스템에 반영하지 않음
10. 다음달 작업을 진행할 때 플래너가 쉽게 세팅할 수 있도록 이전 달 정보를 최대한 활용할 수 있도록 '전달 복사' 또는 '사전세팅' 같은 preset 기능이 필요함

## 🎯2. 주요 기능(Main Functions)

### 📍2.1 회원 가입 및 인증

- Firebase Authentication 모듈 사용
- 멀티인증: 다양한 인증 방식을 지원할 계획이지만 우선 구글 계정을 통한 로그인만 지원 (Redirect / Popup).
  . Android / iOS 둘다 지원해야함
  .이후 kakao 등 확대 예정
- 역할 기반 접근 제어: Planner / Server

#### 2.1.1 사용자 가입 및 승인 절차

- 프로젝트 파일 'PRD-2.1.1-SignUp SignIn.md' 파일 내용을 참고함.

#### 2.1.2 사용자 진입 routing

- root URL 진입 시, 로그인 여부와 사용자 역할/소속에 따라 초기 화면을 분기한다.
- 로그인 안 된 경우 → 로그인 페이지(/login)로 이동.
- 로그인 된 경우:
  ① Planner/Server:
    소속 복사단이 1개면 바로 해당 복사단 대시보드.
    복수 소속이면 복사단 선택 화면(/select-server-group).
  ② 권한 없음 → 접근 불가 안내 페이지(/forbidden).
- 딥링크로 복사단 URL(/:serverGroupId/...) 접근 시:
  ① 해당 복사단에 대한 권한이 있으면 그대로 접근.
  ② 권한이 없으면 본당 선택 또는 접근 불가 페이지로 안내.
- 상태 보존: 사용자가 마지막으로 선택한 복사단은 저장해 두어, 다음 로그인 시 기본 진입 지점으로 사용.

### 📍2.2 역할 및 권한 구조

- 모든 기능은 사용자의 스코프(본당/복사단) 내 데이터에만 접근 가능: planner(복사단 단위) / server(복사 본인정보와 일부 복사단 내 정보).

#### 2.2.1 역할(role)정의

- Planner:
  . server_group_id 단위 권한.
  . 특정 복사단에서 미사 일정 등록, 가용성 설문 관리, 자동 배정, 최종 확정 기능 수행.
  . 하나의 사용자가 복수의 복사단에 대해 Planner 역할을 가질 수 있다.  
- Server:
  . 복사단에 속해있는 복사단원
  . 본인의 스케줄조회/설문응답 가능

#### 2.2.2 권한 구조 (다음 3가지 컬렉션으로 분리)

- 권한 SSOT는 Firestore 컨렉션:  
  . memberships/{uid}_{server_group_id} → planner/server
- 권한 판정의 SSOT는 전역 memberships이며,
  server_groups/{sg}/memberships는 선택적 미러(표시/캐시)로 사용한다.

#### 2.2.3 보안 규칙

- 접근 조건:
  isPlanner(server_group_id)              // 특정 그룹 Planner
  ∨ isServer(server_group_id)               // 복사 본인

### 📍2.3 플래너(Planner) 메인 관리

- 권한관리 : home url로 접근시 플래너 메인 페이지와 그 외 복사 메인 페이지를 분리해야함.

#### 2.3.1 플래너(Planner) 대시보드(Dashboard.tsx)

- 표시내용 : 나의정보 / 복사단 현황 / 차월 계획 / 미사달력 순서
  ① 나의 정보 : 관리자 나의 본당명, 나의 이름
  ② 소속 복사단 현황 : 총인원수(링크 누르면 복사관리 페이지로 이동), 설문현황(링크누르면 다음달 가용성설문 현황페이지로 이동)
  ③ 차월 계획 : 차월 미사 스케쥴을 계획하는 <2.6 미사계획> 화면으로 이동
  ④ 달력형태의 미사일정 : 일~토 일반형태의 월 달력에 날짜별 미사명/배정복사명 표시, 날짜cell 링크 누르면 상세변경 페이지로 이동.
     → 이 달력은 복사 페이지에서도 readonly로 보여주도록 재사용함(component로)
- 권한 : Planner
- 라우팅:
  `/server-groups` → (로그인 Planner의 권한이 있는) 복사단 리스트
  `/server-groups/:serverGroupId` → 특정 복사단 대시보드

#### 2.3.2 복사단(server group) 생성

- 복사단(server group)이 실제적으로 최상위 운영 단위임 (컬렉션: server_groups/{server_group_id})
- 경로:
  . `/server-groups` → 로그인 사용자가 접근 권한을 가진 <복사단 리스트> 페이지
  . `/server-groups/new` → 복사단 생성 마법사
  . <복사단 리스트> 페이지 내 [복사단 생성] 버튼 클릭 시 `/server-groups/new` 로 이동
- 동작 흐름:
  ① 로그인 후 권한이 있는 사용자는 `/server-groups` 에서 소속 복사단 목록 확인 가능
  ② [복사단 생성] 버튼 클릭 시 `/server-groups/new` 로 이동하여 마법사 실행  
- 권한: Planner
- 필드: parish_code(카탈로그 선택), name, timezone, locale, active(사용/미사용), created_at, updated_at
- 본당 코드(parish_code)는 자동채번 금지, src/config/parishes.ts 카탈로그에서 선택

##### 2.3.3 복사단(server group) 코드 채번

- 형식: "SG" + zero-padding(5자리) → SG00001, SG00002 … SG99999 (최대 99,999개 그룹)
- 운영 단계: 전역(Global) 시퀀스 증가 방식
  . `counters/server_groups` 문서에 `last_seq` 보관
  . 새 복사단 생성 시 Firestore 트랜잭션으로 `last_seq + 1` → SG00001, SG00002 ... 순차 채번(본당 구분 없이 전역 고유)
- 확장성: counters 컬렉션을 공통으로 사용하며, server_groups 외에도 mass_events, notifications 등 확장 가능

#### 2.3.4 복사단별 플래너(planner) 지정

- 각 복사단(server_group_id)별로 Planner를 지정 가능
- 권한 : memberships/{uid}_{server_group_id} 문서에 저장
    → 하나의 사용자가 복수의 복사단에 대해 Planner 역할을 가질 수 있음

#### 2.3.5 복사 리스트 관리 (ServerList.tsx) of planner

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
- 신규 가입자 목록에 승인 대기 표시.
  . [승인] 버튼 → active=true 로 업데이트.
  . [거절] 버튼 → 해당 멤버 문서 삭제.

#### 2.3.6 복사 명단 등록

- 일괄업로드 기능 : CSV 일괄 업로드, replace 되므로 주의문구 표시, 양식 제공
- 복사 리스트에서 직접 modify/add/delete 가능
- add 등록시 중복 체크 : email_id로 체크

#### 2.3.7 Dashboard Rendering Flow

- 프로젝트 파일 'PRD-2.3.7-Dashboard Rendering Flow.md' 파일 내용을 참고함.

---

### 📍2.4 미사 일정 관리 (MassEvent)

- 기능 : 매월 반복되는 미사 일정 등록
- 권한관리 : planner only
- 표시내용 : 현재 월상태 표시, 필요한 각종 버튼 표시, 차월 기준 달력 표시
  . 현재 월상태 표시 : 선택된 월의 현재 상태를 표시하고 색깔로 구분 - 기능 버튼들 : 전월미사정보가져오기, 미사일정 확정/확정취소, 설문링크복사, 자동배정(2.8)
  . 월달력 표시 : 차월을 기본으로 보여주고 달 전후 이동이 가능하며, 확정/미확정에 따라 색깔이 다르게 표시됨

#### 2.4.1 상태흐름관리(Status Flow)

- status 상태관리 : 미사(mass_event_id)별+월별 4가지 상태(순서대로 흐름)
  ① 'MASS-NOTCONFIRMED' (미사일정 미확정)
  ② 'MASS-CONFIRMED' (미사일정 확정, 가용성 설문시작 상태)
  ③ 'SURVEY-CONFIRMED' (설문 확정)
  ④ 'FINAL-CONFIRMED' (최종 확정)
- status 상태에 따른 UX 구분 (대표 색상+아이콘)
  ① 'MASS-NOTCONFIRMED' → css:bg-gray → gray
  ② 'MASS-CONFIRMED' → css:bg-blue → 🔒 blue
  ③ 'SURVEY-CONFIRMED' → css:bg-amber → 🗳️ amber
  ④ 'FINAL-CONFIRMED' → css:bg-green → 🛡️green

#### 2.4.2 달력 기반 일정 보기/편집

- 날짜를 클릭해서 수정 : 새 페이지로 이동하지 말고 modal로 입력수정 영역(component) 열어서 수정
- 상태관리 : 'MASS-CONFIRMED' (미사일정 확정) 관리자가 '미사일정 확정' 버튼으로 일정을 확정하면, 복사의 설문기능이 중지 된다(조회 수정 불가)

##### 2.4.2.1 미사일정(Mass Event) 생성

- Cloud Function: createMassEvent (경로: callable function)
- 요청 파라미터:
{
  title: string;
  event_date: string; // YYYY-MM-DD
  requiredServers: number;
}
- 동작:
  . counters/mass_events.last_seq 기반으로 ME00001, ME00002 ... 채번
  . Firestore mass_events/{id} 문서 생성 : server_groups/{server_group_id}/mass_events/{event_id}
  . 생성 필드: server_group_id, title, date, required_servers, status, created_at, updated_at
  {
    server_group_id: string;       // FK (복사단 구분용)
    title: string;
    event_date: string;             // ex: "20251024" , 변환예제:const event_date = dayjs(selectedDate).format("YYYYMMDD");
    required_servers: number;
    status: "MASS-NOTCONFIRMED";   // 초기 상태
    created_at: timestamp;
    updated_at: timestamp;
  }

##### 2.4.2.2 미사일정(Mass Event) 저장 로직

- 신규 생성
  . Cloud Function createMassEvent 호출
  . 기능:
    EventId 자동채번
    counters/mass_events 증가 처리
    기본 status = MASS-NOTCONFIRMED 설정
    Firestore server_groups/{sg}/mass_events/{eventId}에 문서 생성
- 건별 수정
  . Planner UI에서 MassEventDrawer 통해 수정
  . Firestore setDoc(..., { merge: true }) 방식 사용
  . title, required_servers 변경 가능
- 건별 삭제
  . Planner UI에서 삭제 버튼 제공
  . Firestore deleteDoc()으로 삭제
- 권한
  . Planner만 가능 (RoleGuard require="planner")
  . Firestore 보안 규칙: mass_events 직접 쓰기 허용은 최소화, 신규 생성은 CF 경유

##### 2.4.2.3 Timezone Handling (저장 및 표시 로직)

- 세부 정책 : 'PRD-2.4.2.3-TimezoneHandling.md' 파일 내용을 참고함.
- mass_events.event_date 는 UTC Timestamp가 아닌,
  해당 본당의 현지(Local) 기준 날짜를 나타내는 문자열("YYYYMMDD") 로 저장한다.
- Timezone(server_groups.timezone)은 Firestore 저장 시에는 사용되지 않으며,
  UI의 달력·요일 계산 및 Cloud Function 내부 계산 시에만 참고한다.

변환 예시:

```ts
  const tz = serverGroup.timezone || "Asia/Seoul";
  const label = dayjs.tz(event_date, "YYYYMMDD", tz).format("M월 D일 (ddd)");

```

#### 2.4.3 필요 인원(required_servers) 설정

- 조건 : 1~6(number)명까지 radio button으로 선택, default=미선택

#### 2.4.7 MassEvent Calendar UI

- 세부 정책 : 'PRD-2.4.7-MassEvent Calendar UI.md' 파일 내용을 참고함.

#### 2.4.8 MassEvent Planner UI

- 세부 정책 : 'PRD-2.4.8-MassEvent Planner UI.md' 파일 내용을 참고함.

#### 2.4.9 MassEvent Drawer UI

- 세부 정책 : 'PRD-2.4.9-MassEvent Drawer UI.md' 파일 내용을 참고함.

---

### 2.5 📍미사일정관리(MassEventPlanner)의 Tool Bar 버튼 정의

#### 2.5.1 [전월 미사일정 복사] 버튼

- 버튼 활성화 조건 : 선택된 달(currentMonth)이 시스템 기준 현재 월(dayjs()) 또는 다음 월(dayjs().add(1, 'month')) 과 동일할 때만 버튼 활성화됨.
- 버튼 클릭 시 : "전월 미사일정 가져오기를 하면 선택된 월에 입력된 미사일정과 복사설문 정보가 모두 삭제됩니다" 메세지 표시 후,
    미확정 상태의 해당월 미사일정(mass_events collection의 docs)을 삭제하고 전월 일정들로 복사로직에 따라 insert.
- 복사로직 : 날짜 그대로 복사하는 것이 아니라, 주차별 요일별로 복사하는 것이다. 예를 들어 전월 첫째주 토요일-->당월 첫째주 토요일로 복사함.

#### 2.5.2 [미사 일정 확정] 버튼

- 버튼 활성화 조건 : 선택된 월이 'MASS-NOTCONFIRMED'(미사일정 미확정) 상태에서만 활성화됨.
- 버튼 클릭 시 : 가용성 설문을 할 수 있는 상태(MASS-CONFIRMED)로 변경.
    이후 planner는 drawer 화면에서 <설문링크복사> 버튼 활성화되고 가용성 설문 페이지 링크주소를 복사해서 카톡방에 공유해서 설문 진행을 유도함

#### 2.5.3 [설문 진행] 버튼 (가용성 Availability)

- 버튼 활성화 조건 : 선택된 월이 'MASS-CONFIRMED'(미사일정확정) 상태에서만 활성화됨.
- 버튼 클릭 시 : 가용성 설문 url을 생성하고 설문 현황을 모니터링하는 drawer 가 열림.
- 별도의 시스템 기능 없이 카톡 대화방에 설문 페이지 URL 공유예정
- 상세 내용 : 아래 '2.6 복사 가용성 설문 관리 (Availability)' 섹터 참조

#### 2.5.4 [설문 종료] 버튼

- 버튼 활성화 조건 : 선택된 월이 'MASS-CONFIRMED'(미사일정확정) 상태에서만 활성화됨.
- 버튼 클릭 시 : 자동배정+planner추가조정을 할 수 있는 상태 'SURVEY-CONFIRMED'(설문종료)로 변경.

#### 2.5.5 [자동 배정] 버튼 (Auto Assignment)

- 버튼 활성화 조건 : 선택된 월이 'SURVEY-CONFIRMED'(설문종료) 상태에서만 활성화됨.
- 세부 정책 : 'PRD 2.5.5 Auto ServerAssignment Logic.md' 파일 내용을 참고함.

#### 2.5.7 [월 상태변경] 버튼

- 버튼 활성화 조건 : 선택된 월이 today()의 금월 또는 다음월에서만 버튼 활성화됨.
- 버튼 클릭 시 : MassEventPlanner에서 선택된 월의 MonthStatusDrawer 화면 표시.
  (프로젝트 파일 PRD-2.5.7-MonthStatus Drawer.md 참조)

---

### 📍2.6 복사 가용성 설문 관리 (Availability)

- 세부 정책 : 'PRD-2.6-Availability Survey.md' 파일 내용을 참고함.

### 2.6.1 설문 생성 (SendSurveyDrawer)

- 해당 복사단 + 해당월의 [설문 URL] 생성 후, 별도로 복사들에게 url 공유

### 2.6.2 복사 설문 진행 (ServerSurvey)

- 전달받은 설문URL로 진입하는 화면에서 복사가 설문 진행.

---

### 📍2.7 복사 메인 페이지 (ServerMain.tsx)

- home url로 접근시 관리자가 아닌 경우, 복사 메인 페이지로 이동해서 표시함
- 표시내용 :
  . 월별 달력 : 배정이 완료된 상태의 전체 미사일정과 미사별 배정된 복사들 이름 표시
  . 본인 미사는 강조 표시함
  . 설문이 시작 된 경우 '설문 참여' 링크 표시하고 클릭시 <2.6 가용성설문> 페이지로 이동

---

### 📍2.8 자동 배정 로직 (Auto Server Assignment Logic)

- 세부 정책 : 'PRD-2.5.5-Auto ServerAssignment.md' 파일 내용을 참고함.

---

### 📍2.9 사용자 등록 & 권한 관리

### 2.9.1 복사단원(Server) 신규 등록 흐름

- 흐름요약 : 복사단원 스스로 가입 → 관리자가 승인 후 활성화
- ① 회원가입 (Firebase Auth)
  . 복사단원은 이메일/비밀번호로 앱에 직접 회원가입한다.
  . 가입 시 기본 프로필(이름, 세례명, 학년, 소속 본당/복사단 선택)을 입력한다.
- ② Firestore 등록
  . 회원가입 직후, server_groups/{serverGroupId}/members 컬렉션에 문서가 자동 생성된다.
  . 문서 구조 예시:
    {
      "uid": "firebase-uid-xxxxx",
      "email": "<user@email.com>",
      "name_kor": "홍길동",
      "baptismal_name": "요한",
      "grade": "중2",
      "notes": "",
      "active": false,         // 기본값: 미승인
      "created_at": "...",
      "updated_at": "..."
    }
- ③ 관리자 승인
  . 플래너/매니저가 ServerList 화면에서 신규 등록된 단원을 확인하고 active 필드를 `true` 로 변경하여 승인.
  . 승인 전까지 해당 계정은 앱에 로그인은 가능하나 주요 기능 접근 차단(대시보드, 일정 확인 등 불가).
- ④ 권한 부여
  . 승인(active: true)이 되면 RoleGuard 에서 server 권한을 정상 인식하고, 해당 단원은 자기 일정 확인, 설문 응답, 교대 요청 기능을 사용할 수 있다.
- 보안 로직 RoleGuard:
  . uid 와 active: true 를 동시에 만족해야 server 권한 부여.
  . active: false 인 경우 → 로그인 가능하지만 Forbidden 페이지로 이동.

---

### 📍2.11 공유/알림 (향후계획)

- 기능: 복사/관리자에게 배정 관련 메시지 전달
- 위치: server_groups/{sg}/notifications/{notif_id}
- 배정표 PDF/이미지 생성 및 공유
- 알림(Notification): 앱 내, 이메일, 또는 메시지

---

### 📍2.12 시스템 Admin 관리기능 (삭제 -> 향후 고려)

---

### 📍2.13 App UI & UX

- 프로젝트 파일 'PRD-2.13-App-UIUX.md' 파일 내용을 참고함.
- 반응형 웹UI 시스템
- 플래너와 복사 모두 모바일 device UI 레이아웃을 기본으로 하되,
  달력 등 많은 정보를 표시해야하는 플래너 일부 기능은 windows 브라우저 UI 레이아웃을 고려해야함

---

#### 2.13.1 Layout 구조

- 상단 공통 헤더: 사용자 이름 + 이메일 + 로그아웃 버튼 표시
- 페이지 본문은 Layout의 Outlet 영역에서만 표시 (중복 방지)
- 따라서 각 화면(Dashboard, ServerMain)에서는 별도의 Layout 래핑 제거

#### 📍2.14 (임시)

### 📍2.15 공통기능(Counters, functions  등)

#### 2.15.1 Counter 관리

- 모든 시퀀스 ID는 counters/{counterName} 문서에서 관리한다.
- 채번 방식 : counters/{counterName} 문서에서 last_seq 관리 → 트랜잭션으로 +1 후 ID 발급.
- ID형식 : prefix + zero-padding(고정 길이 숫자)
- PREFIX : SG(server group), ME(mass event)
- 자릿수: 5자리를 기본으로 사용 (최대 99,999개). 확장성을 고려해야 할 경우, 6자리 이상(ME000001)도 설정가능
  . Server Group은 5자리로 함 : 예) SG00001
  . Mass Event는 6자리로 함 : 예) ME000001
- 예시:
  counters/
  ├── server_groups { last_seq: 3 }
  ├── mass_events   { last_seq: 15 }
  └── notifications { last_seq: 102 }

---

## 🎯3. 비기능 요구사항

### 📍3.1 App 환경

- front end : SPA(Single Page Architecture) + vite + react.js + TailWind CSS
- back end : Google platform Firebase 기반
- data storage : Firestore (NoSQL)
- hosting/deploy: Google Firebase Hosting, Functions, Auth
- Localization: 여러 성당에서 사용 가능 (parish_code로 구분)
- Sesurity: Google Firebase Security Rules로 역할별 접근 제어
- 유지보수성: CSV Import/Export, Emulator 기반 테스트 지원
- CI/CD

---

### 📍3.2 1인-개발 환경

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

---

### 📍3.3 Test

- 개발 중에 planner / server 역할을 오가며 재빨리 테스트 할수 있어야 함
- test user : 역할에 따른 테스트 유저
  . planner user : <planner@test.com>
  . server user : <server@test.com>
- 운영 환경에서는 차단, 개발 환경에서만 허용.
- 개발 중 역할 테스트:
  ① 에뮬레이터 시드 스크립트(planner/server + 샘플 서버그룹)
  ② Dev 전용 Role Switcher UI(개발 모드 한정)
  ③ Quick Sign-in 버튼(개발 모드 한정)

#### 3.3.1 시드(Seed) 데이터 전략

- 개발/테스트 환경에서는 **Firebase Admin SDK 기반 seed 스크립트** 제공
- 시드 스크립트 동작:
  . Auth Emulator에 테스트 계정 2개 생성 (planner, server)
  . Firestore에 대응 문서 자동 생성
    memberships, users, server_groups
- 테스트 기본 값:
  . parish_code: `"DAEGU-BEOMEO"`
  . server_group_id: `"SG0001"`
- 예시:
  . `memberships/planner-test-uid_SG0001` → `{ server_group_id: "SG0001", parish_code: "DAEGU-BEOMEO", role: "planner" }`  
  . `memberships/server-test-uid_SG0001` → `{ server_group_id: "SG0001", parish_code: "DAEGU-BEOMEO", role: "server" }`  
  . `server_groups/SG0001` → `{ parish_code: "DAEGU-BEOMEO", name: "범어성당 복사단 1그룹" }`  

---

### 📍3.4 Google Firebase 환경

#### 3.4.1 Firebase 환경구성

- 세부 정책 : 'PRD-3.4.1-Firebase Setup.md' 파일 내용을 참고함.

### 3.4.2 Firestore doc modeling (서브컬렉션로 단위 격리)

- 세부 정책 : : 'PRD-3.4.2-Firestore doc Modeling.md' 파일 내용을 참고함.
- 캐시/미러는 선택 사항으로 향후 사용자가 많아질 경우 성능을 위해 고려해야함

## 🎯4. 향후 확장

- 다국어 지원 (한국어/영어/스페인어 등)
- 복사/부모 전용 앱 (푸시 알림 연동)
- 교구 단위 통계/리포트

---
