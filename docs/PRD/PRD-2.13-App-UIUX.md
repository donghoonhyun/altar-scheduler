# PRD-2.13-App-UIUX.md (App UI & UX Design System)

---

## 📌1. 문서 목적

- 이 문서는 **Altar Scheduler** 앱의 UI 및 UX 표준을 정의한다.  
- 본 시스템은 사용자 연령층(학생부터 신부님, 수녀님까지)을 고려하여 단순하면서도 따뜻한 시각적 경험을 제공하도록 설계되었다.
- 반응형 웹UI 시스템으로, 복사와 부모는 Mobile device UI 레이아웃을 기본으로 하며,
  달력 등 많은 정보를 표시해야하는 플래너 페이지는 브라우저 UI 를 기본으로 이용함.

---

## 📌2. Design Philosophy

| 키워드 | 설명 |
|--------|------|
| 🎨 **Simplicity** | 해야할 것만 보여주는 간결한 인터페이스 |
| 🌈 **Soft Tone** | 파스텔 통 중심의 따뜻한 색 구성 |
| 🤎 **Consistency** | 모든 화면에서 동일한 시각 요소 및 간격 시스템 유지 |
| 🕋 **Accessibility** | 연령·기기에 관계없이 쉽게 인식 가능한 구성 |

---

## 📌3. 기술 스택

| 분류 | 기술 |
|------|------|
| UI Framework | Tailwind CSS |
| UI Components | shadcn/ui, radix-ui |
| Icon Library | lucide-react |
| Date/Time | dayjs (with timezone) |
| Routing | React Router |
| Styling Standard | CSS Variables + Tailwind Utility Classes |

---

## 📌4. 폴더 구조

```ts
src/
 ├── components/
 │   ├── ui/
 │   │   ├── button.tsx
 │   │   ├── card.tsx
 │   │   ├── container.tsx
 │   │   ├── heading.tsx
 │   │   └── index.ts
 │   └── common/ 
 │       ├── ConfirmDialog.tsx     # 컴포넌트 + openConfirm() Promise 호출 함수를 통합한 단일 모듈
 │       └── LoadingSpinner.tsx    # 공통 스피너
 │       └── Logo.tsx
 ├── pages/
 │   └── components/
 │       ├── Forbidden.tsx
 │       ├── MassCalendar.tsx
 │       ├── MassEventDrawer.tsx
 │       └── Layout.tsx            # 상단바 구성, 안에 실페이지를 Outlet으로 렌더링함.
 └── styles/
     ├── theme.css
     └── index.css
```

- `components/ui` : 앱 전역에서 사용하는 디자인 단위 (Button, Card, Container 등)
- `pages/components` : 각 페이지 전용 UI + 비즈니스 로직

---

## 📌5. UI Layout 설계

### 🧩5.1 Laout 구성

- 홈 레이아웃은 다음 두 영역으로 구성된다.

  1) Header 영역 (공통 상단 바)
  2) Main 영역 (페이지 콘텐츠 영역)

- Header 영역은 항상 상단에 고정된다.
- 페이지별 콘텐츠는 Body 영역에서만 렌더링된다.
- 스크롤은 Body 영역에서만 발생한다.

```ts
  Layout.tsx
  ├── Header (공통 header 영역) 
  │     ├── 좌측 : 로고와 Home Icon
  │     ├── 가운데 : 현재 선택된 복사단 표시 및 변경 콤보  
  │     └── 우측 : Top Menu아이콘(사용자 메뉴 Drawer 호출)
  │           ├── 내정보 수정
  │           └── 로그아웃
  ├── Body (Outlet)
  │     ├── Dashboard.tsx (플래너)
  │     │     └── [성당명 + 플래너 이름] 표시
  │     └── ServerMain.tsx (복사)
  │           └── [성당명 + 복사 이름] 표시
  └── Footer (현재기준으로 계획없음, 예정)
```

#### 5.1.2 Header 구성

##### 5.1.2.1 Home Icon

- 항상 좌측 고정
- 클릭 시 사용자 역할에 따른 기본 홈으로 이동
  - Planner → Dashboard
  - Server → ServerMain

##### 5.1.2.2 성당/복사단 선택 Dropdown

