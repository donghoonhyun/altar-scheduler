# PRD-2.5.5-Auto ServerAssignment Logic

## 🧩 섹션 개요

본 섹션은 복사단의 미사 일정 자동 배정 및 교체(대타) 요청 로직을 정의한다.
이 로직은 Cloud Function 또는 Client-side Script로 실행되며, `mass_events` 컬렉션의 복사 배정(`member_ids`)을 자동으로 계산/갱신한다.

---

## 🧩 주요 목표

| 항목                   | 설명                                                               |
| -------------------- | ---------------------------------------------------------------- |
| ⚙️ **자동 배정(Assign)** | 각 미사에 필요한 복사 인원을 기준으로 균등 배정                                      |
| 🔁 **교체 요청(Swap)**   | 기존 배정 복사가 대타 요청 시 다른 복사로 교체                                      |
| 🛡️ **상태 반영**         | 배정 완료 시 `status` 필드를 `SURVEY-CONFIRMED` 또는 `FINAL-CONFIRMED`로 변경 |
| 🕒 **시간 일관성**       | 모든 처리 로직은 `Asia/Seoul` 기준에서 동일하게 계산                           |

---

## 🧩 데이터 구조 요약

Firestore 컬렉션:
`server_groups/{serverGroupId}/mass_events/{eventId}`

| 필드명                 | 타입       | 설명                                                           |
| ------------------- | -------- | ------------------------------------------------------------ |
| `event_date`         | string   | (yyyymmdd) 현지 기준 날짜 문자열                                |
| `required_servers`  | number   | 필요한 복사 인원                                               |
| `member_ids`        | string[] | 배정된 복사 ID 목록                                            |
| `main_member_id`    | string   | 주복사 ID (배정된 인원 중 선임)                                   |
| `available_members` | string[] | 설문에서 가능 응답한 복사 목록                                   |
| `status`            | string   | `MASS-NOTCONFIRMED` / `SURVEY-CONFIRMED` / `FINAL-CONFIRMED` |

---

## 🧩 1️⃣ 자동 배정 로직 (Assign)

```ts
async function autoAssignMassEvents(data, context) {
    // 1. 대상 월의 미사 목록 조회
    // 2. 활동 중인(Active) 멤버 조회
    // 3. 해당 월의 설문 응답(Availability) 조회 (불가 인원 파악)
    // 4. 전월 배정 실적(Count) 계산
    
    // 5. 각 미사별 루프:
    //    a. 후보군 필터링 (불참자 제외)
    //    b. 정렬 (Sort):
    //       1순위: 총 배정 횟수 (전월 + 이번달 누적) 오름차순 (적게 한 사람 우선)
    //       2순위: 이름 가나다순
    //    c. 상위 N명 선택 (required_servers)
    //    d. 주복사(Main Server) 선정:
    //       1순위: 입단년도(start_year) 빠른 순 (오래된 사람 우선)
    //       2순위: 이름 가나다순
    //    e. 배정 결과(member_ids, main_member_id, updated_at) 업데이트
}
```

### 💡 주요 로직 상세

1.  **제외 조건 (Exclusion)**:
    *   활동 중단(`active: false`) 멤버.
    *   해당 미사에 '불가능'(`unavailable`)으로 설문 응답한 멤버.

2.  **배정 우선순위 (Priority)**:
    *   **균등 배정 원칙**: `(전월 배정 횟수 + 금월 현재까지 배정된 횟수)`가 **적은** 멤버를 우선 배정한다.
    *   실적이 동일한 경우, **이름 가나다순**으로 배정하여 예측 가능성을 유지한다.

3.  **주복사 선정 (Main Server)**:
    *   배정된 인원들 중에서 주복사를 자동 선정한다.
    *   **1순위**: `start_year`가 가장 빠른(오래된) 멤버 (선임 복사).
    *   **2순위**: 입단년도가 같으면 이름 가나다순.

4.  **초기화 경고**:
    *   자동 배정 실행 시, 해당 월의 기존 배정 정보는 모두 **초기화(삭제)** 되고 새로 배정됨을 사용자에게 경고(Confirm)한다.

---

## 🧩 2️⃣ 교체 요청 로직 (Swap)

