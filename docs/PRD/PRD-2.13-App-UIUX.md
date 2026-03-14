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
| --------- | ------|
| 🎨 **Simplicity** | 해야할 것만 보여주는 간결한 인터페이스 |
| 🌈 **Soft Tone** | 파스텔 통 중심의 따뜻한 색 구성 |
| 🤎 **Consistency** | 모든 화면에서 동일한 시각 요소 및 간격 시스템 유지 |
| 🕋 **Accessibility** | 연령·기기에 관계없이 쉽게 인식 가능한 구성 |

---

## 📌3. 기술 스택

| 분류 | 기술 |
| ------|------|
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

- **트리거 아이콘**

  기존 세 줄 햄버거 아이콘 대신 **원형 프로필 아이콘**을 사용한다.
  - `photo_url`이 있으면 프로필 이미지를 원형으로 표시.
  - 없으면 세례명 또는 이름의 첫 글자를 보라색 원형 배경에 표시.

- **Drawer 헤더**

  `DrawerHeader` 표준 컴포넌트를 사용하며, `children`으로 다음을 렌더링한다.
  - 좌측: 이름(한국이름 + 세례명), 이메일
  - 우측: 다크/라이트 토글 스위치 (Ordo와 동일한 스타일)

- **메뉴 항목**

```ts
  | 항목 | 설명 |
  |---|---|
  | 신규 복사 신청 | 복사단 가입 요청 화면으로 이동 |
  | 내정보 수정 | 사용자 프로필 수정 화면으로 이동 |
  | 앱 설정 | 앱 설정 화면으로 이동 |
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
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css');
  @import url('https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap');

  :root {
    --font-main: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
  }
```

- **Pretendard (font-sans)** : 기본 앱 전역 요소, 모든 UI 카드 텍스트, Label 맻 Button (모던하고 꺠끗한 룩앤필 제공). Ordo 생태계 표준 서체.
- **Gamja Flower (font-gamja)** : 헤더의 타이틀 및 강조(친근한/따뜻한 느낌의 핸드라이팅체). 주요 페이지 상단 배너 등에 국한적으로 사용.

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

### 🧩8.2 Card & Form 구조 시스템 (Ordo Standard)

모든 데이터 입력 폼 및 정보 표시 카드는 "Ordo Profile"의 시각적 기준을 완벽히 따른다.
핵심은 **1픽셀 오차 없는 간격/선 배치** 와 **통일된 서체(Pretendard)** 이다.

- **Card Container** :
  - 기본 제공되는 패딩을 무효화하기 위해 필히 `p-0` 를 부여한다.
  - `<Card className="... p-0">`

- **Card Header (Title & Divider)** :
  - 카드 타이틀은 `text-base font-bold font-sans` 로 사용한다.
  - 헤더 영역 하단 가로줄이 카드 테두리(좌/우)에 100% 밀착되도록 헤더 컨테이너에 패딩과 경계선을 설정한다.
  - `<div className="p-6 pb-3 border-b border-slate-100 dark:border-slate-700 mb-4 flex items-center gap-2">`

- **Card Body** :
  - 본문 컨테이너에 `p-6 pt-0 space-y-4` 를 주어 위쪽 타이틀과 적당한 간격을 두고 배치한다.
  - Label: `text-sm font-medium text-slate-600 dark:text-slate-400 font-sans`
  - Input/Select: `h-10 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all font-sans`
  - Field 그룹 간 간격은 `space-y-2` 로 설정하여 촘촘하고 단단한 밀도를 형성한다.

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
      "bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-all duration-300",
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

### 🧩8.3.1 표준 등록 버튼 (Submit Action)

Form 하단의 단일 등록/저장 버튼은 컴포넌트 커스텀을 남발하지 않고, Shadcn(or Ordo) 기본형으로 구성한다.

- `<Button className="w-full font-bold h-12 text-base shadow-sm">등록하기</Button>`

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

#### 8.5.7 툴바버튼 (toolbar Button) 표준화

> ⚠️ **[2026-02-22 업데이트]** 기존 `variant="outline" + size="sm" + 개별 className`으로 툴바 크기를 명시하던 방식을 **`variant="toolbar"` 단일 표준**으로 교체하였다.

