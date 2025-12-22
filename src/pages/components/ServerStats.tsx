// src/pages/components/ServerStats.tsx
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';

interface ServerStatsProps {
  parishCode: string;
  serverGroupId: string;
}

const ServerStats: React.FC<ServerStatsProps> = ({ parishCode, serverGroupId }) => {
  const [memberCount, setMemberCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [surveyCount, setSurveyCount] = useState<{ responses: number; total: number }>({
    responses: 0,
    total: 0,
  });

  const navigate = useNavigate();
  const db = getFirestore();

  useEffect(() => {
    const fetchMembers = async () => {
      const snap = await getDocs(collection(db, 'server_groups', serverGroupId, 'members'));
      
      // request_confirmed가 true 이거나 undefined(기존 데이터)인 멤버 포함, false(승인 대기)는 제외
      const count = snap.docs.filter(d => {
        const rc = d.data().request_confirmed;
        return rc === true || rc === undefined;
      }).length;
      setMemberCount(count);
      
      const pending = snap.docs.filter(d => {
        const data = d.data();
        return data.active === false && !data.request_confirmed;
      }).length;
      setPendingCount(pending);
    };

    const fetchSurvey = async () => {
      const now = new Date();
      const monthId = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      const respSnap = await getDocs(
        collection(db, 'server_groups', serverGroupId, 'availability_surveys', monthId, 'responses')
      );

      setSurveyCount({
        responses: respSnap.size,
        total: memberCount,
      });
    };

    if (serverGroupId) {
      fetchMembers().then(fetchSurvey);
    }
  }, [serverGroupId, memberCount, db]);

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-4">
      <h2 className="text-lg font-semibold mb-2">
        복사단 현황 <span className="text-sm font-normal text-gray-400 ml-1">(총 {memberCount}명)</span>
      </h2>

      <div className="flex justify-between text-sm mb-4">
        <div className="flex flex-col gap-1">
          {pendingCount > 0 && (
            <div className="text-red-600 font-bold text-xs animate-pulse">
              신청 대기중: {pendingCount}명
            </div>
          )}
        </div>
        <div className="text-right">
          설문 응답:{' '}
          <span className="font-bold">
            {surveyCount.responses}/{surveyCount.total}
          </span>
        </div>
      </div>

      {/* ✅ 복사단 명단 관리 버튼 */}
      <Button
        variant="primary"
        onClick={() => navigate(`/server-groups/${serverGroupId}/servers`)}
        className="w-full"
      >
        복사단 명단 관리하기
      </Button>
    </div>
  );
};

export default ServerStats;