- 현재 선택된 **성당/복사단(server_group)** 을 표시한다.
- 사용자가 접근 권한을 가진 복사단이 여러 개인 경우 dropdown으로 전환 가능하다.
- 선택된 값은 다음의 전역 기준으로 사용된다.
  - Firestore 데이터 조회 기준
  - Routing 기준
  - Dashboard / ServerMain 렌더링 기준

##### 5.1.2.3 Top Menu Drawer 정의

Top menu Drawer는 **계정 단위 공통 메뉴**를 제공한다.

- **표시 정보**

Drawer 상단에는 현재 로그인 사용자의 **역할(role)** 을 명시적으로 표시한다.
예: `* 역할: 플래너` , `* 역할: 복사`
> 역할 표시는 읽기 전용이며, UI 상에서 변경할 수 없다.

- **메뉴 항목**

```ts
  | 항목 | 설명 |
  |---|---|
  | 내정보 수정 | 사용자 프로필 수정 화면으로 이동 |
  | 로그아웃 | Firebase Auth 로그아웃 수행 |
```

#### 5.1.3 Body 구성

- Body 영역은 Layout 컴포넌트의 `<Outlet />` 영역에 해당한다.
- Dashboard, ServerMain 등 모든 페이지는  
  **공통 Layout을 재정의하지 않고 Body 영역에서만 렌더링**한다.

#### 5.1.4 Footer 구성

- 현재 기준으로 Footer는 구성되지 않음

### 🧩5.2 구조 고정 원칙 (필수)

다음 원칙은 향후 기능 확장 시에도 반드시 유지되어야 한다.

1. Header 영역 구조는 모든 로그인 이후 화면에서 동일하다.
2. Home Icon / 복사단 선택 Dropdown / Top Menu Icon의 위치는 변경하지 않는다.
3. 계정 관련 기능은 Top menu Drawer로만 제공한다.
4. 페이지별 기능 버튼은 Body 영역에만 배치한다.
5. 공통 Layout 구조 변경은 PRD 개정 없이는 허용되지 않는다.


### 🧩5.3 역할별 책임 분리

```ts
  | 구분            | 파일                        | 역할            | 표시 내용            | 데이터 소스                              |
  | -------------- | ------------------------- | ------------- | ---------------- | ----------------------------------- |
  | Layout.tsx     | 전역                        | App 공통 Shell  | 로그인 사용자, 로그아웃 버튼 | `useSession().user`                 |
  | ServerMain.tsx | Server 페이지                | 복사 개인화 헤더     | 성당명 + 복사명        | Firestore `server_groups/{id}` + 세션 |
  | Dashboard.tsx  | Planner 페이지               | 플래너 개인화 헤더    | 성당명 + 플래너명       | 동일                                  |
  | ServerAssignmentStatus.tsx | Planner 페이지 | 복사별 배정 현황 | '복사별 배정 현황' + 월 nav | Firestore Members + MassEvents |
  | 기타 페이지      | (예: Forbidden, Pending 등) | 공통 Layout만 사용 | 없음               | -                                   |
```

---

## 📌6. 컬러와 폰트

### 🧩6.1 컬러 팔레트

| 역할 | 변수명 | 코드 | 의미 |
|------|---------|------|------|
| Primary | `--color-primary` | `#3B82F6` | 하늘빛 파랑 — 평화, 희망 (플래너 테마) |
| Secondary | `--color-secondary` | `#FDE68A` | 밝은 노랑 — 빛, 긍정함 |
| Accent | `--color-accent` | `#F472B6` | 부드러운 핑크 — 공동체 |
| Success | `--color-success` | `#10B981` | 에메랄드 녹색 — 생명, 활동 (복사 테마) |
| Admin | `--color-admin` | `#8B5CF6` | 보라색 — 권위, 관리 (슈퍼어드민 테마) |
| Warning | `--color-warning` | `#F97316` | 주의 / 확인 |
| Error | `--color-error` | `#EF4444` | 오류 / 가입 거부 |
| Background | `--color-bg-base` | `#F8FAFC` | 레이아웃 공통 배경 (blue-50) |

### 🧩6.2 역할별 테마 및 배경 그라데이션
각 주체별 페이지는 고유한 컬러 테마를 가지며, 상단 레이아웃과 자연스럽게 이어지는 수직 그라데이션을 적용한다.

