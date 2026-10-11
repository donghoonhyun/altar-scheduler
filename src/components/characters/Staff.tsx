/**
 * 어른 캐릭터 — 플래너(여자 선생님)·어드민(관리자)
 * ---------------------------------------------------------
 * 복사 캐릭터(AltarServer)와 같은 화풍이지만 목이 보이는 3.5등신 어른 비율.
 * 좌표계: viewBox "0 -8 120 168", 머리 중심 (60,55) r=23, 어깨 (44,90)/(76,90)
 * 움직임은 src/styles/globals.css 의 char-* 클래스.
 * ---------------------------------------------------------
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const INK = '#3d3553';
const WHITE = '#fdfcff';
const GOLD = '#f5b942';
const SKIN = '#ffe1c8';

type Mood = 'idle' | 'happy' | 'closed';

function Eyes({ mood }: { mood: Mood }) {
  const line = { stroke: INK, strokeWidth: 2.3, strokeLinecap: 'round' as const, fill: 'none' };
  if (mood === 'happy') {
    return (
      <g {...line}>
        <path d="M49 58 Q52 54.5 55 58" />
        <path d="M65 58 Q68 54.5 71 58" />
      </g>
    );
  }
  if (mood === 'closed') {
    return (
      <g {...line}>
        <path d="M49 56.5 Q52 59.5 55 56.5" />
        <path d="M65 56.5 Q68 59.5 71 56.5" />
      </g>
    );
  }
  return (
    <g className="char-blink">
      <ellipse cx="52" cy="57" rx="2.3" ry="2.8" fill={INK} />
      <ellipse cx="68" cy="57" rx="2.3" ry="2.8" fill={INK} />
      <circle cx="52.8" cy="56" r="0.7" fill="#fff" />
      <circle cx="68.8" cy="56" r="0.7" fill="#fff" />
    </g>
  );
}

function Face({ mood, openMouth, blush = 0.35 }: { mood: Mood; openMouth: boolean; blush?: number }) {
  return (
    <g>
      <g stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M48.5 51 Q52 49.3 55.5 50.5" />
        <path d="M64.5 50.5 Q68 49.3 71.5 51" />
      </g>
      <Eyes mood={mood} />
      <path d="M60 60 Q61.8 62.6 59.6 63.2" stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.5" />
      <g fill="#ff9fb0" opacity={blush}>
        <ellipse cx="46" cy="64" rx="3.8" ry="2.2" />
        <ellipse cx="74" cy="64" rx="3.8" ry="2.2" />
      </g>
      {openMouth ? (
        <ellipse cx="60" cy="68" rx="3.2" ry="2.8" fill="#c2415d" stroke={INK} strokeWidth="1.8" />
      ) : (
        <path d="M56 66.5 Q60 70 64 66.5" stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      )}
    </g>
  );
}

function HeadBase() {
  return (
    <g>
      <g fill={SKIN} stroke={INK} strokeWidth="2.3">
        <ellipse cx="37" cy="58" rx="3.5" ry="4.5" />
        <ellipse cx="83" cy="58" rx="3.5" ry="4.5" />
      </g>
      <circle cx="60" cy="55" r="23" fill={SKIN} stroke={INK} strokeWidth="2.8" />
    </g>
  );
}

function Neck() {
  return <rect x="54" y="72" width="12" height="14" rx="3" fill={SKIN} stroke={INK} strokeWidth="2.5" />;
}

function Sleeve({ d, color }: { d: string; color: string }) {
  return (
    <g>
      <path d={d} stroke={INK} strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d={d} stroke={color} strokeWidth="8" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Hand({ at }: { at: [number, number] }) {
  return <circle cx={at[0]} cy={at[1]} r="5.2" fill={SKIN} stroke={INK} strokeWidth="2.4" />;
}

function Arm({ d, hand, color }: { d: string; hand: [number, number]; color: string }) {
  return (
    <g>
      <Sleeve d={d} color={color} />
      <Hand at={hand} />
    </g>
  );
}

function Sparkles() {
  return (
    <g stroke={GOLD} strokeWidth="2.6" strokeLinecap="round">
      <path d="M18 50 L14 46 M102 50 L106 46 M60 12 V6" />
    </g>
  );
}

function Figure({ children, float, className, title }: { children: ReactNode; float: boolean; className?: string; title: string }) {
  return (
    <div className={cn('inline-block', float && 'char-float', className)}>
      <svg viewBox="0 -8 120 168" className="block h-auto w-full overflow-visible" role="img" aria-label={title}>
        <ellipse cx="60" cy="151" rx="28" ry="5" fill={INK} opacity="0.13" />
        {children}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 여자 선생님 (플래너)
// ─────────────────────────────────────────────────────────────────────────────
const T_HAIR = '#6b3f22';
const T_CARDIGAN = '#a78bfa';
const T_SKIRT = '#4c4a7a';

export type TeacherPose = 'wave' | 'plan' | 'announce' | 'point' | 'cheer';

function TeacherPoseArt({ pose }: { pose: TeacherPose }) {
  switch (pose) {
    case 'plan':
      return (
        <g>
          <Sleeve d="M44 90 Q35 104 44 115" color={T_CARDIGAN} />
          {/* 클립보드 (달력) */}
          <rect x="41" y="97" width="31" height="35" rx="3.5" fill="#c08a55" stroke={INK} strokeWidth="2.4" />
          <rect x="44.5" y="102" width="24" height="26.5" rx="1.5" fill={WHITE} />
          <rect x="51" y="94" width="11" height="6" rx="2" fill="#9aa1b5" stroke={INK} strokeWidth="1.8" />
          <rect x="44.5" y="102" width="24" height="6" fill="#f87171" />
          <g stroke="#c9c4dc" strokeWidth="1.1">
            <path d="M44.5 114 H68.5 M44.5 120 H68.5 M52.5 108 V128.5 M60.5 108 V128.5" />
          </g>
          <path d="M54.5 117 L56.5 119 L59.5 115.5" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Hand at={[42, 117]} />
          <Sleeve d="M76 90 Q88 100 77 110" color={T_CARDIGAN} />
          <path d="M77 110 L68 100" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M77 110 L68 100" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
          <Hand at={[77, 111]} />
        </g>
      );
    case 'announce':
      return (
        <g>
          <Arm d="M44 90 Q37 106 38 119" hand={[38, 119]} color={T_CARDIGAN} />
          <Sleeve d="M76 90 Q92 87 95 72" color={T_CARDIGAN} />
          {/* 설문 편지 */}
          <g className="char-ring">
            <rect x="83" y="46" width="24" height="17" rx="2.5" fill={WHITE} stroke={INK} strokeWidth="2.2" />
            <path d="M83.5 47.5 L95 56 L106.5 47.5" stroke={INK} strokeWidth="2" strokeLinejoin="round" fill="none" />
            <circle cx="106" cy="46" r="4.5" fill="#f43f5e" stroke={INK} strokeWidth="1.6" />
          </g>
          <g stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d="M113 52 Q116 56 114 61" />
            <path d="M78 46 Q76 42 79 39" />
          </g>
          <Hand at={[95, 68]} />
        </g>
      );
    case 'point':
      return (
        <g>
          <Arm d="M44 90 Q34 100 42 111" hand={[42, 111]} color={T_CARDIGAN} />
          <Sleeve d="M76 90 Q90 90 95 78" color={T_CARDIGAN} />
          {/* 지시봉 */}
          <path d="M95 78 L109 52" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M95 78 L109 52" stroke="#e7e3f5" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M110 40 L112.2 45 L117.6 45.5 L113.5 49 L114.8 54.3 L110 51.4 L105.2 54.3 L106.5 49 L102.4 45.5 L107.8 45 Z"
            fill={GOLD}
            stroke={INK}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <Hand at={[95, 78]} />
        </g>
      );
    case 'cheer':
      return (
        <g>
          <Arm d="M44 90 Q30 80 26 62" hand={[26, 62]} color={T_CARDIGAN} />
          <Arm d="M76 90 Q90 80 94 62" hand={[94, 62]} color={T_CARDIGAN} />
          <Sparkles />
        </g>
      );
    case 'wave':
    default:
      return (
        <g>
          <Arm d="M44 90 Q37 106 38 119" hand={[38, 119]} color={T_CARDIGAN} />
          <g className="char-wave">
            <Arm d="M76 90 Q92 86 94 65" hand={[94, 65]} color={T_CARDIGAN} />
          </g>
          <g stroke={T_CARDIGAN} strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d="M101 57 Q105 61 103 66" />
            <path d="M86 55 Q85 51 88 48" />
          </g>
        </g>
      );
  }
}

