import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, Container, Heading } from '@/components/ui';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LogOut } from 'lucide-react';

export default function WelcomeStandby() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  return (
    <Container className="flex items-center justify-center min-h-[80vh]">
      <Card className="p-8 text-center max-w-md w-full shadow-lg border-emerald-100 bg-white/80 backdrop-blur">
        <div className="flex justify-center mb-6">
           <span className="text-4xl">👋</span>
        </div>
        
        <Heading className="text-2xl font-bold text-gray-900 mb-2">
          반갑습니다!
        </Heading>
        
        <p className="text-gray-600 mb-8 leading-relaxed">
          아직 배정된 권한이 확인되지 않았습니다.<br/>
          잠시 기다려주시거나, 아래 메뉴를 선택해주세요.
        </p>

        <div className="space-y-3">
          <Button 
            onClick={() => navigate('/', { replace: true })} 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-base"
          >
            홈으로 이동 (재시도)
          </Button>

          <Button 
            variant="outline"
            onClick={() => navigate('/add-member')} 
            className="w-full border-gray-300 text-gray-700 h-11"
          >
            복사 추가하기
          </Button>

          <Button 
            variant="ghost"
            onClick={() => navigate('/request-planner-role')} 
            className="w-full text-gray-500 h-10 hover:bg-gray-50 hover:text-gray-900"
          >
            플래너 권한 신청
          </Button>

          <div className="pt-2 mt-2 border-t border-gray-100">
            <Button 
              variant="ghost"
              onClick={handleLogout}
              className="w-full text-red-500 h-10 hover:bg-red-50 hover:text-red-700 gap-2"
            >
              <LogOut size={16} />
              로그아웃
            </Button>
          </div>
        </div>

        <p className="mt-8 text-xs text-gray-400">
          계속해서 문제가 발생하면 관리자에게 문의해주세요.
        </p>
      </Card>
    </Container>
  );
}
