# PRD-2.7 ServerMain (복사 메인)

---

## 🧩 1. 섹션 개요

이 문서는 복사(Server) 사용자가 로그인 후 접근하는 **메인 페이지(ServerMain)** 의 기능과 동작 규칙을 정의한다.  
본 페이지는 플래너용 대시보드(Dashboard)와 구분되며, 복사 개인의 시점에서 **월별 미사 일정과 본인 배정 현황**을 확인할 수 있도록 설계되었다.

---

## 🧩 2. 주요 목적

| 항목 | 설명 |
|------|------|
| 🎯 역할 | 복사(Server) 전용 홈 화면 |
| 📅 표시 내용 | 월별 미사 일정, 본인 배정일 표시 |
| 🔁 실시간 반영 | Firestore `mass_events` 및 `month_status` 실시간 구독 |
| 🔒 접근 제어 | `members.active = true` 인 사용자만 접근 가능 |
| 🕓 상태 반영 | `month_status/{yyyymm}.status` 값에 따라 달력/Drawer 표시 변경 |

---

## 🧩 3. 주요 구성 요소

### 3.1 UI 구조

```tsx
    ServerMain.tsx
    ├── Header: 성당명 + 복사 이름(세례명)
    ├── StatusCard: 월 상태 표시 + 설문/안내 문구
    ├── Calendar: 월별 미사 일정 표시
    └── MassEventMiniDrawer: 날짜 클릭 시 상세 Drawer
```

---

## 🧩 4. 주요 기능

구분 기능 설명
🔹 성당명 표시 Firestore server_groups/{id}에서 name 필드 조회
🔹 복사 이름 표시 로그인 세션(uid) 기반으로 members/{uid} 문서 조회
🔹 월 상태 구독 month_status/{yyyymm} 실시간 구독 (onSnapshot)
🔹 미사 일정 구독 mass_events 컬렉션에서 event_date 기준 월 단위 구독
🔹 달력 렌더링 상태에 따라 배경색 및 점(dot) 표시
🔹 Drawer 표시 클릭한 날짜의 미사 목록(mass_events)을 Drawer로 표시
🔹 설문 이동 버튼 상태가 MASS-CONFIRMED일 경우 “설문 페이지로 이동” 버튼 표시

---

## 🧩 5. 상태별 UI 동작 요약

상태 코드 설명 달력 표시 Drawer 동작
MASS-NOTCONFIRMED 미사 미확정 회색 (비활성) Drawer 열리지 않음
MASS-CONFIRMED 설문 진행 중 핑크 배경(일정 있음) 열리지만 복사명은 비공개
SURVEY-CONFIRMED 설문 마감 / 배정 준비 중 동일 열리지만 복사명은 비공개
FINAL-CONFIRMED 최종 확정 완료 파랑/본인강조 표시 복사명 표시됨

---

## 🧩 6. Drawer 내 배정 복사명 표시 정책 (Server 전용)

📍적용 대상

/server-main 페이지의 Drawer 컴포넌트: MassEventMiniDrawer.tsx

📍정책 목적

복사(Server)는 미사 일정과 본인 배정일은 볼 수 있지만,
다른 복사들의 배정 현황은 최종 확정(FINAL-CONFIRMED) 상태가 되기 전까지는 볼 수 없도록 제한한다.

이로써 설문 단계에서의 편견·불공정 노출을 방지하고 개인정보 보호를 강화한다.

📍표시 조건
월 상태(month_status) Drawer 열림 복사명 표시 설명
MASS-NOTCONFIRMED ❌ - 미사 일정 미확정. Drawer 자체 비활성.
MASS-CONFIRMED ✅ 🚫 비공개 (“배정 대기 중”) 설문 진행 중. 복사명 비공개.
SURVEY-CONFIRMED ✅ 🚫 비공개 (“배정 대기 중”) 자동배정 준비 단계. 복사명 비공개.
FINAL-CONFIRMED ✅ ✅ 공개 (배정 복사명 표시) 최종 확정 완료 후 복사명 표시.

📍UI 표시 예시

```lua
| 상태                                    | Drawer 내용 예시                                 |
| ------------------------------------- | -------------------------------------------- |
| **MASS-CONFIRMED / SURVEY-CONFIRMED** | <span style="color:gray">배정 대기 중</span>      |
| **FINAL-CONFIRMED**                   | <span>김한희 임마누엘라</span>, <span>황지안 클라라</span> |
```

📍기술 구현 요약

```tsx ServerMain.tsx
<MassEventMiniDrawer
  isOpen={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  events={selectedEvents}
  date={selectedDate}
  serverGroupId={serverGroupId}
  monthStatus={monthStatus}   // ✅ 상태 전달
/>
```

```tsx MassEventMiniDrawer.tsx
if (monthStatus !== 'FINAL-CONFIRMED') {
  setNamesMap({});
  return; // 이름조회 비활성화 → “배정 대기 중” 표시
}
```

📍적용 결과
사용자 배정 복사명 표시 여부
Planner (Dashboard, Drawer) ✅ 항상 표시
Server (ServerMain, MiniDrawer) ✅ 단, FINAL-CONFIRMED일 때만 표시

---

## 🧩 7. 날짜 처리 및 기준 시간

| 항목           | 내용                                                                    |
| ------------ | --------------------------------------------------------------------- |
| Firestore 저장 | `mass_events.event_date = "YYYYMMDD"`                                 |
| 표시 기준        | `dayjs(event_date, "YYYYMMDD")`                                       |
| Timezone     | **Asia/Seoul 고정 (KST)**                                               |
| 변환 함수        | `fromLocalDateToFirestore()`, `toLocalDateFromFirestore()` 등은 사용하지 않음 |
| 요일 표시 예시     | `dayjs(event_date, "YYYYMMDD").format("M월 D일 (ddd)")`                 |

---

## 🧩 8. 연계 문서

기능 관련 문서
Timezone 정책 PRD-2.4.2.3-TimezoneHandling.md
Drawer UI 표준 PRD-2.13-App-UIUX.md
Firestore 구조 PRD-3.4.2-Firestore doc Modeling.md
자동 배정 로직 PRD-2.5.5-Auto ServerAssignment Logic.md

## ✅ 요약

복사용 메인(ServerMain)은 월 상태(month_status)를 실시간 반영하며,
Drawer 내 배정 복사명은 FINAL-CONFIRMED 상태에서만 공개된다.
이전 단계에서는 “배정 대기 중”으로 표시하여 설문 및 자동배정 과정의 공정성을 유지한다.
