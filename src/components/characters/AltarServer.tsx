/**
 * 꼬마 복사 캐릭터
 * ---------------------------------------------------------
 * 전례 스케줄러의 캐릭터와 같은 화풍(2.5등신, 진한 외곽선)으로 그린 복사.
 * 빨간 수단 위에 흰 중백의를 입고, 포즈에 따라 촛대·종 등을 든다.
 * seed(보통 memberId)로 피부·머리색·머리 모양이 정해져 단원마다 얼굴이 다르다.
 *
 * 좌표계: viewBox "0 -8 120 168", 머리 중심 (60,52) r=30, 어깨 (44,90)/(76,90)
 * 움직임(둥실·깜빡임·촛불·손 흔들기)은 src/styles/globals.css 의 char-* 클래스.
 * ---------------------------------------------------------
 */
import { cn } from '@/lib/utils';

const INK = '#3d3553';
const WHITE = '#fdfcff';
const CASSOCK = '#e5484d';
const CASSOCK_DEEP = '#c0343a';
const GOLD = '#f5b942';
const SKINS = ['#ffe1c8', '#f8d0ad', '#efbb90'] as const;
const HAIRS = ['#4a3428', '#2f2838', '#7b4b2a', '#a8703f'] as const;

export type ServerMood = 'idle' | 'happy' | 'closed' | 'sad';
export type ServerPose = 'candle' | 'bell' | 'wave' | 'cheer' | 'pray' | 'wait' | 'rest';

interface Look {
  skin: string;
  hair: string;
  hairStyle: 0 | 1 | 2;
  freckles: boolean;
}

function pickIndex(seed: string, length: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % length;
}

function lookFromSeed(seed: string): Look {
  return {
    skin: SKINS[pickIndex(`${seed}:skin`, SKINS.length)],
    hair: HAIRS[pickIndex(`${seed}:hair`, HAIRS.length)],
    hairStyle: pickIndex(`${seed}:style`, 3) as 0 | 1 | 2,
    freckles: pickIndex(`${seed}:freckle`, 3) === 0,
  };
}