1. **공통 레이아웃**: `bg-blue-50` 배경을 기본으로 함.
2. **슈퍼어드민 (Super Admin)**: 보라색 계열 (`from-purple-200 to-purple-50`)
3. **플래너 대시보드 (Planner)**: 파란색 계열 (`from-blue-50 to-blue-200`) - 상단바 경계선 제거를 위해 `blue-50`에서 시작.
4. **복사 메인 (Server)**: 에메랄드 계열 (`from-blue-50 to-emerald-200`) - 상단바 경계선 제거를 위해 `blue-50`에서 시작.


### 🧩6.2 폰트 시스템

```css
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;700&display=swap');

  :root {
    --font-main: 'Nunito', 'Noto Sans KR', sans-serif;
  }
```

- **Nunito** : 영어/숫자용 (따뜻하고 도넛댄김)
- **Noto Sans KR** : 한글용 (명려하고 건질한 형태)

---

## 📌7. Global Style Files

### 🧩7.1 theme.css

```css
:root {
  --color-primary: #3b82f6;
  --color-secondary: #fde68a;
  --color-accent: #f472b6;
  --color-success: #22c55e;
  --color-warning: #f97316;
  --color-error: #ef4444;
  --color-bg-light: #f9fafb;
  --color-bg-dark: #111827;
  --font-main: 'Nunito', 'Noto Sans KR', sans-serif;
}

body {
  font-family: var(--font-main);
  background-color: var(--color-bg-light);
  transition: background-color 0.3s, color 0.3s;
}

.dark body {
  background-color: var(--color-bg-dark);
  color: #f3f4f6;
}
```

### 🧩7.2 index.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import "./theme.css";

.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 📌8. UI 컴포넌트 (Design System v1)

### 🧩8.1 Button

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95";
  const variants = {
    primary: "bg-blue-500 hover:bg-blue-600 text-white shadow-md focus:ring-blue-300",
    secondary: "bg-yellow-300 hover:bg-yellow-400 text-gray-800",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-100",
    ghost: "text-gray-600 hover:bg-gray-200",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
};
```

#### 🧩8.1.1 Button Variant Usage Guide

| Variant | 역할 | 사용 예시 | 색상 |
|---------|------|-----------|------|
| **primary** | 주요 액션 (Main Action) | 저장, 제출, 일정 계획, 확인(Dialog) | `bg-blue-500` (파랑) |
| **secondary** | 강조 액션 (Accent Action) | 새로운 흐름으로 이동, 특수 기능 진입 (예: 복사배정현황) | `bg-yellow-300` (노랑) |
| **outline** | 보조 액션 (Auxiliary Action) | 취소, 뒤로가기, 기준정보 설정(Presets) | `border-gray-300` (회색 테두리) |
| **ghost** | 아이콘 버튼, 약한 강조 | 닫기(X), 새로고침, 단순 토글 | 투명 (hover시 회색) |

### 🧩8.2 Card

```tsx
import React from "react";
import { cn } from "@/lib/utils";

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      "bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transition-all duration-300 hover:shadow-xl",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
```

### 🧩8.3 Container

```tsx
import React from "react";
import { cn } from "@/lib/utils";

export const Container: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn("max-w-5xl mx-auto px-4 sm:px-6 lg:px-8", className)} {...props}>
    {children}
  </div>
);
```

### 🧩8.4 Heading

```tsx
import React from "react";
import { cn } from "@/lib/utils";

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  size?: "sm" | "md" | "lg";
}

export const Heading: React.FC<HeadingProps> = ({
  size = "md",
  className,
  children,
  ...props
}) => {
  const sizes = {
    sm: "text-lg font-semibold",
    md: "text-2xl font-bold",
    lg: "text-3xl font-extrabold",
  };
  return (
    <h2 className={cn(sizes[size], "text-gray-800 dark:text-gray-100", className)} {...props}>
      {children}
    </h2>
  );
};
```

---

### 🧩8.5 InfoBox

```tsx
import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoBoxProps {
  title?: string;
  children: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}