```ts
async function swapServerRequest(serverGroupId: string, eventId: string, oldMemberId: string, newMemberId: string) {
  const ref = doc(db, `server_groups/${serverGroupId}/mass_events/${eventId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const members: string[] = data.member_ids || [];

  if (!members.includes(oldMemberId)) {
    console.warn('Old member not found in assignment');
    return;
  }

  const updated = members.map((m) => (m === oldMemberId ? newMemberId : m));

  await updateDoc(ref, {
    member_ids: updated,
    status: data.status === 'FINAL-CONFIRMED' ? 'FINAL-CONFIRMED' : 'SURVEY-CONFIRMED',
    updated_at: serverTimestamp(),
  });
}
```

### 💡특징

* 교체 요청 시 기존 복사 ID를 신규 복사로 대체
* 최종 확정(`FINAL-CONFIRMED`) 상태에서는 관리자 권한만 변경 가능

---

## 🧩 3️⃣ 배정 균형 알고리즘 (Balance)

| 방식              | 설명                              |
| --------------- | ------------------------------- |
| **Round-robin** | 최근 배정이 적은 복사를 우선 배정 (선호)        |
| **Random**      | 설문 응답자 중 무작위 선택 (테스트용)          |
| **Weighted**    | 특정 직분/숙련도 점수 기반 가중치 배정 (차후 확장용) |

기본 구현은 **누적 배정 횟수(전월+금월)** 를 기준으로 정렬하여, 배정 기회가 적었던 복사에게 우선권을 주는 방식을 사용한다.

---

## 🧩 4️⃣ Cloud Function 트리거

| 트리거               | 조건            | 동작                                          |
| ----------------- | ------------- | ------------------------------------------- |
| `onSurveyClosed`  | 설문이 종료된 시점    | 각 `mass_event`에 대해 `assignMassServers()` 호출 |
| `onSwapRequested` | 복사 교체 요청 발생 시 | `swapServerRequest()` 실행                    |
| `onFinalConfirm`  | 관리자 확정 시      | 모든 일정의 상태를 `FINAL-CONFIRMED`로 변경            |

---

## 🧩 5️⃣ 상태 전이 규칙

| 현재 상태               | 전이 가능 상태           | 설명             |
| ------------------- | ------------------ | -------------- |
| `MASS-NOTCONFIRMED` | `SURVEY-CONFIRMED` | 설문 응답 기반 자동 배정 |
| `SURVEY-CONFIRMED`  | `FINAL-CONFIRMED`  | 관리자 승인 시 확정    |
| `FINAL-CONFIRMED`   | -                  | 변경 불가          |

---

## 🧩 6️⃣ 시간대 처리

* 모든 시간 및 날짜 계산은 대한민국 표준시(Asia/Seoul) 로 고정한다.
* Cloud Function 환경에서는 `process.env.TZ = 'Asia/Seoul'` 설정 필수.
* Firestore에 저장되는 날짜(event_date)는 항상 "YYYYMMDD" 문자열 기준이다.
  . server_groups.timezone 필드 및 지역별 변환 로직은 완전히 폐기되었다.
  . 모든 주차/요일 계산은 dayjs(event_date, "YYYYMMDD") 로 단순 처리한다.

---

## 🧩 7️⃣ 로그 및 감사 기록

| 로그 항목               | 설명                                 |
| ------------------- | ---------------------------------- |
| `assigned_by`       | 배정 수행자 (Cloud Function or User ID) |
| `swap_requested_by` | 교체 요청자 ID                          |
| `updated_at`        | `serverTimestamp()`                |

---

## 🧩 관련 문서

| 섹션                               | 관련 파일                                      |
| -------------------------------- | ------------------------------------------ |
| `2.4.2.1 Firestore Access Layer` | `src/lib/firestore.ts`                     |
| `2.4.2.3 Timezone Handling`      | `src/lib/dateUtils.ts`                     |
| `2.4.8 MassEvent Planner`        | `src/pages/MassEventPlanner.tsx`           |
| `2.4.9 MassEvent Drawer`         | `src/pages/components/MassEventDrawer.tsx` |

---

## 🧩 결론

본 로직은 Firestore 데이터 구조와 Cloud Function 트리거를 기반으로,
복사 자동 배정과 교체 요청을 안정적으로 처리한다.
자동 배정 결과는 실시간(`onSnapshot`)으로 UI에 반영되며, 관리자는 Drawer UI를 통해 상태를 수동으로 전이시킬 수 있다.
