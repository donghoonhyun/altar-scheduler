# PRD-2.6.2 ServerSurvey (복사용 설문 화면)

## 🧩 1. 섹션 개요

- `ServerSurvey`는 복사가 플래너가 공유한 설문 URL(예: `/survey/SG00001/202510`)로 접속하여  
    해당 월의 모든 미사 일정 중 **참석 불가능한 일정만 선택**하고 제출하는 페이지이다.
- 이 화면은 플래너가 개시한 설문(`availability_surveys/{yyyymm}`)과 연동되며,  
    복사가 제출한 응답은 Firestore의 `availability_responses` 컬렉션에 저장된다.

---

## 🧩 2. 페이지 경로

| 경로 | 예시 | 비고 |
|------|-------|------|
| `/survey/:serverGroupId/:yyyymm` | `/survey/SG00001/202510` | 복사 설문 전용 접근 링크 |

---

## 🧩 3. 페이지 구조

```tsx
    ServerSurvey
    ├── Header: 성당명 / 월 / 복사 이름
    ├── InfoAlert: "참석 불가한 미사만 체크해주세요."
    ├── CalendarSection
    │   └── MassEventCard (title + 날짜 + 체크박스)
    ├── CheckAllSection
    │   └── [모든 일정에 참석 가능합니다] 체크박스
    ├── SubmitButton ("제출")
    └── Toast: 성공/에러 알림
```

## 🧩 4. Firestore 데이터 연동

### 4.1 미사 일정 조회

```lua
    collection(db, `server_groups/${serverGroupId}/mass_events`)
    where(date, >= startOfMonth)
    where(date, <= endOfMonth)
    orderBy(date)
```

## 4.2 설문 메타 확인

```ts
    doc(db, `server_groups/${serverGroupId}/availability_surveys/${yyyymm}`)
```

status가 "OPEN"이 아닐 경우 “설문이 종료되었습니다.” 메시지 표시 후 응답 차단.

---

## 🧩 5. 제출 데이터 구조

```ts
// Collection: availability_responses
// Doc ID: `${uid}_${yyyymm}`

{
  server_group_id: string,
  uid: string,
  yyyymm: string,
  unavailable: {
    [event_id: string]: false
  },
  dates?: string[],  // yyyymmdd 유지보수용
  submitted_at: serverTimestamp(),
}
```

- 불가 일정만 저장 (false)
- 모든 일정 가능 시: unavailable = {} 또는 null

---

## 🧩 6. 상태 관리

| 상태명              | 타입                      | 설명               |
| ---------------- | ----------------------- | ---------------- |
| `events`         | `MassEventDoc[]`        | 이번 달 미사 일정       |
| `unavailableIds` | `string[]`              | 복사가 선택한 불가 일정 ID |
| `isAllAvailable` | `boolean`               | “모든 일정 가능” 체크 상태 |
| `isSubmitting`   | `boolean`               | 제출 중 여부          |
| `submitted`      | `boolean`               | 제출 완료 여부         |
| `surveyClosed`   | `boolean`               | 설문이 마감된 상태인지 여부  |
| `user`           | `FirebaseUser` or `null` | 로그인 사용자          |

---

## 🧩 7. 주요 이벤트 흐름

① 페이지 로드

- URL param에서 serverGroupId, yyyymm 추출
- 현재 로그인 사용자 확인 (useAuthState)
- 설문 문서(availability_surveys/{yyyymm}) 확인
    → 없거나 status !== "OPEN" → 마감 상태 표시
- mass_events 불러와 리스트 표시

② 불가 일정 선택

- 체크박스 토글 시 unavailableIds 갱신
- “모든 일정 참석” 체크 시 unavailableIds = []

③ 제출 버튼 클릭

- 로그인 안됨 → “로그인이 필요합니다.”
- 설문 마감됨 → “이 설문은 종료되었습니다.”
- 입력 없음 → “참석 불가 일정 또는 전체 참석을 선택하세요.”
- 통과 시 Firestore setDoc() → 성공 시 Toast 표시 + 버튼 비활성화
- 설문 마감 전에는 복사가 자신의 응답을 수정 해서 계속 제출 할 수 있다.

### 7.1 목표 동작 요약

```lua
| 상태            | 사용자 액션      | 동작 결과                           |
| ------------- | ----------- | ------------------------------- |
| 🔹 설문이 OPEN   | 아직 응답 없음    | 새 문서(`setDoc`) 생성               |
| 🔹 설문이 OPEN   | 이미 응답 있음    | 기존 문서 **덮어쓰기(update)** 가능       |
| 🔹 설문이 CLOSED | 응답 페이지 접근 시 | “📋 설문이 종료되었습니다.” 메시지 표시, 수정 불가 |
```

---

## 🧩 8. UI 설계

| 요소           | 구성                          |
| ------------ | --------------------------- |
| Header       | "✝️ 복사 설문 (10월)" + 로그인 이름   |
| InfoAlert    | 회색 상자: “참석 불가한 일정만 체크해주세요.” |
| EventList    | 미사 제목 + 날짜 + 체크박스 (불가 선택용)  |
| CheckAll     | "모든 일정 참석" 체크박스             |
| SubmitButton | 제출 상태/비활성화 조건 반영            |
| Toast        | 결과 알림                       |

---

## 🧩 9. 검증 로직

| 조건           | 메시지                                      |
| ------------ | ---------------------------------------- |
| 로그인 안됨       | “로그인이 필요합니다.”                            |
| 설문 마감됨       | “이 설문은 종료되었습니다.”                         |
| 선택 없음        | “참석 불가한 일정을 선택하거나, 모든 일정에 참석합니다를 체크하세요.” |
| Firestore 실패 | “저장 중 문제가 발생했습니다.”                       |
| 성공           | “✅ 제출이 완료되었습니다.”                         |

## 🧩 10. UX / 시나리오 예시

| 상황        | 화면 동작                     |
| --------- | ------------------------- |
| 설문이 열려 있음 | 달력 로드 + 불가 선택 가능          |
| 설문이 마감됨   | 회색 박스 + “마감되었습니다.” 안내     |
| 제출 후 재방문  | 기존 응답 표시 + 수정 불가          |
| 모든 일정 가능  | “모든 일정 참석” 체크 시 제출 버튼 활성화 |

---

## 🧩 11. 연계 문서

| 문서                 | 파일                                    |
| ------------------ | ------------------------------------- |
| 2.6.1 설문 개시 Drawer | `PRD-2.6.1-SendSurveyDrawer.md`       |
| 3.4.2 Firestore 모델 | `PRD-3.4.2-Firestore doc Modeling.md` |
| 2.13 App UI/UX     | `PRD-2.13-App-UIUX.md`                |

---

## 🧩 12. 확장 기능

- 제출 후 “응답 확인” 모드 (본인 응답 read-only 표시)
- 마감 후 “설문 마감 안내 페이지” 자동 전환

---
