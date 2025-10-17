import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function PendingApproval() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen text-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-sm w-full">
        <h2 className="text-2xl font-bold mb-3 text-blue-700">🙏 승인 대기 중입니다</h2>
        <p className="text-gray-600 mb-6">
          플래너가 회원가입을 승인한 후에 이용할 수 있습니다.
          <br />
          승인까지 다소 시간이 걸릴 수 있습니다. 승인이 늦어지면 플래너에게 별도 채널로 요청하시기
          바랍니다.
        </p>
        <button
          onClick={handleLogout}
          className="w-full py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