function Hair({ look }: { look: Look }) {
  const common = { fill: look.hair, stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  if (look.hairStyle === 1) {
    // 옆 가르마
    return (
      <g>
        <path d="M30 54 C28 30 44 20 62 20 C80 20 92 32 90 52 C84 40 70 33 50 38 C40 41 34 46 30 54 Z" {...common} />
        <path d="M50 38 Q58 30 72 30" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.45" />
      </g>
    );
  }
  if (look.hairStyle === 2) {
    // 둥근 앞머리 + 삐친 머리
    return (
      <g>
        <path d="M30 52 C30 30 44 21 60 21 C76 21 90 30 90 52 C84 42 74 37 60 38 C46 37 36 42 30 52 Z" {...common} />
        <path d="M60 22 Q55 10 66 8" stroke={look.hair} strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M60 22 Q55 10 66 8" stroke={INK} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
      </g>
    );
  }
  // 삐죽 앞머리
  return (
    <path
      d="M30 52 C29 30 44 20 60 20 C77 20 91 30 90 52 L85 45 L79 51 L73 41 L66 49 L60 38 L54 49 L47 41 L41 51 L35 45 Z"
      {...common}
    />
  );
}

function Eyes({ mood }: { mood: ServerMood }) {
  if (mood === 'happy') {
    return (
      <g stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M45 57 Q49 52 53 57" />
        <path d="M67 57 Q71 52 75 57" />
      </g>
    );
  }
  if (mood === 'closed') {
    return (
      <g stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M45 55 Q49 59 53 55" />
        <path d="M67 55 Q71 59 75 55" />
      </g>
    );
  }
  if (mood === 'sad') {
    return (
      <g>
        <ellipse cx="49" cy="57" rx="3" ry="3.4" fill={INK} />
        <ellipse cx="71" cy="57" rx="3" ry="3.4" fill={INK} />
        <path d="M44 51.5 L52 48.5 M76 51.5 L68 48.5" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g className="char-blink">
      <ellipse cx="49" cy="56" rx="3.1" ry="3.7" fill={INK} />
      <ellipse cx="71" cy="56" rx="3.1" ry="3.7" fill={INK} />
      <circle cx="50" cy="54.8" r="1" fill="#fff" />
      <circle cx="72" cy="54.8" r="1" fill="#fff" />
    </g>
  );
}

function Head({ look, mood, openMouth }: { look: Look; mood: ServerMood; openMouth: boolean }) {
  return (
    <g>
      <g fill={look.skin} stroke={INK} strokeWidth="2.5">
        <ellipse cx="30" cy="57" rx="5" ry="6.5" />
        <ellipse cx="90" cy="57" rx="5" ry="6.5" />
      </g>
      <circle cx="60" cy="52" r="30" fill={look.skin} stroke={INK} strokeWidth="3" />
      <Hair look={look} />
      <Eyes mood={mood} />
      <g fill="#ff9fb0" opacity="0.5">
        <ellipse cx="43" cy="65" rx="5" ry="3" />
        <ellipse cx="77" cy="65" rx="5" ry="3" />
      </g>
      {look.freckles && (
        <g fill="#b07a55" opacity="0.7">
          <circle cx="41" cy="62" r="0.9" />
          <circle cx="44" cy="63.5" r="0.9" />
          <circle cx="76" cy="63.5" r="0.9" />
          <circle cx="79" cy="62" r="0.9" />
        </g>
      )}
      {mood === 'sad' ? (
        <path d="M55 70 Q60 66 65 70" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      ) : openMouth ? (
        <ellipse cx="60" cy="68" rx="4" ry="3.6" fill="#c2415d" stroke={INK} strokeWidth="2" />
      ) : (
        <path d="M55 66 Q60 71 65 66" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      )}
    </g>
  );
}

/** 빨간 수단 + 레이스 단의 흰 중백의 */
function Vestments() {
  return (
    <g>
      <path
        d="M42 84 C46 79 74 79 78 84 L90 141 Q60 150 30 141 Z"
        fill={CASSOCK}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M60 122 V146" stroke={CASSOCK_DEEP} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path
        d="M41 84 C46 79 74 79 79 84 L86 119 Q80 125 74 119 Q67 125 60 119 Q53 125 46 119 Q40 125 34 119 Z"
        fill={WHITE}
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M38 113 Q60 118 82 113" stroke="#d9d3ea" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* 목 위로 보이는 수단 깃 */}
      <path d="M49 82 Q60 91 71 82" stroke={CASSOCK} strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M49 82 Q60 91 71 82" stroke={INK} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.35" />
    </g>
  );
}

function Sleeve({ d }: { d: string }) {
  return (
    <g>
      <path d={d} stroke={INK} strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d={d} stroke={WHITE} strokeWidth="8" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Hand({ at, skin }: { at: [number, number]; skin: string }) {
  return <circle cx={at[0]} cy={at[1]} r="5.5" fill={skin} stroke={INK} strokeWidth="2.5" />;
}

function Arm({ d, hand, skin }: { d: string; hand: [number, number]; skin: string }) {
  return (
    <g>
      <Sleeve d={d} />
      <Hand at={hand} skin={skin} />
    </g>
  );
}

function Pose({ pose, skin }: { pose: ServerPose; skin: string }) {
  switch (pose) {
    case 'candle':
      return (
        <g>
          <Arm d="M44 90 Q37 106 38 119" hand={[38, 119]} skin={skin} />
          <Sleeve d="M76 90 Q88 96 97 105" />
          {/* 촛대 */}
          <rect x="94" y="72" width="6" height="34" rx="2" fill={WHITE} stroke={INK} strokeWidth="2.2" />
          <path d="M90 106 H104 L101 112 H93 Z" fill={GOLD} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M97 71 V66" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <g className="char-flame">
            <path d="M97 50 C103 57 102 66 97 67 C92 66 91 57 97 50 Z" fill="#ffb224" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d="M97 57 C100 61 99 65 97 65.5 C95 65 94 61 97 57 Z" fill="#fff3c4" />
          </g>
          <Hand at={[97, 104]} skin={skin} />
        </g>
      );
    case 'bell':
      return (
        <g>
          <Arm d="M44 90 Q37 106 38 119" hand={[38, 119]} skin={skin} />
          <Sleeve d="M76 90 Q92 86 95 70" />
          <g className="char-ring">
            <path d="M95 60 V52" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
            <path d="M86 48 Q95 30 104 48 L107 52 H83 Z" fill={GOLD} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
            <circle cx="95" cy="55" r="2.6" fill={GOLD} stroke={INK} strokeWidth="1.8" />
          </g>
          <g stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d="M110 40 Q114 45 112 51" />
            <path d="M80 40 Q76 45 78 51" />
          </g>
          <Hand at={[95, 66]} skin={skin} />
        </g>
      );
    case 'cheer':
      return (
        <g>
          <Arm d="M44 90 Q30 80 26 62" hand={[26, 62]} skin={skin} />
          <Arm d="M76 90 Q90 80 94 62" hand={[94, 62]} skin={skin} />
          <g stroke={GOLD} strokeWidth="2.6" strokeLinecap="round">
            <path d="M18 50 L14 46 M102 50 L106 46 M60 2 V-4" />
          </g>
        </g>
      );
    case 'pray':
      return (
        <g>
          <Sleeve d="M44 90 Q42 104 55 108" />
          <Sleeve d="M76 90 Q78 104 65 108" />
          <path d="M60 97 L55 109 Q60 113 65 109 Z" fill={skin} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M60 99 V110" stroke={INK} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
        </g>
      );
    case 'wait':
      return (
        <g>
          <Sleeve d="M44 90 Q38 104 49 112" />
          <Sleeve d="M76 90 Q82 104 71 112" />
          {/* 모래시계 */}
          <g className="char-tilt">
            <path d="M52 96 H68 M52 122 H68" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <path d="M54 97 H66 L61 109 L66 121 H54 L59 109 Z" fill="#e8f1ff" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M56.5 99 H63.5 L60 106 Z M56 120 H64 L60 114 Z" fill={GOLD} />
          </g>
          <Hand at={[50, 113]} skin={skin} />
          <Hand at={[70, 113]} skin={skin} />
        </g>
      );
    case 'rest':
      return (
        <g>
          <Arm d="M44 90 Q38 106 40 120" hand={[40, 120]} skin={skin} />
          <Arm d="M76 90 Q82 106 80 120" hand={[80, 120]} skin={skin} />
        </g>
      );
    case 'wave':
    default:
      return (
        <g>
          <Arm d="M44 90 Q37 106 38 119" hand={[38, 119]} skin={skin} />
          <g className="char-wave">
            <Arm d="M76 90 Q92 86 94 65" hand={[94, 65]} skin={skin} />
          </g>
          <g stroke="#a78bfa" strokeWidth="2.4" strokeLinecap="round" fill="none">
            <path d="M101 57 Q105 61 103 66" />
            <path d="M86 55 Q85 51 88 48" />
          </g>
        </g>
      );
  }
}

const DEFAULT_MOOD: Record<ServerPose, ServerMood> = {
  candle: 'idle',
  bell: 'happy',
  wave: 'happy',
  cheer: 'happy',
  pray: 'closed',
  wait: 'idle',
  rest: 'sad',
};

interface AltarServerProps {
  /** 얼굴을 정하는 값 (보통 memberId). 같은 seed 는 항상 같은 얼굴 */
  seed?: string;
  pose?: ServerPose;
  mood?: ServerMood;
  /** 둥실 떠 있는 움직임 */
  float?: boolean;
  className?: string;
  title?: string;
}

export function AltarServer({ seed = 'altar', pose = 'wave', mood, float = true, className, title }: AltarServerProps) {
  const look = lookFromSeed(seed);
  const faceMood = mood ?? DEFAULT_MOOD[pose];
  return (
    <div className={cn('inline-block', float && 'char-float', className)}>
      <svg viewBox="0 -8 120 168" className="block h-auto w-full overflow-visible" role="img" aria-label={title ?? '복사 캐릭터'}>
        <ellipse cx="60" cy="151" rx="30" ry="5" fill={INK} opacity="0.13" />
        <g fill="#5b4b6b" stroke={INK} strokeWidth="2.5">
          <ellipse cx="49" cy="146" rx="8" ry="4.5" />
          <ellipse cx="71" cy="146" rx="8" ry="4.5" />
        </g>
        <Vestments />
        <Head look={look} mood={faceMood} openMouth={pose === 'cheer' || pose === 'bell'} />
        <Pose pose={pose} skin={look.skin} />
      </svg>
    </div>
  );
}

/** 얼굴만 보여 주는 작은 아바타 (단원 버튼·달력 표시용) */
export function ServerAvatar({
  seed = 'altar',
  size = 28,
  mood = 'happy',
  className,
}: {
  seed?: string;
  size?: number;
  mood?: ServerMood;
  className?: string;
}) {
  const look = lookFromSeed(seed);
  return (
    <svg
      viewBox="22 14 76 76"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
      aria-hidden
    >
      <Head look={look} mood={mood} openMouth={false} />
    </svg>
  );
}
