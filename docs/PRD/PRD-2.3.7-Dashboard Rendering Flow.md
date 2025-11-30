# PRD 2.3.7 Dashboard Rendering Flow

## 📖 서선 개요

대시보드 화면(`Dashboard.tsx`)은 복사단의 실적을 통계, 차원 당 일정 계획, 및 현우 및 차원 미사일정을 하나의 화면에서 확인할 수 있는 것을 목적으로 한다.

---

## 🤖 구성 구조

```
Dashboard
 ├─ 상단 인사영역 (User Info + RoleBadge)
 ├─ 주요 카드 (ServerStats, NextMonthPlan)
 └─ 미사일정 달력 (MassCalendar)
```

---

## 💡 데이터 로딩 구조

| 구성요소          | 데이터 출처                         | 로딩 방식                  | 설명                      |
| ------------- | ------------------------------ | ---------------------- | ----------------------- |
| ServerStats   | Firestore `server_groups/{id}` | Firestore direct query | 복사단 기본정보 및 통계           |
| NextMonthPlan | Firestore `mass_events`        | Firestore direct query | 차원 미사일정 등록 현황           |
| MassCalendar  | `useMassEvents(serverGroupId)` | Firestore + Helper     | 복사단의 미사일정 및 배정 복사 이름 표시 |

---

## 💪 주요 구성요소별 설명

### 1. `useMassEvents` (공용 훅)

* **위치:** `src/hooks/useMassEvents.ts`
* **역할:** 특정 복사단(`serverGroupId`)의 `mass_events`과 `members`을 조합하여 반환
* **공통 사용처:** `Dashboard`, `MassEventPlanner`
* **반환값:**

  ```ts
  {
    events: MassEventCalendar[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
  }
  ```

> Firestore `getDocs()`로 `mass_events`를 불러오고,
> `member_ids`를 `getMemberNamesByIds()`로 변환한다.

---

### 2. `MassCalendar` (공용 캘린더 컴포넌트)

* **역할:** 월 단위 미사 일정 표시
* **특징:**

  * 미사명, 복사 이름, 인원수 표시
  * `status`에 따라 아이콘 강조 (미확정, 설문확정, 최종확정)
  * 일요일(`isSunday`)은 배경색 동일, **테두리만 붉은색** 처리

---

### 3. `Dashboard.tsx`

* **주요 역할:** 사용자 환영 메시지 + 복사단 현황 + 미사 일정 종합뷰
* **렌더링 순서:**

  1. URL `serverGroupId` 추출
  2. `useSession()`으로 사용자정보 로드
  3. `useMassEvents(serverGroupId)` 호출
  4. 상단 카드 (`ServerStats`, `NextMonthPlan`) 렌더링
  5. 하단 `MassCalendar` 표시

---

## 👨‍💻 코드 플로우 예시

```tsx
const { serverGroupId } = useParams();
const { events, loading, error } = useMassEvents(serverGroupId);

return (
  <Container>
    <Heading>안녕하세요, {userName} 플래너님 👋</Heading>
    <RoleBadge serverGroupId={serverGroupId} />

    <ServerStats parishCode="SG00001" serverGroupId={serverGroupId} />
    <NextMonthPlan serverGroupId={serverGroupId} />

    <MassCalendar
      events={events}
      highlightServerName={userName}
    />
  </Container>
);
```

---

## ⚙️ 상태 처리 규칙

| 상태                  | 아이콘 / 색상       | 설명           |
| ------------------- | -------------- | ------------ |
| `MASS-NOTCONFIRMED` | 회색 시계 아이콘 (⏱️) | 배정은 되었으나 미확정 |
| `SURVEY-CONFIRMED`  | 청색 자물쇠 (🔒)    | 설문으로 확정됨     |
| `FINAL-CONFIRMED`   | 금색 자물쇠 (🔐)    | 최종 확정        |

---

## 🎨 UI / UX 규칙

* 상단 배경: `bg-gradient-to-b from-blue-50 to-blue-100`
* 카드: `shadow-md rounded-2xl p-4`
* 달력 셀: `gap-2` 유지, `isSunday`는 `border-red-300`
* 라이트/다크모드 대응 (`dark:` 클래스 병행)

---

## 🧩 공통 헬퍼 연결

| 함수명                          | 위치                     | 설명                    |
| ---------------------------- | ---------------------- | --------------------- |
| `getMemberNamesByIds()`      | `src/lib/firestore.ts` | member_ids → 이름 배열 변환 |
| `makeFirestoreTimestamp()`   | `src/lib/firestore.ts` | Timestamp 생성          |
| `toISOStringFromFirestore()` | `src/lib/firestore.ts` | Timestamp → 날짜 문자열    |

---

## ✅ 예외 처리

| 상황                 | 처리 방식                 |
| ------------------ | --------------------- |
| `serverGroupId` 누락 | 잘못된 경로 메시지 출력         |
| 로딩 중               | '로딩 중...' 텍스트 표시      |
| Firestore 쿼리 실패    | 빨간색 오류 메시지            |
| events 비어있음        | '등록된 미사 일정이 없습니다.' 표시 |

---

## 🔄 PRD 연계

| 섹션                               | 관련 파일                                   |
| -------------------------------- | --------------------------------------- |
| `2.3.7 Dashboard Rendering Flow` | `src/pages/Dashboard.tsx`               |
| `2.4.2.1 Firestore Access Layer` | `src/lib/firestore.ts`                  |
| `2.4.3 MassEvent Calendar UI`    | `src/pages/components/MassCalendar.tsx` |
| `2.4.4 MassEvent Planner`        | `src/pages/MassEventPlanner.tsx`        |

---

✅ 이 구조로 Dashboard와 MassEventPlanner 모두 동일한 `useMassEvents` 훅을 통해 데이터를 공유하고, UI 일관성을 유지하며 Firestore의 데이터 변경에 동기화된다.
