# PRD-3.4.1-Firebase Setup.md

## 📌1. Firebase App Config

### 1.1 개발 Dev Config

- 앱이름 : Altar Scheduler  

  ```ts
  const firebaseConfig = {
  apiKey: "xxxxxxx",
  authDomain: "altar-scheduler-dev.firebaseapp.com",
  projectId: "altar-scheduler-dev",
  storageBucket: "altar-scheduler-dev.firebasestorage.app",
  messagingSenderId: "675620470359",
  appId: "1:xxxxxxx",
  measurementId: "G-S1FVFYKDVH"
  };
  ```

### 1.2 운영 Prd Config

---

## 📌2. Firebase 초기환경 세팅

### 1️⃣ 개발환경 (Local Emulator Suite)

| 항목                  | 설정 값                    | 비고                     |
| ------------------- | ----------------------- | ---------------------- |
| Firebase Project ID | `altar-scheduler-dev`   | Emulator 전용 가상 프로젝트    |
| Auth Emulator       | `http://127.0.0.1:9099` | 로그인 / 회원관리 테스트용        |
| Firestore Emulator  | `http://127.0.0.1:8080` | 모든 데이터 읽기/쓰기 테스트       |
| Functions Emulator  | `http://127.0.0.1:5001` | callable 및 HTTP 함수 테스트 |
| Hosting Emulator    | `http://127.0.0.1:5000` | 로컬 UI 프리뷰              |
| Emulator UI         | `http://127.0.0.1:4000` | 전체 에뮬레이터 모니터링 대시보드     |

> ⚙️ 실행 명령
>
> ```bash
> firebase emulators:start
> npm run dev
> ```

### 2️⃣ 로컬(개발) 환경변수 (.env.local)

```bash
VITE_FIREBASE_API_KEY=fake-api-key
VITE_FIREBASE_AUTH_DOMAIN=localhost
VITE_FIREBASE_PROJECT_ID=altar-scheduler-dev
VITE_FIREBASE_STORAGE_BUCKET=altar-scheduler-dev.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=675620470359
VITE_FIREBASE_APP_ID=1:675620470359:web:dev-local
VITE_FIREBASE_MEASUREMENT_ID=dev-local
```

- 실제 API 키(`AIza...`) 대신 `fake-api-key` 사용
- `authDomain`은 반드시 `localhost` (127.0.0.1은 CORS 문제 발생 가능)
- Vite 개발모드(`npm run dev`)에서 자동 적용됨

### 3️⃣ Firebase 초기화 로직 (`src/lib/firebase.ts`)

```ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator,} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator,} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator,} from "firebase/functions";
import { firebaseConfig } from "../config/firebaseConfig";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "asia-northeast3");

const isLocal =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.hostname.startsWith("192.168.");

if (isLocal) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(auth as any)._emulatorConfig) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  console.log("🔥 Auth/Firestore/Functions Emulator 연결됨");
}
```

💡 Production 빌드 시에는 `isLocal=false` → 실제 Firebase 서비스로 자동 전환됨.
💡 모든 서버 함수는 Asia/Seoul (KST) 기준으로 실행된다. 별도의 timezone 변환은 필요하지 않음.

### 4️⃣ Firestore 보안 규칙 (로컬 전용)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // allow read, write: if request.auth != null;
      // ✅ 로컬 에뮬레이터 전용: 완전 오픈
      allow read, write: if true;
    }
  }
}
```

> ⚠️ 실제 배포 전에는 `request.auth != null` 조건으로 반드시 되돌릴 것.

### 5️⃣ 검증 체크리스트

| 항목                           | 기대 결과                                         |
| ---------------------------- | --------------------------------------------- |
| 로그인 테스트 (`planner@test.com`) | Auth Emulator 연결 로그 출력                        |
| Firestore 조회                 | `server_groups/SG00001/mass_events` 정상 로드     |
| Functions 호출                 | `copyPrevMonthMassEvents` 응답 OK               |
| 콘솔 로그                        | `🔥 Auth/Firestore/Functions Emulator 연결됨` 표시 |
| Dashboard UI                 | “로딩 중...” → 일정 달력 렌더링 완료                      |

---

## 📌3. Cloud Funtions 개발표준

### 3.1 Functions 개요

- Firebase Cloud Functions는 App의 백엔드 로직을 처리하며, Firestore 트리거 및 클라이언트 callable 함수를 통해 동작한다.
- 모든 함수는 `asia-northeast3` 리전(Seoul)에 배포된다.

#### 3.1.1 ⚙️ 공통 설정

- Node.js 버전: `20`
- Firebase Functions SDK: `>=5.1.0`
- 배포 리전: `asia-northeast3 (Seoul)`
- Emulator 실행 시: `http://127.0.0.1:5001/altar-scheduler-dev/asia-northeast3/<functionName>`

#### 3.1.2 Emulator(Function) 환경 세팅 (firebase.ts)

  ```ts
  const functions = getFunctions(app, "asia-northeast3");

  if (isDev) {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    console.log("🔥 Auth/Firestore/Functions Emulator 연결됨! (firebase.ts)");
  }
  export { app, auth, db, functions };
  ```

