import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

import type { MassEventDoc, AvailabilityDoc } from "../types/firestore";

interface SurveyCount {
  preferred: number;
  available: number;
  unavailable: number;
}

interface MassSurvey {
  massId: string;
  title: string;
  date: string;
  counts: SurveyCount;
}

export default function SurveyStatus() {
  const { parishId } = useParams<{ parishId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MassSurvey[]>([]);

  useEffect(() => {
    if (!parishId) return;

    async function fetchSurvey() {
      setLoading(true);
      try {
        // 1. 미사 일정 불러오기
        const massSnap = await getDocs(
          collection(db, "parishes", parishId!, "mass_events")
        );

        const massEvents: (MassEventDoc & { id: string })[] = massSnap.docs.map(
          (doc) => ({
            id: doc.id,
            ...(doc.data() as MassEventDoc),
          })
        );

        // 2. 설문 응답 불러오기
        const availSnap = await getDocs(
          collection(db, "parishes", parishId!, "availability")
        );

        const countsMap: Record<string, SurveyCount> = {};
        massEvents.forEach((m) => {
          countsMap[m.id] = { preferred: 0, available: 0, unavailable: 0 };
        });

        availSnap.docs.forEach((doc) => {
          const data = doc.data() as AvailabilityDoc;
          const availability = data.availability || {};

          Object.entries(availability).forEach(([date, status]) => {
            const target = massEvents.find((m) => m.date === date);
            if (!target) return;

            if (status === "PREFERRED") countsMap[target.id].preferred++;
            if (status === "AVAILABLE") countsMap[target.id].available++;
            if (status === "UNAVAILABLE") countsMap[target.id].unavailable++;
          });
        });

        // 3. 최종 데이터 조합
        const result: MassSurvey[] = massEvents.map((m) => ({
          massId: m.id,
          title: m.title,
          date: m.date,
          counts: countsMap[m.id],
        }));

        setData(result);
      } catch (err) {
        console.error("설문 현황 불러오기 오류:", err);
        setError("데이터 로드 실패");
      } finally {
        setLoading(false);
      }
    }

    fetchSurvey();
  }, [parishId]);

  if (loading) return <div className="p-6">불러오는 중...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">가용성 설문 현황</h1>

      <div className="space-y-4">
        {data.map((m) => (
          <div
            key={m.massId}
            className="p-4 border rounded-lg bg-white dark:bg-gray-800"
          >
            <h2 className="text-lg font-semibold">
              {m.title} ({m.date})
            </h2>
            <div className="flex gap-4 mt-2">
              <span className="px-2 py-1 bg-green-200 dark:bg-green-700 rounded">
                선호: {m.counts.preferred}
              </span>
              <span className="px-2 py-1 bg-blue-200 dark:bg-blue-700 rounded">
                가능: {m.counts.available}
              </span>
              <span className="px-2 py-1 bg-red-200 dark:bg-red-700 rounded">
                불가: {m.counts.unavailable}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