export const InfoBox: React.FC<InfoBoxProps> = ({ 
  title, 
  children, 
  icon: Icon = Info, 
  className 
}) => {
  return (
    <div className={cn("bg-amber-50 p-4 rounded-xl border border-amber-200 flex gap-3", className)}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-amber-500 flex-shrink-0">
        <Icon size={18} />
      </div>
      <div>
        {title && <h4 className="font-bold text-gray-800 mb-0.5 text-xs">{title}</h4>}
        <div className="text-[11px] text-gray-600 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
};
```

### 🧩8.6 Status & Badge Design System (미사일정 상태 시각 규칙)

- 목적:
본 시스템은 미사일정(mass_events) 및 관련 데이터의 상태(status)를
UI 상에서 일관되고 직관적으로 표현하기 위한 시각 언어 체계(Status Visual Language) 를 정의한다.

#### 8.5.1 상태별 컬러 팔레트 (Status Colors)

| 상태 코드 | 의미 | 주요 배경색 (Light) | 주요 배경색 (Dark) | 설명 | 텍스트 컬러 (Light/Dark) | 사용 화면 |
|---|---|---|---|---|---|---|

- MASS-NOTCONFIRMED : 미확정 (초안, 편집 가능) | #F9FAFB (bg-gray-50) | `dark:bg-slate-700/50` | 회색톤으로 비활성화 느낌 | #6B7280 (`dark:text-gray-400`) | Dashboard, Planner
- MASS-CONFIRMED : 미사 일정 확정 (설문 전 단계) | #DBEAFE (bg-blue-100) | `dark:bg-blue-900/30` | 기본 확정된 일정의 기준색 | #1E3A8A (`dark:text-blue-300`) | Dashboard, Planner
- SURVEY-CONFIRMED : 설문 응답 마감 (수정 불가) | #FEF3C7 (bg-amber-50) | `dark:bg-amber-900/30` | 주의 강조 (노랑) | #92400E (`dark:text-amber-300`) | Dashboard, Planner
- FINAL-CONFIRMED : 최종 확정 완료 (완전 잠금) | #D1FAE5 (bg-green-50) | `dark:bg-green-900/30` | 확정 완료 (안정, 신뢰) | #065F46 (`dark:text-green-300`) | Dashboard, Planner

🎨 색상 기준:
Tailwind 기반 파스텔톤 컬러 시스템
Blue: #DBEAFE
Amber: #FEF3C7
Green: #D1FAE5
Gray: #F9FAFB

#### 8.5.2 상태별 아이콘 규칙 (Status Icons)

상태 코드 아이콘 아이콘 색상 의미 Tooltip
MASS-NOTCONFIRMED ❌ 없음 없음 미확정 상태 없음
MASS-CONFIRMED 🔒 (Lock) #9CA3AF (회색) 확정됨 (편집 일부 제한) “확정됨”
SURVEY-CONFIRMED 🗳️ (Lock) #F59E0B (노랑) 설문 마감됨 “설문 마감됨”
FINAL-CONFIRMED 🛡️ (Lock) #10B981 (초록) 최종 확정 완료 “최종 확정됨”

📍 구현 기준
아이콘: lucide-react → Lock
크기: 12px
위치: title 오른쪽
Tooltip: HTML 기본 title 속성 사용

#### 8.5.3 상태별 뷰어 UX 규칙

조건 동작
MASS-NOTCONFIRMED Planner가 수정 가능, Server는 보기 전용
MASS-CONFIRMED Planner는 일정 일부 변경 가능, Server는 보기 전용
SURVEY-CONFIRMED Planner/Server 모두 읽기 전용
FINAL-CONFIRMED Planner/Server 모두 읽기 전용 (확정완료)
배정 없음 카드 비활성(opacity-60) 처리, 클릭 불가
오늘 날짜 bg-blue-100, border-blue-300, shadow-inner

#### 8.5.4 본인 복사명 표시 규칙 (Highlight Logic)

구분 스타일
일반 복사명 bg-gray-100 text-gray-700 rounded-md px-1.5 py-0.5
본인 복사명 (highlightServerName) bg-blue-100 text-blue-700 font-semibold

#### 8.5.5 적용 예시 (MassCalendar 컴포넌트)

```ts
{ev.status === "FINAL-CONFIRMED" && (
  <Lock size={12} className="text-green-500" title="최종 확정됨" />
)}
{ev.status === "SURVEY-CONFIRMED" && (
  <Lock size={12} className="text-amber-500" title="설문 마감됨" />
)}
{ev.status === "MASS-CONFIRMED" && (
  <Lock size={12} className="text-gray-400" title="확정됨" />
)}
```

#### 8.5.6 Mass Event Status Badge Component

- 위치 : /src/components/ui/StatusBadge.tsx
- 예시 : `<StatusBadge status="FINAL-CONFIRMED" />`
- 내부적으로 상태 색상, 아이콘, tooltip, 텍스트 일괄 매핑
- MassCalendar, MassEventDrawer, ServerStats 등 모든 화면에서 공통 사용

#### 8.5.7 toolbar Button Color Guide

- MassEventPlanner / MonthStatusDrawer / MassEventDrawer 내 상단 Toolbar 등에 배치시 가이드
- 버튼 스타일 원칙 (활성/비활성 두가지로만 구분)
  . 모든 Toolbar 버튼은 `variant="outline"`, `size="sm"`, `h-7 text-[12px] px-2 py-1` 규격을 사용한다.
  
  ```ts
  | 단계 | 버튼명 | 색상 그룹 | 테두리색 | 텍스트색 | Hover 시 | 설명 |
  |------|----------|-------------|------------|------------|-----------|----------|
  | ① 확정 준비 단계 | 미사일정 Preset / 미사일정 확정 | 🔵 Blue | `border-blue-400` | `text-blue-700` | `hover:bg-blue-50 hover:border-blue-500 hover:text-blue-800` | 미사 일정 생성 및 확정 준비 |
  | ② 설문 단계 | 설문 링크 보내기 / 설문 종료 | 🟠 Amber | `border-amber-500` | `text-amber-700` | `hover:bg-amber-50 hover:border-amber-600 hover:text-amber-800` | 설문 진행 및 마감 단계 |
  | ③ 최종 확정 단계 | 자동 배정 (최종 확정) | 🔴 Red | `border-red-500` | `text-red-700` | `hover:bg-red-50 hover:border-red-600 hover:text-red-800` | 자동배정 및 확정 완료 |
  | ⚙️ 관리 기능 | 월 상태변경 | ⚪ Gray | `border-gray-400` | `text-gray-700` | `hover:bg-gray-50 hover:border-gray-500 hover:text-gray-800` | 설정 / 상태 관리 기능 |
  ```
  
- 시각 정책

  . **활성 버튼:** 파란색 테두리 및 텍스트, hover 시 옅은 파란 배경 강조  
  . **비활성 버튼:** 연회색 배경 및 흐린 텍스트, hover 효과 없음  
  . **목적:** 기능별 색상 대신, “현재 조작 가능 여부”만으로 상태를 명확히 구분  

- 예시 코드 (React / Tailwind)

  ```tsx
  <Button
    variant="outline"
    size="sm"
    className={cn(
      'h-7 text-[12px] px-2 py-1',
      'border border-blue-400 text-blue-700',
      'hover:bg-blue-50 hover:border-blue-500 hover:text-blue-800',
      'disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed'
    )}
    disabled={isDisabled}
  >
    <Copy className="w-3.5 h-3.5 mr-1" /> 전월 미사일정 복사
  </Button>
  ```

#### 8.5.8 Drawer & Dialog UI 표준 구조

- 개요:
  모든 **Dialog / Drawer 컴포넌트의 상단 헤더 영역**은 일관된 여백 구조와 구분선을 사용한다.  
  사용자는 다이얼로그가 열렸을 때, 제목–설명–본문의 시각적 구분을 명확히 인식할 수 있어야 한다.

- 구성요소

  ```ts
  | 구역 | 구성 | 설명 |
  |------|------|------|
  | Header | `DialogTitle`, `DialogDescription` | 타이틀 + 간단한 안내문 |
  | Body | 자유 구성 (Form, Text, Status 등) | 핵심 인터랙션 또는 설명 |
  | Footer | 버튼 영역 | 항상 우측 정렬 `[취소] [확인]` |
  ```

  ```ts
  | 구분 | 규칙 | Tailwind Class | 비고 |
  |------|------|----------------|------|
  | Title 하단 여백 | 제목 아래 최소 0.5rem 간격 | `mb-2` | Title과 Description 간 간격 확보 |
  | Description 하단 여백 | 설명문 아래 구분선 전 최소 0.75rem 간격 | `mb-3` | 시각적 그룹 완성 |
  | Header와 Body 구분선 | 밝은 회색 라인으로 시각 분리 | `<div class="border-b border-gray-200 dark:border-gray-700 my-3" />` | 모든 Drawer/Dialog 공통 적용 |
  | Body 시작 여백 | Title 구분선 이후 `mt-3` 적용 | `mt-3` | 콘텐츠와 헤더의 공간 확보 |
  | 색상 규칙 | 밝은 테마 → `border-gray-200`, 다크 테마 → `border-gray-700` |  | UI 통일성 유지 |
  ```

- 스타일 가이드

  ```ts
  | 요소 | Tailwind Class | 설명 |
  |------|----------------|------|
  | Title | `flex items-center gap-2 text-lg font-semibold` | 아이콘+제목 일렬 배치 |
  | Description | `text-sm text-gray-600 mb-4` | 기능 요약 설명 |
  | Body | `mt-4 text-sm text-gray-700 dark:text-gray-300 space-y-2` | 내용 간격 정리 |
  | Footer | `flex justify-end gap-2 mt-6` | 버튼 배치 규칙 |
  | Primary Button | `variant="primary"` | 파란색 계열 기본 버튼 |
  | Cancel Button | `variant="outline"` | 회색 테두리 버튼 |
  ```

- 코드 예시:

  ```tsx
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="max-w-md p-6">
      {/* Header */}
      <DialogTitle className="flex items-center gap-2 text-lg font-semibold mb-2">
        <Clipboard size={20} className="text-blue-600" />
        미사일정 Preset
        <span className="text-gray-500 text-base ml-1">
          ({currentMonth.format('YYYY년 M월')})
        </span>
      </DialogTitle>

      <DialogDescription className="text-sm text-gray-600 mb-3">
        전월(<b>{prevMonth.format('YYYY년 M월')}</b>)의 미사 일정을 현재 월(
        <b>{currentMonth.format('M월')}</b>)로 복사합니다.
      </DialogDescription>

      {/* ✅ 구분선 */}
      <div className="border-b border-gray-200 dark:border-gray-700 my-3" />

      {/* Body */}
      <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 space-y-2">
        <p>⚠️ 현재 월의 모든 미사 일정은 삭제된 후 전월 일정으로 교체됩니다.</p>
        <p>복사 완료 후 캘린더가 자동으로 새로고침됩니다.</p>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={onClose}>취소</Button>
        <Button variant="primary" onClick={handleCopy}>
          복사 시작
        </Button>
      </div>
    </DialogContent>
  </Dialog>
  ```

---

## 🧩8.7 Components 재사용 정책

- 경로 기준
  . 전역(공용) UI 컴포넌트 : src/components/
  . 특정 페이지 전용 UI 조각 : src/pages/components/
- MassEventMiniDrawer.tsx : 복사용 모바일 Drawer

---

## 📌9. Forbidden Page 예시

```tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { Button, Card, Heading, Container } from "@/components/ui";

const Forbidden: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Container className="flex justify-center items-center min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-900">
      <Card className="text-center max-w-md w-full fade-in">
        <div className="text-6xl mb-4">🚫</div>
        <Heading size="md" className="mb-2">접근이 제한되었습니다</Heading>
        <p className="text-gray-600 dark:text-gray-400 mb-8">이 페이지에 접근할 권한이 없습니다.</p>
        <Button onClick={() => navigate("/")} className="mx-auto flex items-center gap-2">
          <Home size={20} /> 홈으로 돌아가기
        </Button>
      </Card>
    </Container>
  );
};