- 개발 환경에서는 `http://127.0.0.1:5001` 로 연결되며, CORS 문제가 발생하지 않는다.

### 3.2 주요 함수 목록

| 함수명                       | 타입       | 설명                     |
| ------------------------- | -------- | ---------------------- |
| `createServerGroup`       | callable | 복사단 그룹 생성 및 초기화        |
| `createMassEvent`         | callable | 단일 미사 일정 생성            |
| `copyPrevMonthMassEvents` | callable | 전월 일정 패턴 복사 (자동 반복 생성) |
| `createNotification`      | callable | 알림 생성 (관리자 테스트용)       |

(계속 추가...)

### 3.3 배포 및 테스트 절차

- 🔹로컬 실행 (Emulator)

```bash
firebase emulators:start --only functions
```

- 🔹개별 함수 테스트 (HTTP Endpoint)

```bash
curl -X POST http://127.0.0.1:5001/altar-scheduler-dev/asia-northeast3/copyPrevMonthMassEvents \
 -H "Content-Type: application/json" \
 -d '{"serverGroupId":"SG00001", "currentMonth":"2025-09"}'
```

- 🔹 실제 배포

```bash
# 기본 배포 (firebase.json의 codebase 설정에 따라 해당 앱의 함수만 배포됨)
firebase deploy --only functions
```

💡 **주의**: 여러 앱이 같은 Firebase 프로젝트를 공유하므로, `firebase.json`의 `codebase` 설정이 `altar-scheduler`로 되어 있는지 확인하십시오. 이를 통해 다른 앱(예: OrdoAdmin)의 함수를 덮어쓰지 않고 독립적으로 배포할 수 있습니다.

### 3.4 개발 소스 가이드

#### 3.4.1 개발 예시: `copyPrevMonthMassEvents`

```ts
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "../src/config/firebaseConfig";

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, "asia-northeast3");

(async () => {
  const fn = httpsCallable(functions, "copyPrevMonthMassEvents");
  const res = await fn({ serverGroupId: "SG00001", currentMonth: "2025-10" });
  console.log("✅ RESULT:", res.data);
})();
```

#### 3.4.2 Firestore Timestamp 타입 처리 주의사항

- Functions 코드 내 Firestore Timestamp 비교 규칙

  . instanceof 비교 시 항상 Timestamp (from 'firebase-admin/firestore') 사용.
  . admin.firestore.Timestamp 사용 금지.  
  . Firestore 모듈에서 직접 import 한 Timestamp 객체를 기준으로 비교해야 한다.
  . Timestamp 변환 로직은 다음 형태로 통일.

  ```ts
  import { Timestamp } from "firebase-admin/firestore";
  const dateObj = ev.date instanceof Timestamp ? ev.date.toDate() : ev.date;
  ```

- 잘못된 예시 (❌)

  ```ts
  const dateObj = ev.date instanceof admin.firestore.Timestamp
    ? ev.date.toDate()
    : ev.date;
  ```

  위 구문은 admin.firestore.Timestamp 가 undefined 인 경우 런타임 예외를 발생시킨다.

### 3.5 검증 체크리스트

| 항목                           | 기대 결과                                         |
| ---------------------------- | --------------------------------------------- |
| `npm run build`              | TypeScript 에러 없이 Functions 빌드 완료              |
| `firebase emulators:start`   | 각 함수 로컬 초기화 로그 확인                          |
| `npm run build`              | function build                                     |
| `npm run test:func <name>`   | function 직접 실행                          |
| `seedRoles.ts` 실행           | Auth/Firestore에 사용자 및 그룹 자동생성              |
| `copyPrevMonthMassEvents` 실행 | Firestore 내 전월 → 당월 데이터 복사                  |
| 브라우저 콘솔                   | `🔥 Auth/Firestore/Functions Emulator 연결됨` 출력 |

### Drawer UI 호출 방식

- 주의: Drawer UI 내부에서 getFunctions() 를 새로 호출하지 말것.
  getFunctions()는 새로운 Firebase app context를 만들기 때문.
  firebase.ts에서 export된 functions 인스턴스를 직접 `import { functions } from '@/lib/firebase'` 형태로 import해야함.

  ```ts
  import { httpsCallable } from "firebase/functions";
  import { functions } from "@/lib/firebase"; // ✅ 전역 인스턴스 재사용

  const handleCopy = async () => {
    const fn = httpsCallable(functions, "copyPrevMonthMassEvents");
    const res = await fn({ serverGroupId: "SG00001", currentMonth: "2025-10" });
    console.log(res.data);
  };
  ```

### 3.7 주요 function 들 로직 설명

#### 3.7.1 copyPrevMonthMassEvents

- 위치: functions/src/massEvents/copyPrevMonth.ts
- 목적: 전월의 확정된 미사 일정 패턴(첫번째 일요일이 있는 한주 요일별 7일치)을 기준으로, 현재 월 전체 일정을 자동으로 복사하는 기능.
- 조건: 전월 상태(month_status)가 MASS-CONFIRMED인 경우에만 수행 가능하다.
- trigger: 이 기능은 UI의 Drawer(전월 미사일정 복사) 에서 Cloud Function을 호출하여 실행됨.

---
