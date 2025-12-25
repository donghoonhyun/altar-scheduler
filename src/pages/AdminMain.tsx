import React from 'react';
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