export default Forbidden;
```

---

## 📌10. Dialog 대화창 처리

- 공통 common/ConfirmDialog

```ts
| 항목            | 내용                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| **컴포넌트 명**    | `ConfirmDialog.tsx`                                                                    |
| **구조**        | 컴포넌트 + `openConfirm()` Promise 호출 함수를 통합한 단일 모듈                               |
| **모션 효과**     | Fade-in/out, Scale-in/out취소 시 shake 애니메이션닫힘 전 약간의 delay(300~500 ms)로 자연스러운 UX 구현 |
| **호출 방식**     | `ts const ok = await openConfirm({ title, message, confirmText, cancelText });`                                              |
| **기존 코드 호환성** | `src/lib/openConfirm.tsx`에 alias export 한 줄 유지:  <br>`export { openConfirm } from "@/components/common/ConfirmDialog";`      |
| **UX 가이드**    | 모달은 화면 중앙, dark-backdrop + blur 효과모바일에서도 화면 중앙 고정, 세로 비율 80% 이내 유지버튼 색상: 파란색(확인), 회색(취소) |
```

```

---

## 📌11. Dark Mode Implementation Guidelines (v1.5)

다크 모드는 `slate` 계열의 색상 팔레트를 기반으로 하며, 눈의 피로를 최소화하고 정보의 가독성을 유지하는 것을 목표로 한다.

