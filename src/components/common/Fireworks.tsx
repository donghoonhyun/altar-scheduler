// src/components/common/Fireworks.tsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface FireworksProps {
  /** 가운데에 띄울 축하 문구 */
  message?: string;
  /** 문구 아래 작은 설명 */
  subMessage?: string;
  /** 애니메이션이 끝나면 호출 — 부모가 컴포넌트를 내린다 */
  onDone: () => void;
}

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
  color: string;
}

const COLORS = ['#a78bfa', '#38bdf8', '#fbbf24', '#fb7185', '#34d399', '#f472b6', '#ffffff'];
/** 폭죽이 터지는 시각(ms)과 화면 내 위치(비율) */
const BURSTS = [
  { at: 0, x: 0.5, y: 0.3 },
  { at: 260, x: 0.22, y: 0.24 },
  { at: 480, x: 0.78, y: 0.26 },
  { at: 800, x: 0.36, y: 0.46 },
  { at: 1040, x: 0.68, y: 0.44 },
  { at: 1320, x: 0.5, y: 0.2 },
  { at: 1560, x: 0.18, y: 0.4 },
  { at: 1760, x: 0.84, y: 0.36 },
];
const DURATION = 3200;

/**
 * 화면 전체에 폭죽을 터뜨리는 축하 연출 (일정 확정·최종 확정).
 * 화면을 가리기만 하고 누르는 것은 막지 않는다. 움직임 줄이기 설정이면 아무것도 띄우지 않는다.
 */
export default function Fireworks({ message, subMessage, onDone }: FireworksProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (reduced || !canvas || !ctx) {
      onDoneRef.current();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';

    const particles: Particle[] = [];
    const scale = Math.min(Math.max(width / 420, 0.85), 1.6);
    let fired = 0;
    let raf = 0;
    const startedAt = performance.now();
    let last = startedAt;

    const burst = (cx: number, cy: number) => {
      const main = COLORS[Math.floor(Math.random() * COLORS.length)];
      const count = 64 + Math.floor(Math.random() * 24);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
        const speed = (110 + Math.random() * 300) * scale;
        const ttl = 1 + Math.random() * 0.8;
        particles.push({
          x: cx,
          y: cy,
          px: cx,
          py: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: ttl,
          ttl,
          size: (1.6 + Math.random() * 1.8) * scale,
          color: Math.random() < 0.7 ? main : COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
    };

    const frame = (now: number) => {
      const elapsed = now - startedAt;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      while (fired < BURSTS.length && BURSTS[fired].at <= elapsed) {
        const b = BURSTS[fired++];
        burst(width * (b.x + (Math.random() - 0.5) * 0.08), height * (b.y + (Math.random() - 0.5) * 0.06));
      }

      ctx.clearRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.px = p.x;
        p.py = p.y;
        // 공기 저항으로 느려지며 아래로 떨어진다
        const drag = Math.pow(0.12, dt);
        p.vx *= drag;
        p.vy = p.vy * drag + 260 * scale * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const alpha = Math.min(1, (p.life / p.ttl) * 1.6);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.px - p.vx * 0.03, p.py - p.vy * 0.03);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        // 불꽃 머리: 꺼져 갈수록 깜빡인다
        ctx.globalAlpha = alpha * (p.life < 0.4 ? 0.4 + Math.random() * 0.6 : 0.9);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (elapsed < DURATION) {
        raf = requestAnimationFrame(frame);
      } else {
        onDoneRef.current();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }, []);

  return createPortal(
    <div className="ui-fireworks pointer-events-none fixed inset-0 z-[200] flex items-center justify-center" aria-hidden>
      <div className="absolute inset-0 bg-slate-950/55" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {message && (
        <div className="ui-fireworks-message relative px-6 text-center">
          <p className="font-display text-4xl leading-tight text-white drop-shadow-[0_4px_18px_rgba(124,58,237,0.9)] break-keep">
            {message}
          </p>
          {subMessage && <p className="mt-2 text-base font-semibold text-white/90 break-keep">{subMessage}</p>}
        </div>
      )}
    </div>,
    document.body
  );
}