##### 개요

- **명칭**: **툴바버튼** (`toolbar` variant)
- **적용 위치**: MassEventPlanner / MonthStatusDrawer / MassEventDrawer 내 상단 툴바 등 밀집된 버튼 영역
- **파일 위치**: `src/components/ui/button.tsx` — `variants.toolbar` 항목

##### 툴바버튼 기본 규격

`variant="toolbar"` 만 지정하면 아래 스타일이 자동 적용된다.  
`size` prop은 toolbar variant에서 **무시**된다 (variant 내부에 크기가 내장되어 있으므로).

| 속성 | 값 | 비고 |
|------|----|------|
| 높이 | `h-7` (28px) | size prop과 무관하게 고정 |
| 가로 패딩 | `px-2` | |
| 세로 패딩 | `py-1` | |
| 폰트 크기 | `text-[12px]` | |
| 폰트 굵기 | `font-semibold` | |
| 모서리 | `rounded-xl` | 일반 버튼과 동일한 표준 곡률 |
| 기본 배경 | `bg-transparent` | 테두리형 |
| 그림자 | `shadow-none` | |

##### 색상 그룹 가이드

각 버튼의 **기능 단계별 색상**은 `className`으로 추가 지정한다.

```ts
| 단계 | 버튼명 | 색상 그룹 | 테두리색 | 텍스트색 | Hover 시 |
|------|----------|-------------|------------|------------|-----------|
| ① 확정 준비 단계 | Preset초기화 / 미사일정확정 | 🔵 Blue | `border-blue-400` | `text-blue-700` | `hover:bg-blue-50 hover:border-blue-500 hover:text-blue-800` |
| ② 설문 단계 | 설문발송(보기) / 설문종료 | 🟠 Amber | `border-amber-500` | `text-amber-700` | `hover:bg-amber-50 hover:border-amber-600 hover:text-amber-800` |
| ③ 최종 확정 단계 | 자동배정 / 최종확정 | 🔴 Red | `border-red-500` | `text-red-700` | `hover:bg-red-50 hover:border-red-600 hover:text-red-800` |
| ⚙️ 관리 기능 | 월상태변경 / 미사백업 | ⚪ Gray | `border-gray-400` | `text-gray-700` | `hover:bg-gray-50 hover:border-gray-500 hover:text-gray-800` |
```

##### 사용 방법 (표준)

```tsx
// ✅ 표준: variant="toolbar" 만 지정, size prop 불필요
<Button
  variant="toolbar"
  className={cn(
    'border-blue-400 text-blue-700',
    'hover:bg-blue-50 hover:border-blue-500 hover:text-blue-800',
    'dark:text-blue-300 dark:border-blue-500 dark:hover:bg-blue-900/30'
  )}
  disabled={isDisabled}
  onClick={handleClick}
>
  <Copy className="w-3.5 h-3.5 mr-1" /> Preset초기화
</Button>

// ❌ 구버전 (사용 금지): outline + size + 개별 className으로 크기 명시
<Button
  variant="outline"
  size="sm"
  className="h-7 text-[12px] px-2 py-1 border-blue-400 ..."
>
  ...
</Button>
```

##### 시각 정책

- **활성 버튼**: 단계별 색상 테두리 및 텍스트, hover 시 옅은 배경 강조
- **비활성 버튼**: `disabled` prop으로 자동 처리됨 (`opacity-50`, `pointer-events-none`)
- **목적**: "현재 조작 가능 여부"를 `disabled` 하나로 단순하게 표현

#### 8.5.8 단위기능버튼 (unit Button) 표준화

> ⚠️ **[2026-02-22 업데이트]** 드로어 내부 등에서 사용되는 소형 기능 버튼들을 **`variant="unit"`**으로 표준화하였다.

##### 개요

- **명칭**: **단위기능버튼** (`unit` variant)
- **적용 위치**: 드로어 전용 헤더 옆, 리스트 상단 기능 버튼, 알림 발송 등 특정 동작 실행 영역
- **파일 위치**: `src/components/ui/button.tsx` — `variants.unit` 항목

