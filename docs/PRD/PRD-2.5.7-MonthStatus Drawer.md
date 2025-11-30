# PRD 2.5.7 MonthStatus Drawer UI (MassCalendar 연동 버전)

## 🧩 1. 섹션 개요

`MonthStatusDrawer`는 복사단 단위 월 상태(`month_status/{yyyymm}.status`)를
플래너가 한 번에 변경할 수 있도록 지원하는 Drawer UI이다.

이 Drawer는 **달력 상단의 상태 배지(StatusBadge)** 클릭 시 열리며,
해당 월의 상태를 단계적으로 전이할 수 있다.

---

## 🧩 2. 주요 역할

| 기능             | 설명                                                                         |
| -------------- | -------------------------------------------------------------------------- |
| 월 상태 조회        | 선택된 월(`YYYYMM`)의 현재 상태를 Firestore `month_status/{yyyymm}` 에서 불러옴           |
| 상태 변경          | 사용자가 선택한 상태(`MASS-CONFIRMED`, `SURVEY-CONFIRMED`, `FINAL-CONFIRMED`)로 업데이트 |
| 편집 잠금(lock) 표시 | 자동배정 이후 편집 제한 시 `lock: true` 표시                                            |
| 상태 메모(note)    | 변경 이유나 참고사항을 기록할 수 있음 (`optional`)                                         |
| Drawer 닫기      | 저장 또는 취소 클릭 시 닫힘, Firestore onSnapshot으로 UI 자동 갱신                          |

---

## 🧩 3. 연동 구조

```ts
MassCalendar
  ├── 📅 2025년 10월 🔒 확정됨
  └── 범례: 🔒 확정됨 / 🗳️ 설문마감 / 🛡️ 최종확정
       ↓
 (배지 클릭)
       ↓
MonthStatusDrawer
  ├── 현재 월 상태 표시
  ├── 상태 선택 (RadioGroup)
  ├── note 입력 필드
  ├── 저장 / 취소 버튼
```

---

## 🧩 4. UI 구성 구조

```ts
MonthStatusDrawer
 ├── Header: "10월 상태 변경"
 ├── Body:
 │   ├── 상태 선택 (RadioGroup)
 │   ├── 비고 입력 (Textarea)
 │   └── 잠금 표시 (LockBadge)
 └── Footer:
     ├── [저장하기] 버튼 (Primary)
     └── [취소] 버튼 (Ghost)
```

---

## 🧩 5. 상태 전이 규칙

| 현재 상태               | 다음 상태              | 설명                |
| ------------------- | ------------------ | ----------------- |
| `MASS-NOTCONFIRMED` | `MASS-CONFIRMED`   | 미사 일정 확정          |
| `MASS-CONFIRMED`    | `SURVEY-CONFIRMED` | 설문 마감             |
| `SURVEY-CONFIRMED`  | `FINAL-CONFIRMED`  | 최종 확정 (자동배정 완료 후) |
| `FINAL-CONFIRMED`   | -                  | 변경 불가 (lock=true) |

---

## 🧩 6. Firestore 연동

| 필드           | 타입        | 설명                                                                |
| ------------ | --------- | ----------------------------------------------------------------- |
| `status`     | string    | 월 상태 코드 (`MASS-CONFIRMED`, `SURVEY-CONFIRMED`, `FINAL-CONFIRMED`) |
| `updated_by` | string    | 마지막 수정자 uid or email                                              |
| `updated_at` | Timestamp | `serverTimestamp()`                                               |
| `note?`      | string    | 상태 변경 사유                                                          |
| `lock?`      | boolean   | true면 상태 변경 비활성화                                                  |

**저장 로직:**

```ts
await setDoc(doc(db, `server_groups/${sg}/month_status/${yyyymm}`), {
  status: newStatus,
  updated_by: currentUser.email,
  updated_at: serverTimestamp(),
  note,
}, { merge: true });
```

---

## 🧩 7. 상태 선택 UI (RadioGroup 예시)

| 항목      | 라벨                  | 설명            |
| ------- | ------------------- | ------------- |
| ⚪ 미확정   | `MASS-NOTCONFIRMED` | 미사 일정 확정 전 단계 |
| 🔵 확정됨  | `MASS-CONFIRMED`    | 설문 가능 상태      |
| 🟡 설문마감 | `SURVEY-CONFIRMED`  | 설문 완료 상태      |
| 🟢 최종확정 | `FINAL-CONFIRMED`   | 확정 완료, 편집 잠금  |

---

## 🧩 8. 인터랙션 흐름

1️⃣ `MassCalendar` 상단 배지 클릭
2️⃣ `MonthStatusDrawer` 오픈
3️⃣ 상태 선택 및 비고 입력
4️⃣ [저장하기] 클릭 → Firestore 업데이트
5️⃣ `onSnapshot` → `MassCalendar` 상단 배지 즉시 반영
6️⃣ Drawer 자동 닫힘

---

## 🧩 예시 코드

```tsx
<StatusBadge
  status={monthStatus}
  onClick={() => setDrawerOpen(true)}
/>

<MonthStatusDrawer
  open={drawerOpen}
  currentMonth={currentMonth}
  monthStatus={monthStatus}
  onClose={() => setDrawerOpen(false)}
/>
```

---

## 🧩 결론

* 월 상태 변경은 이제 **MassCalendar 상단 배지 → MonthStatusDrawer** 로 직관적으로 연결된다.
* `month_status/{yyyymm}` 문서는 Firestore 단일 진입점으로 사용되어,
  `MassEventPlanner`, `AutoAssign`, `Survey` 등 모든 기능의 상태 기준이 일원화된다.
* UX는 “클릭 한 번으로 상태 변경”이 가능하며, 변경 결과는 실시간으로 달력 상단에 반영된다.
