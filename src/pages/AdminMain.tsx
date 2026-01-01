import React from 'react';
import { MIGRATION_MEMBERS } from '@/data/migrationData';
import { db } from '@/lib/firebase';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Upload } from 'lucide-react';

import { useNavigate, useParams } from 'react-router-dom';
import { Container, Card, Heading } from '@/components/ui';
import { useSession } from '@/state/session';
import { Users, Settings, UserPlus, LayoutDashboard, Info } from 'lucide-react';

const AdminMain: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const session = useSession();

  const adminActions = [
    {
      title: '플래너 대시보드',
      description: '플래너 대시보드(스케줄, 복사단원 관리)로 이동합니다.',
      icon: LayoutDashboard,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
      path: `/server-groups/${serverGroupId}/dashboard`,
    },
    {
      title: '플래너 권한 승인',
      description: '새로운 플래너 권한 요청을 확인하고 승인합니다.',
      icon: UserPlus,
      color: 'text-green-600',
      bg: 'bg-green-100',
      path: `/server-groups/${serverGroupId}/admin/role-approval`,
    },
    {
      title: '멤버십 역할 관리',
      description: '멤버별 역할(권한)을 관리합니다.',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      path: `/server-groups/${serverGroupId}/admin/members`,
    },


  ];

  const sgInfo = serverGroupId ? session.serverGroups[serverGroupId] : null;
  
  // Pending request count check
  const [pendingCount, setPendingCount] = React.useState(0);
  React.useEffect(() => {
    if (!serverGroupId) return;
    const fetchPending = async () => {
      try {
        const { getCountFromServer, collection, query, where } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const q = query(
          collection(db, 'server_groups', serverGroupId, 'role_requests'), 
          where('status', '==', 'pending')
        );
        const snapshot = await getCountFromServer(q);
        setPendingCount(snapshot.data().count);
      } catch (e) {
        console.error(e);
      }
    };
    fetchPending();
  }, [serverGroupId]);

  const [isMigrating, setIsMigrating] = React.useState(false);

  const handleMigration = async () => {
    if (!serverGroupId) return;
    if (!confirm(`총 ${MIGRATION_MEMBERS.length}명의 단원 데이터를 업로드하시겠습니까? \n(기존 ID MB00001~MB00062 데이터가 있으면 덮어씁니다)`)) return;

    setIsMigrating(true);
    try {
      const batch = writeBatch(db);
      
      MIGRATION_MEMBERS.forEach((m, index) => {
        const id = `MB${String(index + 1).padStart(5, '0')}`;
        const ref = doc(db, 'server_groups', serverGroupId, 'members', id);
        batch.set(ref, {
          id: id,
          ...m,
          active: true,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        }, { merge: true });
      });

      await batch.commit();
      alert('✅ 업로드가 성공적으로 완료되었습니다! 이제 members 컬렉션을 확인해보세요.');
    } catch (e) {
      console.error(e);
      alert('❌ 업로드 실패: ' + e);
    } finally {
      setIsMigrating(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-200 to-purple-50">
      <Container className="py-6">
        <div className="mb-6 mt-1 flex flex-col items-center">
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900 text-center relative inline-block">
            복사단 Admin Panel
            <span className="absolute -bottom-2 left-0 w-full h-1.5 bg-purple-500/30 rounded-full"></span>
          </Heading>
        </div>

        <div className="mb-6 text-center">
          <h2 className="text-lg font-bold text-gray-800">
            <span className="text-purple-600 font-extrabold">
              {session.userInfo?.userName} {session.userInfo?.baptismalName && `${session.userInfo.baptismalName} `}
            </span>
            {serverGroupId && (() => {
              const roles = session.groupRoles[serverGroupId] || [];
              if (roles.includes('admin')) return '어드민';
              if (roles.includes('planner')) return '플래너';
              return '복사';
            })()}님 반갑습니다.
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {adminActions.map((action, index) => (
            <Card 
              key={index} 
              className="hover:shadow-md transition-all duration-200 cursor-pointer group border-none shadow-sm"
              onClick={() => action.path !== '#' && navigate(action.path)}
            >
              <div className="p-1 sm:p-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`${action.bg} ${action.color} w-9 h-9 rounded flex items-center justify-center group-hover:scale-110 transition-transform duration-200 flex-shrink-0`}>
                    <action.icon size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 break-keep">{action.title}</h3>
                  {action.title === '플래너 권한 승인' && pendingCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold shadow-sm">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-gray-400 leading-tight break-keep">{action.description}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Heading size="md" className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Info size={20} className="text-gray-400" />
            복사단 정보 상세
          </Heading>
          <Card className="border-none shadow-sm overflow-hidden relative">
            <button 
              onClick={() => navigate(`/server-groups/${serverGroupId}/admin/settings`)}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors shadow-sm z-10"
            >
              <Settings size={12} />
              수정
            </button>
            <div className="divide-y divide-gray-50">
              {[
                { label: '복사단 ID', value: serverGroupId },
                { label: '복사단 명칭', value: sgInfo?.groupName },
                { label: '성당 코드', value: sgInfo?.parishCode },
                { label: '성당 명칭', value: sgInfo?.parishName },
                { label: '표시 기준', value: 'Asia/Seoul (KST)' },
              ].map((item, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between p-2 px-4 hover:bg-gray-50/50 ${idx === 0 ? 'pr-20' : ''}`}
                >
                  <span className="text-xs font-medium text-gray-500">{item.label}</span>
                  <span className="text-xs font-bold text-gray-800">{item.value || '-'}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {session.user?.email === 'pongso.hyun@gmail.com' && (
          <div className="mt-8 mb-8">
            <Card className="border-none shadow-sm p-4 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">데이터 마이그레이션 (임시)</h3>
                  <p className="text-xs text-gray-500">요청하신 62명의 멤버 데이터를 일괄 업로드합니다.</p>
                </div>
                <button
                  onClick={handleMigration}
                  disabled={isMigrating}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isMigrating ? '업로드 중...' : (
                    <>
                      <Upload size={14} />
                      명단 일괄 업로드
                    </>
                  )}
                </button>
              </div>
            </Card>
          </div>
        )}


        <div className="mt-12 text-center text-gray-400 text-[10px]">
          이 페이지는 해당 복사단 멤버십에서 어드민(Admin) 역할이 있는 분들께만 보입니다.
        </div>

        {session.isSuperAdmin && (
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/superadmin')}
              className="text-xs text-gray-300 underline hover:text-gray-500 transition-colors"
            >
              Superadmin Access
            </button>
          </div>
        )}
      </Container>
    </div>
  );

};

export default AdminMain;