##### 단위기능버튼 규격

- `toolbar`와 마찬가지로 **내장 크기**를 가진다.
- **스타일**: `border` 기반의 흰색 배경 (hover 시 옅은 회색).
- **크기**: `h-7 px-2.5 text-[11px]` — 일반 `size="sm"` 보다 작아 공간 효율이 높음.
- **모서리**: `rounded-xl` — 일관된 "Premium" 디자인 룩앤필 제공.

##### 사용 방법

```tsx
// ✅ 표준: variant="unit" 지정
<Button 
    variant="unit" 
    onClick={handleAction}
>
    대상자 수정
</Button>

// ✅ 로딩 상태 포함 예시
<Button variant="unit" disabled={isLoading} onClick={sendNoti}>
    {isLoading ? '발송 중...' : '📣 알림 발송'}
</Button>
```

#### 8.5.9 프리미엄 헤더 및 드로어 표준 (DrawerHeader & Container)

> ⚠️ **[2026-02-22 업데이트]** 서비스 전반의 프리미엄 룩앤필을 위해 페이지 헤더(`PremiumHeader`), 드로어 헤더(`DrawerHeader`), 그리고 드로어 컨테이너의 외형을 표준화하였다.

##### 1. 헤더 표준 규격 (Page & Drawer)

모든 페이지 상단과 드로어 상단에는 일관된 볼륨감과 타이포그래피를 적용한다.

| 구분 | 표준 컴포넌트 | 높이 | 타이틀 폰트 | 비고 |
|------|------------|------|------------|------|
| **페이지 헤더** | `PremiumHeader` | `h-20` (80px) | `font-gamja` (2xl) | 서브타이틀 포함 가능 |
| **드로어 헤더** | `DrawerHeader` | `h-20` (80px) | `font-gamja` (xl) | 다크 그라데이션 및 닫기 버튼 내장 |

- **폰트 정책**: 감성적이고 부드러운 인상을 위해 타이틀 및 서브타이틀에는 `font-gamja`를 사용한다.
- **공간 정책**: 헤더 높이를 `h-20`으로 통일하여 시각적 안정감을 확보한다.

##### 2. 드로어 컨테이너 표준

드로어가 우측에서 나타날 때, 본체와의 시각적 구분을 위해 강력한 곡률과 그림자를 적용한다.

- **모서리 곡률**: 드로어 왼쪽 상단/하단 모서리에 **`rounded-l-[2rem]` (32px)**을 적용한다. (Premium UI 상징)
- **닫기 버튼 중복 방지**: `DrawerHeader`를 사용하는 경우, `DialogContent`에 **`hideClose`** prop을 전달하여 라이브러리 기본 X 버튼을 숨긴다.

##### 3. 표준 코드 예시

