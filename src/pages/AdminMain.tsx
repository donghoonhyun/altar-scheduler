import React from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '@/state/session';
import { ChevronRight, Church, LayoutDashboard, Settings, UserPlus, Users } from 'lucide-react';
import { COLLECTIONS } from '@/lib/collections';
import ServerHero from './components/ServerHero';
import { Manager } from '@/components/characters/Staff';
import { cn } from '@/lib/utils';

const AdminMain: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const session = useSession();

  const sgInfo = serverGroupId ? session.serverGroups[serverGroupId] : null;

  // Pending request count check (Real-time)
  const [pendingCount, setPendingCount] = React.useState(0);
  React.useEffect(() => {
    if (!serverGroupId) return;

    const q = query(
      collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'role_requests'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      setPendingCount(snapshot.size); // snapshot.size gives the document count in the QuerySnapshot
    }, (error: any) => {
        console.error("Error watching pending requests:", error);
    });

    return () => unsubscribe();
  }, [serverGroupId]);

  const base = `/server-groups/${serverGroupId}`;
  const roles = (serverGroupId && session.groupRoles[serverGroupId]) || [];
  const roleLabel = roles.includes('admin') ? '어드민' : roles.includes('planner') ? '플래너' : session.isSuperAdmin ? '슈퍼어드민' : '복사';

  const adminActions = [
    {
      title: '플래너 대시보드',
      description: '미사 일정과 복사단원을 관리해요',
      icon: LayoutDashboard,
      tone: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300',
      path: `${base}/dashboard`,
      badge: 0,
    },
    {
      title: '플래너 권한 승인',
      description: '새 플래너 신청을 확인하고 승인해요',
      icon: UserPlus,
      tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
      path: `${base}/admin/role-approval`,
      badge: pendingCount,
    },
    {
      title: '멤버십 역할 관리',
      description: '멤버별 역할(권한)을 바꿔요',
      icon: Users,
      tone: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
      path: `${base}/admin/members`,
      badge: 0,
    },
    {
      title: '복사단 설정',
      description: '복사단 이름과 운영 설정을 고쳐요',
      icon: Settings,
      tone: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
      path: `${base}/admin/settings`,
      badge: 0,
    },
  ];

  const groupInfo = [
    { label: '성당', value: sgInfo?.parishName },
    { label: '복사단', value: sgInfo?.groupName },
    { label: '복사단 ID', value: serverGroupId },
    { label: '성당 코드', value: sgInfo?.parishCode },
    { label: '표시 기준', value: 'Asia/Seoul (KST)' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-100 via-violet-50 to-sky-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 pb-12 transition-colors duration-300">
      <div className="max-w-3xl mx-auto px-4 pt-3 space-y-3 ui-stagger">
        {/* 1) 인사말 + 지금 챙길 일 */}
        <ServerHero
          userName={session.userInfo?.userName}
          baptismalName={session.userInfo?.baptismalName}
          roleLabel={roleLabel}
          // 어드민 화면은 관리자 캐릭터가 안내한다 (신청이 있으면 신청서를 들고 알려 준다)
          character={<Manager key={pendingCount > 0 ? 'alert' : 'key'} pose={pendingCount > 0 ? 'alert' : 'key'} />}
          state={
            pendingCount > 0
              ? {
                  kind: 'info',
                  seed: serverGroupId || 'admin',
                  pose: 'bell',
                  tone: 'amber',
                  title: `플래너 신청이 ${pendingCount}건 있어요`,
                  description: '새 플래너의 신청을 확인하고 승인해 주세요.',
                  action: { label: '승인하러 가기', onClick: () => navigate(`${base}/admin/role-approval`) },
                }
              : {
                  kind: 'info',
                  seed: serverGroupId || 'admin',
                  pose: 'wave',
                  title: `${sgInfo?.groupName || '복사단'} 관리`,
                  description: '기다리는 신청이 없어요. 필요한 메뉴를 골라 주세요.',
                }
          }
        />

        {/* 2) 관리 메뉴 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {adminActions.map((action) => (
            <button
              key={action.path}
              type="button"
              onClick={() => navigate(action.path)}
              className={cn(
                'group flex items-center gap-3 rounded-3xl border bg-white/90 p-4 text-left shadow-sm backdrop-blur transition hover:shadow-md active:scale-[0.98] dark:bg-slate-900/90',
                action.badge > 0 ? 'border-amber-300 dark:border-amber-700' : 'border-white/70 dark:border-slate-800'
              )}
            >
              <span className={cn('relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105', action.tone)}>
                <action.icon size={22} />
                {action.badge > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow ring-2 ring-white dark:ring-slate-900">
                    {action.badge}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg leading-tight text-gray-900 dark:text-gray-50">{action.title}</span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400 break-keep">{action.description}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-400 dark:text-slate-600" />
            </button>
          ))}
        </div>

        {/* 3) 복사단 정보 */}
        <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display text-lg text-gray-800 dark:text-gray-100">
              <Church size={18} className="text-violet-500" />
              복사단 정보
            </h3>
            <button
              onClick={() => navigate(`${base}/admin/settings`)}
              className="flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 active:scale-95 dark:bg-violet-900/30 dark:text-violet-300"
            >
              <Settings size={12} />
              수정
            </button>
          </div>
          <dl className="divide-y divide-gray-100 dark:divide-slate-800">
            {groupInfo.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="shrink-0 text-sm text-gray-500 dark:text-gray-400">{item.label}</dt>
                <dd className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{item.value || '-'}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="pt-2 text-center text-[11px] text-gray-400">
          이 페이지는 어드민 역할이 있는 분께만 보여요.
        </p>
      </div>
    </div>
  );

};

export default AdminMain;
