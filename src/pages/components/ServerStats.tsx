// src/pages/components/ServerStats.tsx
import React, { useEffect, useState } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { PARISH_MAP } from '../../config/parishes'; // ✅ named export 사용

interface ServerStatsProps {
  parishCode: string;
  serverGroupId: string;
}

const ServerStats: React.FC<ServerStatsProps> = ({ parishCode, serverGroupId }) => {
  const [memberCount, setMemberCount] = useState<number>(0);
  const [surveyCount, setSurveyCount] = useState<{ responses: number; total: number }>({
    responses: 0,
    total: 0,
  });

  useEffect(() => {
    const db = getFirestore();

    // 📌 1) 복사단원 수 불러오기
    const fetchMembers = async () => {
      const snap = await getDocs(collection(db, 'server_groups', serverGroupId, 'members'));
      setMemberCount(snap.size);
    };

    // 📌 2) 이번 달 설문 응답 현황 (monthId = YYYYMM)
    const fetchSurvey = async () => {
      const now = new Date();
      const monthId = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      const respSnap = await getDocs(
        collection(db, 'server_groups', serverGroupId, 'availability_surveys', monthId, 'responses')
      );

      setSurveyCount({
        responses: respSnap.size,
        total: memberCount, // 총원 = members 수 기준
      });
    };

    if (serverGroupId) {
      fetchMembers().then(fetchSurvey);
    }
  }, [serverGroupId, memberCount]);

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-4">
      <h2 className="text-lg font-semibold mb-2">복사단 현황</h2>
      <p className="text-sm text-gray-500 mb-3">
        본당: {PARISH_MAP[parishCode]?.name_kor || parishCode} <br />
        복사단 코드: {serverGroupId}
      </p>
      <div className="flex justify-between text-sm">
        <div>
          <span className="font-bold">{memberCount}</span> 명 등록됨
        </div>
        <div>
          설문 응답:{' '}
          <span className="font-bold">
            {surveyCount.responses}/{surveyCount.total}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ServerStats;
