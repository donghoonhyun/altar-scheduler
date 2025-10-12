// src/pages/ServerSurvey.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface MassEventDoc {
  id: string;
  title: string;
  date: Timestamp | Date;
}

export default function ServerSurvey() {
  const { serverGroupId, yyyymm } = useParams<{ serverGroupId: string; yyyymm: string }>();
  const db = getFirestore();
  const auth = getAuth();
  const [user, loadingUser] = useAuthState(auth);

  const [events, setEvents] = useState<MassEventDoc[]>([]);
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const [isAllAvailable, setIsAllAvailable] = useState(false);
  const [surveyClosed, setSurveyClosed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasExistingResponse, setHasExistingResponse] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ 데이터 불러오기 (설문 상태 + 기존 응답)
  useEffect(() => {
    const fetchSurveyData = async () => {
      if (!serverGroupId || !yyyymm) return;
      try {
        setLoading(true);

        // 설문 상태 확인
        const surveyRef = doc(db, `server_groups/${serverGroupId}/availability_surveys/${yyyymm}`);
        const surveySnap = await getDoc(surveyRef);
        if (!surveySnap.exists() || surveySnap.data().status !== 'OPEN') {
          setSurveyClosed(true);
          setLoading(false);
          return;
        }

        // 미사 일정 로드
        const startOfMonth = dayjs(yyyymm + '01')
          .startOf('month')
          .toDate();
        const endOfMonth = dayjs(yyyymm + '01')
          .endOf('month')
          .toDate();
        const q = query(
          collection(db, `server_groups/${serverGroupId}/mass_events`),
          where('date', '>=', startOfMonth),
          where('date', '<=', endOfMonth),
          orderBy('date')
        );
        const snap = await getDocs(q);
        const list: MassEventDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MassEventDoc, 'id'>),
        }));
        setEvents(list);

        // ✅ 기존 응답 로드
        if (user) {
          const responseRef = doc(
            db,
            `server_groups/${serverGroupId}/availability_responses/${user.uid}_${yyyymm}`
          );
          const responseSnap = await getDoc(responseRef);
          if (responseSnap.exists()) {
            const r = responseSnap.data();
            const ids = Object.keys(r.unavailable || {});
            setUnavailableIds(ids);
            setIsAllAvailable(ids.length === 0);
            setHasExistingResponse(true); // ✅ 기존 응답 존재
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchSurveyData();
  }, [serverGroupId, yyyymm, user]);

  // ✅ 불가 일정 토글
  const handleToggle = (eventId: string) => {
    if (isAllAvailable) setIsAllAvailable(false);
    setUnavailableIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  // ✅ 모든 일정 가능
  const handleAllAvailable = () => {
    setIsAllAvailable(!isAllAvailable);
    if (!isAllAvailable) setUnavailableIds([]);
  };

  // ✅ 제출 (새 문서 생성 or 기존 응답 덮어쓰기)
  const handleSubmit = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (surveyClosed) {
      toast.warning('이 설문은 이미 종료되었습니다.');
      return;
    }
    if (!isAllAvailable && unavailableIds.length === 0) {
      toast.warning('참석 불가한 일정을 선택하거나, 모든 일정에 참석 가능합니다를 체크하세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      const ref = doc(
        db,
        `server_groups/${serverGroupId}/availability_responses/${user.uid}_${yyyymm}`
      );

      const unavailable: Record<string, false> = {};
      const dates: string[] = [];

      unavailableIds.forEach((id) => {
        unavailable[id] = false;
        const ev = events.find((e) => e.id === id);
        if (ev) {
          const dateStr = dayjs(ev.date instanceof Timestamp ? ev.date.toDate() : ev.date).format(
            'YYYYMMDD'
          );
          dates.push(dateStr);
        }
      });

      // ✅ merge:true → 기존 응답 덮어쓰기 허용
      await setDoc(
        ref,
        {
          server_group_id: serverGroupId,
          uid: user.uid,
          yyyymm,
          unavailable: unavailableIds.length > 0 ? unavailable : {},
          dates: unavailableIds.length > 0 ? dates : [],
          submitted_at: serverTimestamp(),
        },
        { merge: true }
      );

      toast.success('✅ 설문이 제출되었습니다.');
      setSubmitted(true);
      setHasExistingResponse(true); // ✅ 이후 버튼명 변경
    } catch (err) {
      console.error(err);
      toast.error('제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ 로딩 중
  if (loading || loadingUser) return <LoadingSpinner label="데이터 로딩 중..." />;

  // ✅ 설문 종료
  if (surveyClosed)
    return (
      <div className="p-6 text-center text-gray-600">
        <h2 className="text-xl font-semibold mb-2">📋 설문이 종료되었습니다.</h2>
        <p>이 설문은 더 이상 수정할 수 없습니다.</p>
      </div>
    );

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4 text-center">✝️ 복사 설문 ({yyyymm})</h2>

      <Alert variant="default" className="mb-4">
        참석이 불가능한 일정만 선택하세요.
        <br />
        모든 일정에 참석 가능한 경우 아래 체크박스를 선택해주세요.
      </Alert>

      <div className="space-y-3">
        {events.map((ev) => {
          const dateObj = ev.date instanceof Timestamp ? ev.date.toDate() : ev.date;
          const formatted = dayjs(dateObj).format('M월 D일 (ddd)');
          return (
            <div
              key={ev.id}
              className="flex items-center justify-between border rounded-md p-2 hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium">{ev.title}</p>
                <p className="text-xs text-gray-500">{formatted}</p>
              </div>
              <Checkbox
                checked={unavailableIds.includes(ev.id)}
                onCheckedChange={() => handleToggle(ev.id)}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t pt-3 flex items-center">
        <Checkbox checked={isAllAvailable} onCheckedChange={handleAllAvailable} />
        <span className="ml-2 text-sm text-gray-700">모든 일정에 참석 가능합니다</span>
      </div>

      <Button
        disabled={isSubmitting}
        onClick={handleSubmit}
        className="w-full mt-5 bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isSubmitting ? '제출 중...' : hasExistingResponse ? '변경 제출' : '제출'}
      </Button>

      {submitted && (
        <p className="text-center text-green-600 text-sm mt-3">✅ 변경사항이 저장되었습니다.</p>
      )}
    </div>
  );
}