```tsx
// ✅ 드로어 표준 구현
<Dialog open={open} onOpenChange={onClose}>
  <DialogContent hideClose className="max-w-md w-full h-full p-0 flex flex-col rounded-l-[2rem]">
    {/* 표준 헤더 */}
    <DrawerHeader 
      title="📩 설문 관리" 
      subtitle="설문 현황 및 알림 발송을 관리합니다." 
      onClose={onClose} 
    />
    
    {/* 본문 (Scrollable Body) */}
    <div className="flex-1 overflow-y-auto p-6">
       ...
    </div>
  </DialogContent>
</Dialog>
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

#### 8.5.9 Premium Header & Drawer Header UI (표준화)

- 개요:
  페이지 상단 타이틀 또는 중요한 정보 표기가 필요한 **Dialog / Drawer**에는 브랜드 아이덴티티를 강조하는 **PremiumHeader**와 **DrawerHeader** 컴포넌트를 적용한다.
  이 컴포넌트들은 배경 오너먼트(blur 장식)와 부드러운 그라데이션, 다크 모드 호환성을 갖추어 현대적이고 고급스러운 느낌을 제공한다.

- 컴포넌트 정책

  1. **PremiumHeader** (`src/components/common/PremiumHeader.tsx`)
     - 용도: 대시보드 등 첫 번째 메인 페이지에서 넘어간 **2레벨 페이지**의 상단 헤더 표시에 사용. (예: `SuperAdmin` 하위 기능 페이지, 관리자 상세 관리 페이지, 미사일정 관리 페이지, 복사단원관리, 복사배정현황, Preset설정, 설문관리 등)
     - 높이: `h-20` (80px)
     - 스타일: 파란색 테마 (`bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#3B82F6] dark:from-blue-900 dark:via-blue-950 dark:to-slate-900`) <- 다크모드도 감안해야함
     - 모서리: 하단 둥글게 (`rounded-b-[32px]`)
     - 폰트: Gamja Flower (타이틀 적용)
     - 특징: 좌측 뒤로가기 버튼 지원 (`onBack`, `backUrl` prop)

  2. **DrawerHeader** (`src/components/common/DrawerHeader.tsx`)
     - 용도: 특수한 사용자 입력을 받거나 내용을 변경해야 하는 **Drawer (Sheet 컴포넌트)** 영역 내부에만 적용 목적.
     - 높이: `h-24` (96px)
     - 스타일: 슬레이트 테마 (`bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950`)
     - 폰트 타이틀 컬러: 흰색 고정 (`text-white`)
     - 특징: 우측 닫기(X) 버튼 내장 (`onClose` prop). `children` prop을 사용해 커스텀 렌더링(예: 수정 인풋 폼 등) 가능.

- 코드 예시 (PremiumHeader):

  ```tsx
  import PremiumHeader from '@/components/common/PremiumHeader';

  <div className="mb-6 -mx-6 -mt-6">
    <PremiumHeader 
      title="성당/복사단 관리"
      subtitle="마스터 데이터를 관리하는"
      icon={<Shield size={20} />}
      backUrl="/superadmin"
    />
  </div>
  ```

- 코드 예시 (DrawerHeader):

  ```tsx
  import DrawerHeader from '@/components/common/DrawerHeader';

  <DialogContent className="p-0 overflow-hidden border-0 shadow-2xl [&&>button]:hidden">
    <DrawerHeader 
      title="주요 제목"
      subtitle="서브 타이틀 설명"
      onClose={() => setOpen(false)}
    />
    
    {/* Body 영역 */}
    <div className="p-6">
      ... 콘텐츠 ...
    </div>
  </DialogContent>
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

## 📌13. 다크모드 테마 동기화 (Ordo 생태계 표준)

### 🧩13.1 테마 상속 원칙

- Altar Scheduler는 **Ordo의 다크/라이트 테마를 URL 파라미터로 승계**받습니다.
- Ordo AppViewer에서 자식 앱을 열 때 `?theme=dark|light|system`을 URL에 포함하여 전달합니다.
- 자식 앱은 `main.tsx` 최상단(ThemeProvider 마운트 이전)에서 이 파라미터를 읽어 `altar-ui-theme` localStorage 키에 선제 저장합니다.

### 🧩13.2 iframe 모드에서의 화면 설정 비활성화

- Ordo 내부(iframe)에서 실행 중일 때는 `window.self !== window.top` 조건으로 감지합니다.
- `AppSettingsDrawer`의 "화면 설정" 섹션에서 테마 변경 버튼을 숨기고, "Ordo 앱 설정에서 테마를 변경할 수 있습니다" 안내문을 표시합니다.
- 단독(standalone) 실행 시에는 라이트/다크/시스템 버튼이 정상적으로 표시됩니다.

| 실행 환경 | 화면 설정 UI |
|---------|------------|
| Ordo AppViewer (iframe) | 안내문만 표시 (테마 버튼 숨김) |
| 단독 실행 (ordo-altar.web.app 직접 접근) | 라이트 / 다크 / 시스템 버튼 표시 |

---

## 📌확장 계획 (v2 Preview)

- `Input`, `Modal`, `Dropdown`, `Tooltip`, `Alert` 등 추가 예정
- `ThemeToggle` (라이트/다크 전환) 도입 (완료 - Ordo 생태계 테마 승계 방식으로 구현)
- 경북산 성당 로고 기반 Color Accent 그룹 지원

---
