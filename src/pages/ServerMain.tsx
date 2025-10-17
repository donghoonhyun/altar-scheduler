// src/pages/ServerMain.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import dayjs from 'dayjs';
import { Card, Heading, Container, Button } from '@/components/ui';
import { toast } from 'sonner';
import { useSession } from '@/state/session';

export default function ServerMain() {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const session = useSession();

  const [events, setEvents] = useState<any[]>([]);
  const [surveyOpen, setSurveyOpen] = useState(false);

  const currentMonth = dayjs().format('YYYYMM');

  // ✅ 미사 일정 불러오기
  useEffect(() => {
    const loadEvents = async () => {
      if (!serverGroupId) return;
      try {
        const q = query(
          collection(db, 'server_groups', serverGroupId, 'mass_events'),
          orderBy('date')
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setEvents(list);
      } catch (err) {
        console.error(err);
        toast.error('미사 일정 불러오기 오류');
      }
    };
    loadEvents();
  }, [serverGroupId]);

  // ✅ 설문 상태 확인
  useEffect(() => {
    const checkSurvey = async () => {
      if (!serverGroupId) return;
      try {
        const surveyRef = doc(
          db,
          `server_groups/${serverGroupId}/availability_surveys/${currentMonth}`
        );
        const sSnap = await getDoc(surveyRef);
        if (sSnap.exists() && sSnap.data().status === 'OPEN') {
          setSurveyOpen(true);
        } else {
          setSurveyOpen(false);
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkSurvey();
  }, [serverGroupId, currentMonth]);

  const handleGoSurvey = () => {
    navigate(`/survey/${serverGroupId}/${currentMonth}`);
  };

  return (
    <Container className="py-8 fade-in">
      <Heading size="lg" className="mb-4">
        🙏 복사 메인 페이지
      </Heading>

      {/* ✅ 인사 섹션 */}
      <Card className="mb-6 text-center">
        <p className="text-lg font-semibold mb-1">{session.user?.displayName || '복사님'}</p>
        <p className="text-gray-600 mb-2">{dayjs().format('YYYY년 M월')} 미사 일정입니다.</p>
        {surveyOpen && (
          <Button variant="primary" size="md" onClick={handleGoSurvey}>
            ✉️ 이번 달 설문 참여하기
          </Button>
        )}
      </Card>

      {/* ✅ 일정 달력(단순 리스트형) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((ev) => {
          const isMyMass = ev.member_ids?.includes(session.user?.uid);
          return (
            <Card
              key={ev.id}
              className={`p-4 border ${
                isMyMass ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <h3 className="font-semibold text-gray-800">{ev.title}</h3>
              <p className="text-sm text-gray-500">
                {dayjs(ev.date?.toDate?.() || ev.date).format('YYYY년 M월 D일 (ddd)')}
              </p>
              <div className="mt-2 text-sm">
                {ev.member_names ? (
                  ev.member_names.map((n: string) => (
                    <span
                      key={n}
                      className={`inline-block mr-2 mb-1 px-2 py-0.5 rounded-md ${
                        n === session.user?.displayName
                          ? 'bg-blue-100 text-blue-700 font-semibold'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400">배정 대기 중</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </Container>
  );
}
