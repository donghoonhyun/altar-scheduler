# PRD-2.5.1-ApplyPresetMassEvents.md (Preset기반 월간 미사 일정 자동생성)

## 🧩 1. 섹션 개요

본 섹션은 **요일별 미사 Preset**을 기반으로 선택된 월의 전체 미사 일정을 자동 생성하는 기능을 정의한다.
이 기능은 Planner가 매주 반복되는 미사 일정 패턴을 미리 설정해두면,
Preset을 기반으로 선택된 월의 1일부터 말일까지 **요일 반복 방식으로 자동 생성**하여 월간 미사 일정을 초기화한다.

---

## 🧩 2. 변경 배경

---

## 🧩 3. 주요 목표

| 항목             | 설명                                  |
| -------------- | ----------------------------------- |
| 1.Preset 관리화면 | 일요일~토요일까지 요일별 패턴(미사일정)을 미리 세팅 해놓음 |
| 2.Preset 기반 월간 미사 일정 생성 | Preset에서 요일별 미사 목록을 읽어 월 전체에 반복 생성  |
| 3.기존 월 미사 일정 초기화 | 생성 전 기존 mass_events 전체 삭제           |
| 4.상태 관리       | 새로 생성되는 미사는 항상 `MASS-NOTCONFIRMED`  |
| 5.Preset초기화 이후 Planner 미세조정  | Planner가 Preset 페이지에서 요일별 항목을 직접 편집 |

---

## 🧩 4. Preset 구조

- Preset은 이후 여러개가 있을 수 있으며, 일단은 `default` 한개만 설정함

### 컬렉션 위치

```ts
  server_groups/{sg}/mass_presets/default
```

### 문서 구조

```json
{
  "weekdays": {
    "0": [ { "title": "주일 10시 미사", "required_servers": 3 } ],
    "1": [],
    "2": [],
    "3": [ { "title": "평일 수 미사", "required_servers": 2 } ],
    "4": [],
    "5": [ { "title": "평일 금 미사", "required_servers": 1 } ],
    "6": []
  },
  "updated_at": "Timestamp"
}
```

* 0=일요일, 6=토요일
* 각 요일별로 여러 개의 미사 목록 구성 가능

---

## 🧩 5. 동작 시나리오

1. Planner가 **미사 Preset 설정 페이지**에서 요일별 반복 미사를 설정함
2. MassEventPlanner 화면에서 targetMonth(월)를 선택
3. Toolbar의 **[Preset 일정 자동 생성]** 버튼을 클릭
4. Drawer → “해당 월의 모든 기존 일정이 삭제됩니다” 경고 표시
5. Cloud Function `applyPresetMassEvents` 실행
6. 기존 일정 삭제 → Preset 기반으로 월 전체 일정 생성
7. Planner 달력 자동 새로고침

---

## 🧩 6. Cloud Function 사양

### 함수명

```ts
  applyPresetMassEvents
```

### 요청 파라미터

```ts
{
  serverGroupId: string;
  targetMonth: string; // "2025-11"
}
```

### 권한

* `planner` role required

### 리전

* `asia-northeast3`

### 로직 흐름 요약

```ts
1) auth 및 planner role 확인
2) Preset 문서 로드
3) targetMonth 범위(1일~말일) 계산
4) targetMonth의 기존 mass_events 모두 삭제
5) 1일부터 말일까지 반복
6) dayjs(date).day() → 요일 dow 계산
7) preset.weekdays[dow] 목록을 그대로 복사하여 mass_events 생성
8) status = "MASS-NOTCONFIRMED"
```

---

## 🧩 7. Firestore 영향

### 새로 생성되는 mass_events 필드 예시

```json
{  
  "event_date": "20251103",  
  "title": "평일 월 미사",
  "required_servers": 2,
  "member_ids": [],
  "not_available_members": [],   // 가용성 설문결과에 따른 불가능한 복사들 ids
  "created_at": "serverTimestamp()",
  "updated_at": "serverTimestamp()"
}
```

### 삭제되는 기존 데이터

* 해당 월의 모든 `mass_events`
* 기존 설문 응답 (`availability_surveys/{yyyymm}`)은 Planner가 필요 시 별도 삭제

---

## 🧩 8. 예외 처리

| 상황        | 메시지                                   |
| --------- | ------------------------------------- |
| preset 없음 | "설정된 Preset이 없습니다. 먼저 요일별 미사를 등록하세요." |
| 이미 확정된 월  | "이 월은 이미 확정되어 수정할 수 없습니다."            |
| 생성된 일정 없음 | "Preset에 해당하는 미사가 없어 생성된 일정이 없습니다."   |

---

## 🧩 9. UI / UX

### Drawer 내용

* Preset 요약 표시
* 경고 문구: “이 월의 기존 모든 미사 일정이 삭제된 후 Preset 기준으로 완전히 재생성됩니다.”
* [취소] [생성] 버튼

### Preset 설정 페이지 추가

* 요일별 카드 UI (일~토)
* 미사목록 추가/삭제/편집
* required_servers 입력
* [저장] 버튼

---

## 🧩 10. 상태 관리

* 생성된 모든 일정의 초기 상태는 `MASS-NOTCONFIRMED`
* 이후 Planner가 별도의 버튼으로 `MASS-CONFIRMED` 전환

---

## 🧩 11. 연계 문서

* PRD-2.4.8 MassEvent Planner UI
* PRD-2.4.7 MassEvent Calendar UI
* PRD-3.4.2 Firestore Collections Structure
* PRD-2.4.2.3 Timezone Handling

---

## ✅ 12. 결론

본 개정으로 기존 전월 패턴 기반 복사 방식을 완전히 제거하고,
Planner가 지정한 Preset 기반의 **단순하고 안정적인 자동 생성 시스템**을 도입한다.

이는 프로젝트 전체의 복잡성을 크게 줄이고, 매달 일정 생성의 안정성과 예측 가능성을 보장한다.
