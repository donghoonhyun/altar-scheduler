# PRD - Altar Scheduler / 복사 스케줄러 (OCR & Seed 파이프라인)

**버전:** v2.4.3
**작성일:** 2025-10-05
**작성자:** Laon Aca
**관련 모듈:** `Mass Event Management`, `Seed Script`, `OCR Import`

---

## 1. 개요

9월 초등부 복사번표 PDF를 기반으로

* OCR로 표 데이터를 인식하고,
* 이를 CSV 형태로 변환한 뒤,
* `parseMassTable_ocr.ts` 스크립트를 통해 `RawCell[]` 데이터를 자동 생성하고,
* React 화면에서 시각적으로 확인 및 교정 후,
* 최종적으로 `massEvents_SG00001_YYYYMM.ts` seed 데이터를 생성하는 파이프라인 구축.

---

## 2. 구성 요소 구조

| 구분              | 경로                                                  | 역할                             |
| --------------- | --------------------------------------------------- | ------------------------------ |
| 📘 PDF 원본       | `/scripts/data/pdf/25년9월초등부복사번표.pdf`                | OCR 입력 원본                      |
| 📄 CSV (OCR 결과) | `/scripts/data/ocr/25년9월초등부복사번표.csv`                | OCR or 수기 입력 후 교정 데이터          |
| ⚙️ OCR Parser   | `/scripts/utils/parseMassTable_ocr.ts`              | CSV → `RawCell[]` 자동 변환        |
| 📂 RawCell 결과   | `/scripts/data/raw/massEvents_YYYYMM_raw.ts`        | 1차 데이터 (화면 교정 전)               |
| 🧩 React 화면     | `/src/pages/mass-events/editor/MassEventEditor.tsx` | 데이터 시각화 및 교정용 UI               |
| 💾 Export 기능    | `exportToCsv()`                                     | 교정 후 RawCell 데이터를 CSV로 저장      |
| 🔨 Generator    | `/scripts/utils/generateMassEvents_TEMPLATE.ts`     | 교정된 RawCell → 최종 Seed 생성       |
| 📦 최종 Seed      | `/scripts/data/massEvents_SG00001_YYYYMM.ts`        | Firestore seedRoles.ts에서 사용 가능 |

---

## 3. 데이터 흐름

```
PDF (복사번표)
      ↓ OCR / 수기입력
CSV (25년9월초등부복사번표.csv)
      ↓
parseMassTable_ocr.ts
      ↓
RawCell[] (massEvents_YYYYMM_raw.ts)
      ↓
React Editor 화면 (직접 수정)
      ↓
CSV Export (교정 완료본)
      ↓
generateMassEvents_TEMPLATE.ts
      ↓
massEvents_SG00001_YYYYMM.ts (seed 완료)
```

---

## 4. OCR Parser (`parseMassTable_ocr.ts`) 주요 로직

| 단계 | 동작                                         |
| -- | ------------------------------------------ |
| ①  | “일~토” 포함된 요일 행 자동 탐색                       |
| ②  | 요일 바로 아래 행에서 날짜(1~30) 인식                   |
| ③  | 각 열(요일)에 대해 아래 2칸씩 탐색                      |
| ④  | 셀 내용이 “성시간”, “성체조배”, “성체강복”, “공란” → PASS   |
| ⑤  | “교중”, “혼배”, “어린이”, “추모” → `title` 필드 자동 지정 |
| ⑥  | 나머지는 이름 문자열로 파싱 (`이름 + 세례명` 묶음)            |
| ⑦  | `RawCell[]` 배열 생성 후 `.ts` 파일로 저장           |

✅ 실행 예시:

```bash
npx tsx scripts/utils/parseMassTable_ocr.ts 202509 ./scripts/data/ocr/25년9월초등부복사번표.csv
```

✅ 출력:

```
✅ Generated scripts/data/raw/massEvents_202509_raw.ts
📊 Total events: 64
```

---

## 5. RawCell 구조

```ts
interface RawCell {
  date: string;            // YYYY-MM-DD
  title?: string;          // 교중미사, 혼배미사, 어린이미사 등
  names: string[];         // ["김한희 임마누엘라", "황지안 클라라"]
}
```

---

## 6. Seed Generator (`generateMassEvents_TEMPLATE.ts`)

* RawCell[] → Firestore Seed 형태 변환
* `members_with_id.ts` 기반으로 `name+baptismal_name` → `member_id` 매핑
* `member_ids` 옆에 `// 김한희 임마누엘라, 황지안 클라라` 식의 주석 자동 추가

✅ 실행:

```bash
npx tsx scripts/utils/generateMassEvents_TEMPLATE.ts
```

✅ 출력:

```
✅ massEvents_SG00001_202509.ts generated: 64 events
```

---

## 7. React Editor 개념 설계

| 항목           | 설명                                                         |
| ------------ | ---------------------------------------------------------- |
| **목적**       | OCR로 생성된 RawCell[]을 눈으로 검수 및 직접 수정                         |
| **구조**       | `<table>` 기반 행 편집 UI (날짜, 제목, 복사명단)                        |
| **편집 가능 필드** | title, names                                               |
| **저장 방식**    | 수정된 데이터를 `exportToCsv()`로 CSV 다운로드                         |
| **후속 처리**    | generateMassEvents_TEMPLATE.ts에서 CSV를 import 하여 최종 seed 생성 |

---

## 8. 향후 계획

| 단계 | 항목                                    | 상태                  |
| -- | ------------------------------------- | ------------------- |
| ①  | CSV OCR 자동 변환 (`parse_pdf_to_csv.ts`) | 보류 (수동 입력으로 대체)     |
| ②  | React 편집화면 구현 (`MassEventEditor.tsx`) | 진행 예정               |
| ③  | Seed 자동 업로드 (`seedRoles.ts` 연동)       | 이후 통합 예정            |
| ④  | Timezone 및 dateOffset 로직 연결           | 완료 (PRD 2.4.2.3 참고) |

---

## 9. 핵심 코드 파일 리스트

```
scripts/
├── data/
│   ├── ocr/
│   │   └── 25년9월초등부복사번표.csv
│   ├── raw/
│   │   └── massEvents_202509_raw.ts
│   ├── servers_with_id.ts
│   ├── massEvents_SG00001_202509.ts
│   └── ...
└── utils/
    ├── parseMassTable_ocr.ts
    ├── generateMassEvents_TEMPLATE.ts
    └── ...
```

---

## 10. 다음 단계 제안 (2025-10-06)

1️⃣ `massEvents_202509_raw.ts`를 React 화면에서 시각화 (`MassEventEditor.tsx`)
2️⃣ 교정 기능 + “CSV 내보내기” 기능 구현
3️⃣ 10월 번표(`25년10월초등부복사번표.pdf`)로 동일 파이프라인 재사용 테스트