/** 플래너 화면의 안내 캐릭터 — 단발머리 여자 선생님 */
export function Teacher({
  pose = 'wave',
  float = true,
  className,
  title,
}: {
  pose?: TeacherPose;
  float?: boolean;
  className?: string;
  title?: string;
}) {
  const mood: Mood = pose === 'plan' ? 'idle' : 'happy';
  return (
    <Figure float={float} className={className} title={title ?? '선생님 캐릭터'}>
      {/* 다리·구두 */}
      <g fill="#6b5a7a" stroke={INK} strokeWidth="2.4">
        <ellipse cx="50" cy="146" rx="7.5" ry="4.2" />
        <ellipse cx="70" cy="146" rx="7.5" ry="4.2" />
      </g>
      {/* 뒷머리 (단발) */}
      <path
        d="M36 50 C35 33 47 29 60 29 C73 29 85 33 84 50 L86 80 Q80 86 74 80 L72 64 L48 64 L46 80 Q40 86 34 80 Z"
        fill={T_HAIR}
        stroke={INK}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <Neck />
      {/* 치마 */}
      <path d="M40 112 L80 112 L88 140 Q60 148 32 140 Z" fill={T_SKIRT} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      {/* 블라우스 + 카디건 */}
      <path d="M43 85 C47 80 73 80 77 85 L82 118 Q60 124 38 118 Z" fill={WHITE} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M43 85 C45 82 49 81 53 81 L57 121 Q46 121 38 118 Z" fill={T_CARDIGAN} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M77 85 C75 82 71 81 67 81 L63 121 Q74 121 82 118 Z" fill={T_CARDIGAN} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M53 81.5 L60 90 L67 81.5" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" fill={WHITE} />
      <g fill={GOLD} stroke={INK} strokeWidth="1">
        <circle cx="60" cy="100" r="1.7" />
        <circle cx="60" cy="109" r="1.7" />
      </g>

      <HeadBase />
      {/* 앞머리 + 머리핀 */}
      <path
        d="M37 52 C36 37 46 31 60 31 C74 31 84 37 83 52 C78 44 70 40 62 42 C56 38 44 42 37 52 Z"
        fill={T_HAIR}
        stroke={INK}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path d="M72 38 L80 42" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
      <path d="M72 38 L80 42" stroke={INK} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <Face mood={mood} openMouth={pose === 'announce' || pose === 'cheer'} blush={0.45} />
      {/* 속눈썹 */}
      {mood === 'idle' && (
        <g stroke={INK} strokeWidth="1.5" strokeLinecap="round">
          <path d="M49.5 55.5 L47.8 54.2 M70.5 55.5 L72.2 54.2" />
        </g>
      )}
      <TeacherPoseArt pose={pose} />
    </Figure>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 관리자 (어드민)
// ─────────────────────────────────────────────────────────────────────────────
const M_HAIR = '#2a2530';
const M_SUIT = '#3f4a7a';
const M_TROUSERS = '#2f3555';
const M_TIE = '#e5484d';

export type ManagerPose = 'wave' | 'key' | 'alert';

function ManagerPoseArt({ pose }: { pose: ManagerPose }) {
  switch (pose) {
    case 'key':
      return (
        <g>
          <Arm d="M44 90 Q37 106 38 119" hand={[38, 119]} color={M_SUIT} />
          <Sleeve d="M76 90 Q92 88 95 76" color={M_SUIT} />
          {/* 열쇠 */}
          <g className="char-ring">
            <path d="M95 74 V44" stroke={INK} strokeWidth="6" strokeLinecap="round" />
            <path d="M95 74 V44" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
            <path d="M95 46 H103 V51 H99 M95 54 H101 V58" stroke={INK} strokeWidth="5.2" strokeLinejoin="round" fill="none" />
            <path d="M95 46 H103 V51 H99 M95 54 H101 V58" stroke={GOLD} strokeWidth="2.4" strokeLinejoin="round" fill="none" />
            <circle cx="95" cy="82" r="7.5" fill={GOLD} stroke={INK} strokeWidth="2.4" />
            <circle cx="95" cy="82" r="2.6" fill={WHITE} stroke={INK} strokeWidth="1.6" />
          </g>
          <Hand at={[95, 73]} />
        </g>
      );
    case 'alert':
      return (
        <g>
          <Arm d="M44 90 Q37 106 38 119" hand={[38, 119]} color={M_SUIT} />
          <Sleeve d="M76 90 Q92 87 95 74" color={M_SUIT} />
          {/* 신청서 */}
          <g className="char-ring">
            <rect x="84" y="40" width="22" height="28" rx="2.5" fill={WHITE} stroke={INK} strokeWidth="2.2" />
            <g stroke="#c9c4dc" strokeWidth="1.6" strokeLinecap="round">
              <path d="M88 48 H102 M88 53.5 H102 M88 59 H97" />
            </g>
            <circle cx="106" cy="40" r="6.5" fill="#f43f5e" stroke={INK} strokeWidth="1.8" />
            <path d="M106 36.5 V41" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="106" cy="43.8" r="1.1" fill="#fff" />
          </g>
          <Hand at={[95, 70]} />
        </g>
      );
    case 'wave':
    default:
      return (
        <g>
          <Arm d="M44 90 Q37 106 38 119" hand={[38, 119]} color={M_SUIT} />
          <g className="char-wave">
            <Arm d="M76 90 Q92 86 94 65" hand={[94, 65]} color={M_SUIT} />
          </g>
          <g stroke="#a5b4fc" strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d="M101 57 Q105 61 103 66" />
            <path d="M86 55 Q85 51 88 48" />
          </g>
        </g>
      );
  }
}

/** 어드민 화면의 안내 캐릭터 — 안경 쓴 정장 차림의 관리자 */
export function Manager({
  pose = 'key',
  float = true,
  className,
  title,
}: {
  pose?: ManagerPose;
  float?: boolean;
  className?: string;
  title?: string;
}) {
  const mood: Mood = pose === 'key' ? 'idle' : 'happy';
  return (
    <Figure float={float} className={className} title={title ?? '관리자 캐릭터'}>
      {/* 구두 */}
      <g fill="#3a3348" stroke={INK} strokeWidth="2.4">
        <ellipse cx="49" cy="146" rx="8.5" ry="4.4" />
        <ellipse cx="71" cy="146" rx="8.5" ry="4.4" />
      </g>
      {/* 바지 */}
      <path d="M40 120 H80 L78 144 H63 L60 130 L57 144 H42 Z" fill={M_TROUSERS} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <Neck />
      {/* 셔츠 + 재킷 */}
      <path d="M43 85 C47 80 73 80 77 85 L83 126 Q60 131 37 126 Z" fill={WHITE} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M43 85 C45 82 49 81 53 81 L58 128 Q46 128.5 37 126 Z" fill={M_SUIT} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M77 85 C75 82 71 81 67 81 L62 128 Q74 128.5 83 126 Z" fill={M_SUIT} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      {/* 넥타이 */}
      <path d="M57.5 84 L62.5 84 L64 102 L60 108 L56 102 Z" fill={M_TIE} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M53 81.5 L57.5 87 L60 83 L62.5 87 L67 81.5" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" fill={WHITE} />
      {/* 옷깃의 별 배지 */}
      <path
        d="M47 95 L48.3 97.8 L51.4 98.1 L49.1 100.2 L49.8 103.2 L47 101.6 L44.2 103.2 L44.9 100.2 L42.6 98.1 L45.7 97.8 Z"
        fill={GOLD}
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      <HeadBase />
      {/* 짧은 옆가르마 */}
      <path
        d="M37 54 C36 37 46 31 60 31 C75 31 84 38 83 54 C80 45 75 41 68 41 C60 41 54 38 48 42 C42 45 39 49 37 54 Z"
        fill={M_HAIR}
        stroke={INK}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <Face mood={mood} openMouth={pose === 'alert'} blush={0.25} />
      {/* 안경 */}
      <g stroke={INK} strokeWidth="1.9" fill="#fff" fillOpacity="0.18">
        <circle cx="52" cy="57" r="5.6" />
        <circle cx="68" cy="57" r="5.6" />
        <path d="M57.6 57 Q60 55.4 62.4 57" fill="none" />
      </g>
      <ManagerPoseArt pose={pose} />
    </Figure>
  );
}
