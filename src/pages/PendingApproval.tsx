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
  collection,
} from 'firebase/firestore';
import { useSession } from '@/state/session';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { COLLECTIONS } from '@/lib/collections';

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, currentServerGroupId, groupRolesLoaded } = useSession();
  const db = getFirestore();

  const [serverGroupId, setServerGroupId] = useState<string | null>(currentServerGroupId ?? null);
  const [isFading, setIsFading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('세션 동기화 중...');
  const [isMemberType, setIsMemberType] = useState<'membership' | 'member'>('membership');

  // ✅ Fallback: serverGroupId가 없으면 Firestore에서 직접 찾기
  useEffect(() => {
    const fetchGroupIfMissing = async () => {
      if (serverGroupId || !user) return;
      console.log('🔍 serverGroupId missing, searching Firestore...');

      // 1. memberships 컬렉션 먼저 확인 (Planner/Admin 등)
      const qMembership = query(
        collection(db, COLLECTIONS.MEMBERSHIPS), 
        where('uid', '==', user.uid)
      );
      const snapMembership = await getDocs(qMembership);
      
      if (!snapMembership.empty) {
        const data = snapMembership.docs[0].data();
        setServerGroupId(data.server_group_id);
        setIsMemberType('membership');
        return;
      }

      // 2. members 서브컬렉션 확인 (복사단원 등)
      // Note: members 서브컬렉션에는 uid 필드가 있을 수도 있고, id가 uid일 수도 있음
      const qMember = query(collectionGroup(db, 'members'), where('uid', '==', user.uid));
      const snapMember = await getDocs(qMember);
      
      if (!snapMember.empty) {
        const path = snapMember.docs[0].ref.path;
        // Path: app_datas/ordo-altar/server_groups/{sgId}/members/{id}
        const parts = path.split('/');
        const sgId = parts[3];
        setServerGroupId(sgId);
        setIsMemberType('member');
      } else {
        console.warn('❌ No membership/member record found for user');
      }
    };
    fetchGroupIfMissing();
  }, [user, db, serverGroupId]);

  // ✅ 승인 감시 로직
  useEffect(() => {
    if (!user || !serverGroupId || !groupRolesLoaded) return;

    setStatusMsg('승인을 기다리는 중입니다...');

    // 감시할 레퍼런스 결정
    let ref;
    if (isMemberType === 'membership') {
      // app_altar/v1/memberships/{uid}_{sgId} 형식일 가능성이 큼 (또는 쿼리 결과의 ID 사용)
      // 안전하게 쿼리로 다시 찾거나, 복합 ID 규칙 사용
      ref = doc(db, COLLECTIONS.MEMBERSHIPS, `${user.uid}_${serverGroupId}`);
    } else {
      ref = doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'members', user.uid);
    }

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        // 만약 복합 ID가 아니라면 쿼리로 찾아야 함
        return;
      }
      
      const data = snap.data();
      console.log('📡 Approval status check:', data);

      if (data.active === true || data.active === 'true') {
        console.log('✅ Approved! Redirecting...');
        setIsFading(true);
        setTimeout(() => {
          navigate(`/server-groups/${serverGroupId}`, { replace: true });
        }, 400);
      }
    });

    return () => unsubscribe();
  }, [user, serverGroupId, groupRolesLoaded, navigate, db, isMemberType]);

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
          <span className="text-blue-600 font-semibold">메인 페이지</span>로 자동 이동합니다.
        </p>

        <div className="flex flex-col items-center justify-center mt-4">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
          <span className="text-sm text-gray-500 italic">{statusMsg}</span>
        </div>
      </Card>
    </div>
  );
}
