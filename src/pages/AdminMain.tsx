import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Card, Heading } from '@/components/ui';
import { useSession } from '@/state/session';
import { Users, Settings, ShieldCheck, UserPlus, LayoutDashboard } from 'lucide-react';

const AdminMain: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const session = useSession();

  const adminActions = [
    {
      title: '복사단 메인 바로가기',
      description: '일정 관리 및 현황 대시보드로 이동합니다.',
      icon: LayoutDashboard,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
      path: `/server-groups/${serverGroupId}/dashboard`,
    },
    {
      title: '멤버 역할 관리',
      description: '복사단원 목록을 관리하고 역할을 부여합니다.',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      path: `/server-groups/${serverGroupId}/admin/members`,
    },
    {
      title: '권한 설정',
      description: '플래너 및 어드민 권한을 관리합니다.',
      icon: ShieldCheck,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
      path: '#',
    },
    {
      title: '복사단 설정',
      description: '복사단 이름, 지역 설정을 변경합니다.',
      icon: Settings,
      color: 'text-gray-600',
      bg: 'bg-gray-100',
      path: `/server-groups/${serverGroupId}/admin/settings`,
    },
    {
      title: '신규 가입 승인',
      description: '새로운 가입 요청을 확인하고 승인합니다.',
      icon: UserPlus,
      color: 'text-green-600',
      bg: 'bg-green-100',
      path: '#',
    },
  ];

  const sgInfo = serverGroupId ? session.serverGroups[serverGroupId] : null;

  return (
    <Container className="py-6 min-h-screen">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">
          <span className="text-purple-600 font-extrabold">
            {session.userInfo?.userName} {session.userInfo?.baptismalName && `${session.userInfo.baptismalName} `}
          </span>
          어드민님 반갑습니다.
        </h2>
        <Heading size="lg" className="text-2xl font-extrabold text-gray-900 mb-1">
          Admin Panel
        </Heading>
        <p className="text-sm text-gray-600">
          복사단({serverGroupId})의 관리 기능을 수행합니다.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {adminActions.map((action, index) => (
          <Card 
            key={index} 
            className="hover:shadow-md transition-all duration-200 cursor-pointer group border-none shadow-sm"
            onClick={() => action.path !== '#' && navigate(action.path)}
          >
            <div className="p-2 sm:p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`${action.bg} ${action.color} w-6 h-6 rounded flex items-center justify-center group-hover:scale-110 transition-transform duration-200 flex-shrink-0`}>
                  <action.icon size={12} />
                </div>
                <h3 className="text-[11px] font-bold text-gray-800 break-keep">{action.title}</h3>
              </div>
              <p className="text-[9px] text-gray-400 leading-tight break-keep">{action.description}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <Heading size="md" className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Settings size={20} className="text-gray-400" />
          복사단 정보 상세
        </Heading>
        <Card className="border-none shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {[
              { label: '복사단 ID', value: serverGroupId },
              { label: '성당 명칭', value: sgInfo?.parishName },
              { label: '복사단 명칭', value: sgInfo?.groupName },
              { label: '성당 코드', value: sgInfo?.parishCode },
              { label: '표시 기준', value: 'Asia/Seoul (KST)' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 px-4 hover:bg-gray-50/50">
                <span className="text-xs font-medium text-gray-500">{item.label}</span>
                <span className="text-xs font-bold text-gray-800">{item.value || '-'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-12 text-center text-gray-400 text-[10px]">
        이 페이지는 해당 복사단의 Admin 권한이 있는 분들께만 보입니다.
      </div>
    </Container>
  );
};

export default AdminMain;
