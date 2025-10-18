import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getFirestore,
  doc,
  onSnapshot,
  collectionGroup,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { useSession } from '@/state/session';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, currentServerGroupId, groupRolesLoaded } = useSession();
  const db = getFirestore();

  const [serverGroupId, setServerGroupId] = useState<string | null>(currentServerGroupId ?? null);
  const [isFading, setIsFading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('세션 동기화 중...');

  // ✅ Fallback: 세션에 serverGroupId 없으면 Firestore에서 직접 찾기
  useEffect(() => {
    const fetchGroupIfMissing = async () => {
      if (serverGroupId || !user) return;
      console.log('🔍 serverGroupId not found in session, searching Firestore...');

      const q = query(collectionGroup(db, 'members'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const path = snap.docs[0].ref.path;
        const sgId = path.split('/')[1]; // server_groups/{id}/members/{uid}
        // console.log('✅ found serverGroupId:', sgId);
        setServerGroupId(sgId);
      } else {
        console.warn('❌ No serverGroup membership found for user');
      }
    };
    fetchGroupIfMissing();
  }, [user, db, serverGroupId]);

  // ✅ 승인 감시 로직
  useEffect(() => {
    if (!user || !serverGroupId || !groupRolesLoaded) return;

    // console.log('👀 start watching:', serverGroupId, user.uid);
    setStatusMsg('플래너의 승인을 기다리는 중입니다...');

    const ref = doc(db, `server_groups/${serverGroupId}/members/${user.uid}`);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      console.log('📡 snapshot:', data);

      if (data.active === true || data.active === 'true') {
        console.log('✅ 승인 감지 → 이동 준비');
        setIsFading(true);
        setTimeout(() => {
          navigate(`/${serverGroupId}/server-main`, { replace: true });
        }, 400);
      }
    });

    return () => unsubscribe();
  }, [user, serverGroupId, groupRolesLoaded, navigate, db]);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 pt-20 px-4">
      <Card
        className={`max-w-sm w-full text-center p-8 rounded-2xl shadow-lg transition-all duration-500 ${
          isFading ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
        }`}
      >
        <h2 className="text-3xl font-extrabold text-blue-700 mb-3">
          🙏 가입을 환영합니다! <br /> (승인대기중)
        </h2>
        <p className="text-gray-700 text-base leading-relaxed mb-5">
          복사단 플래너의 승인 즉시{' '}
          <span className="text-blue-600 font-semibold">복사 메인 페이지</span>로 자동 이동합니다.
        </p>

        <div className="flex flex-col items-center justify-center mt-4">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
          <span className="text-sm text-gray-500 italic">{statusMsg}</span>
        </div>
      </Card>
    </div>
  );
}