### 🧩11.1 기본 색상 팔레트 (Slate Palette)

| 요소 | Light Mode | Dark Mode | 비고 |
|------|------------|-----------|------|
| **Page Background** | `bg-white` / `bg-gray-50` | `dark:bg-slate-950` | 전체 페이지 배경 |
| **Container Background** | `bg-white` | `dark:bg-transparent` | 내부 컨테이너 배경 (페이지 배경과 조화) |
| **Card Background** | `bg-white` | `dark:bg-slate-900` | 카드, 다이얼로그, 서랍 등 콘텐츠 영역 |
| **Card Border** | `border-gray-200` | `dark:border-slate-800` | 카드의 경계선 |
| **Table Header** | `bg-gray-50` | `dark:bg-slate-800` | 테이블 헤더 배경 |
| **Row Hover** | `hover:bg-gray-50` | `dark:hover:bg-slate-800/50` | 리스트/테이블 행 마우스 오버 시 |
| **Primary Text** | `text-gray-900` | `dark:text-gray-100` | 주요 제목, 본문 텍스트 |
| **Secondary Text** | `text-gray-500` | `dark:text-gray-400` | 설명, 부가 정보 텍스트 |
| **Muted Text** | `text-gray-400` | `dark:text-slate-500` | 비활성, 아주 약한 정보 |

