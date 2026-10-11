// src/pages/components/ServerStats.tsx
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, Hourglass, Users } from 'lucide-react';

import { COLLECTIONS } from '@/lib/collections';
import { cn } from '@/lib/utils';

interface StatTilesProps {
  activeCount: number;
  totalCount: number;
  pendingCount: number;
  /** 보고 있는 달의 설문 (없으면 null) */
  survey: { responses: number; total: number } | null;
  /** 보고 있는 달에서 배정 인원이 모자란 미사 수 */
  shortageCount: number;
  monthLabel: string;
  onOpenServers: () => void;
  onOpenSurveys: () => void;
  onOpenMassEvents: () => void;
}

function Tile({
  icon,
  label,
  value,
  hint,
  tone,
  alert,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone: string;
  alert?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-3xl border bg-white/90 p-3.5 text-left shadow-sm backdrop-blur transition active:scale-[0.97] dark:bg-slate-900/90',
        alert ? 'border-amber-300 dark:border-amber-700' : 'border-white/70 dark:border-slate-800'
      )}
    >
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-2xl', tone)}>{icon}</span>
      <span className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-display text-2xl leading-none text-gray-900 dark:text-gray-50">{value}</span>
      {hint && <span className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</span>}
    </button>
  );
}

/** 복사단 현황 타일 (표시 전용) */
export function PlannerStatTiles({
  activeCount,
  totalCount,
  pendingCount,
  survey,
  shortageCount,
  monthLabel,
  onOpenServers,
  onOpenSurveys,
  onOpenMassEvents,
}: StatTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile
        icon={<Users size={18} />}
        tone="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300"
        label="활동 복사"
        value={<>{activeCount}<span className="ml-0.5 text-base">명</span></>}
        hint={`전체 ${totalCount}명`}
        onClick={onOpenServers}
      />
      <Tile
        icon={<Hourglass size={18} />}
        tone={pendingCount > 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gray-100 text-gray-400 dark:bg-slate-800'}
        label="승인 대기"
        value={<>{pendingCount}<span className="ml-0.5 text-base">명</span></>}
        hint={pendingCount > 0 ? '눌러서 승인하기' : '기다리는 신청 없음'}
        alert={pendingCount > 0}
        onClick={onOpenServers}
      />
      <Tile
        icon={<ClipboardCheck size={18} />}
        tone="bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300"
        label={`${monthLabel} 설문 응답`}
        value={survey ? <>{survey.responses}<span className="text-base text-gray-400">/{survey.total}</span></> : '–'}
        hint={survey ? (survey.responses >= survey.total ? '모두 응답했어요' : `${survey.total - survey.responses}명 남음`) : '설문 전이에요'}
        onClick={onOpenSurveys}
      />
      <Tile
        icon={<AlertTriangle size={18} />}
        tone={shortageCount > 0 ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'}
        label={`${monthLabel} 인원 부족`}
        value={<>{shortageCount}<span className="ml-0.5 text-base">개</span></>}
        hint={shortageCount > 0 ? '배정이 모자란 미사' : '모두 채워졌어요'}
        onClick={onOpenMassEvents}
      />
    </div>
  );
}

interface ServerStatsProps {
  serverGroupId: string;
  /** 보고 있는 달 (YYYYMM) */
  monthKey: string;
  monthLabel: string;
  shortageCount: number;
}

const ServerStats: React.FC<ServerStatsProps> = ({ serverGroupId, monthKey, monthLabel, shortageCount }) => {
  const [counts, setCounts] = useState({ active: 0, total: 0, pending: 0 });
  const [survey, setSurvey] = useState<{ responses: number; total: number } | null>(null);

  const navigate = useNavigate();
  const db = getFirestore();

  // 단원 수
  useEffect(() => {
    if (!serverGroupId) return;
    let cancelled = false;

    getDocs(collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'members'))
      .then((snap) => {
        if (cancelled) return;
        const members = snap.docs.map((d) => d.data());
        setCounts({
          active: members.filter((m) => m.active === true && !m.is_moved).length,
          // request_confirmed가 true 이거나 undefined(기존 데이터)인 멤버 포함, false(승인 대기)는 제외
          total: members.filter((m) => (m.request_confirmed === true || m.request_confirmed === undefined) && !m.is_moved).length,
          pending: members.filter((m) => m.active === false && !m.request_confirmed && !m.is_moved).length,
        });
      })
      .catch((err) => console.error('[ServerStats] members load failed:', err));

    return () => {
      cancelled = true;
    };
  }, [db, serverGroupId]);

  // 보고 있는 달의 설문 응답 — 응답은 설문 문서의 responses 맵에 저장된다
  useEffect(() => {
    if (!serverGroupId || !monthKey) return;
    let cancelled = false;

    getDoc(doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'availability_surveys', monthKey))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setSurvey(null);
          return;
        }
        const targets: string[] = snap.data().member_ids || [];
        const responses = snap.data().responses || {};
        setSurvey({ responses: targets.filter((id) => !!responses[id]).length, total: targets.length });
      })
      .catch((err) => console.error('[ServerStats] survey load failed:', err));

    return () => {
      cancelled = true;
    };
  }, [db, serverGroupId, monthKey]);

  return (
    <PlannerStatTiles
      activeCount={counts.active}
      totalCount={counts.total}
      pendingCount={counts.pending}
      survey={survey}
      shortageCount={shortageCount}
      monthLabel={monthLabel}
      onOpenServers={() => navigate(`/server-groups/${serverGroupId}/servers`)}
      onOpenSurveys={() => navigate(`/server-groups/${serverGroupId}/surveys`)}
      onOpenMassEvents={() => navigate(`/server-groups/${serverGroupId}/mass-events`)}
    />
  );
};

export default ServerStats;