### 🧩11.2 UI 컴포넌트별 적용 규칙

#### 11.2.1 Cards & Containers
- `dark:bg-slate-900`: 기본 카드 배경. 너무 검지 않은 깊은 남색 계열 회색 사용.
- `dark:border-slate-800` 또는 `dark:border-slate-700`: 테두리는 배경보다 한 단계 밝게 설정하여 은은한 구분을 줌.
- **예외**: `MemberRoleManagement` 등의 리스트 아이템 카드는 `dark:bg-slate-800`을 사용하여 페이지 배경(`slate-900`)과 구분.

#### 11.2.2 Inputs & Forms
- **Input/Select**: `dark:bg-slate-800`, `dark:border-slate-700`, `dark:text-white`.
- **Placeholder**: 시스템 기본값 또는 `dark:placeholder-gray-500`.
- **Focus Ring**: `dark:ring-blue-900` (기존 Blue 링보다 어둡게).

#### 11.2.3 Badges & Status Indicators
- **원칙**: 다크 모드에서는 파스텔 톤 배경색(`bg-blue-100` 등)이 너무 밝게 빛나 눈이 부실 수 있으므로, **투명도(Opacity)**를 활용한다.
- **Pattern**: `dark:bg-{colors}-900/20` (배경), `dark:text-{colors}-300` (텍스트), `dark:border-{colors}-900/50` (테두리).
  - 예: `bg-blue-100 text-blue-700` → `dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50`

#### 11.2.4 Modals, Drawers & Dialogs
- **Overlay**: `dark:bg-black/80` + `backdrop-blur-sm` (배경 흐림 효과).
- **Content**: `dark:bg-slate-900`, `dark:border-slate-800`.
- **Header/Foote Separator**: `dark:border-slate-800`.

#### 11.2.5 Special Sections (Dashboard Calendar)
- **Day Cells**: 평일 `dark:bg-gray-800`, 토요일 `dark:bg-sky-900/20`, 일요일 `dark:bg-pink-900/20`.
- **Event Cards**: 날짜 셀과 구분되도록 조금 더 밝거나 다른 톤 사용 (`dark:bg-slate-700`).

---

## 📌12. 규칙 요약

| 항목 | 규칙 |
|------|------|
| UI 경로 | `@/components/ui` |
| 페이지 전용 컴포넌트 | `src/pages/components/` |
| 기본 폰트 | Nunito + Noto Sans KR |
| 기본 모서리 | `rounded-2xl` |
| 기본 그림자 | `shadow-lg` |
| 애니메이션 | `fade-in` |
| 다크 모드 | Tailwind `.dark` 클래스 사용 |
| 공용 import | `main.tsx` 에서 `import "@/styles/index.css";` |

---

## 📌확장 계획 (v2 Preview)

- `Input`, `Modal`, `Dropdown`, `Tooltip`, `Alert` 등 추가 예정  
- `ThemeToggle` (라이트/다크 전환) 도입 (완료 - 시스템 설정 연동 또는 수동 토글 지원)
- 경북산 성당 로고 기반 Color Accent 그룹 지원

---
