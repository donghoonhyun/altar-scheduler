import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import dayjs from "dayjs";
import { Card, Heading, Container, Button } from "@/components/ui";
import { toast } from "sonner";
import { useSession } from "@/state/session";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MassEventDoc } from "@/types/firestore";

/**
 * ✅ ServerMain.tsx
 * --------------------------------------------------------
 * - 복사(Server) 로그인 사용자의 메인 홈 화면
 * - 성당명 + 복사명(세례명) 표시 (Firestore members/{uid})
 * - 월별 상태(MASS-CONFIRMED / FINAL-CONFIRMED) 반영
 * - 미니 달력: 미사 일정이 있는 날짜 표시 + 배정일 강조
 * - 미사 개수만큼 점(dot) 표시
 * --------------------------------------------------------
 */
export default function ServerMain() {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const session = useSession();

  const [groupName, setGroupName] = useState<string>("");
  const [events, setEvents] = useState<MassEventDoc[]>([]);
  const [monthStatus, setMonthStatus] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [userName, setUserName] = useState<string>("");
  const [baptismalName, setBaptismalName] = useState<string>("");

  // ✅ 로그인 복사 이름 / 세례명 가져오기 (uid 타이밍 보장)
  useEffect(() => {
    const loadMemberInfo = async () => {
      if (!session.user?.uid) return; // uid가 없으면 실행 안함
      try {
        const ref = doc(db, "members", session.user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setUserName(data.name_kor || "");
          setBaptismalName(data.baptismal_name || "");
        } else {
          setUserName(session.user.displayName || "");
        }
      } catch (err) {
        console.error(err);
        toast.error("복사 정보 불러오기 오류");
      }
    };
    loadMemberInfo();
  }, [session.user?.uid]);

  // ✅ 성당명 가져오기
  useEffect(() => {
    if (!serverGroupId) return;
    const fetchGroup = async () => {
      try {
        const ref = doc(db, "server_groups", serverGroupId);
        const snap = await getDoc(ref);
        if (snap.exists()) setGroupName(snap.data().name || "");
      } catch (err) {
        console.error(err);
        toast.error("성당 정보 불러오기 오류");
      }
    };
    fetchGroup();
  }, [serverGroupId]);

  // ✅ 월 상태 확인
  useEffect(() => {
    if (!serverGroupId) return;
    const fetchStatus = async () => {
      try {
        const yyyymm = currentMonth.format("YYYYMM");
        const ref = doc(db, `server_groups/${serverGroupId}/month_status/${yyyymm}`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setMonthStatus(snap.data().status || "MASS-NOTCONFIRMED");
        } else {
          setMonthStatus("MASS-NOTCONFIRMED");
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStatus();
  }, [serverGroupId, currentMonth]);

  // ✅ 미사 일정 불러오기
  useEffect(() => {
    if (!serverGroupId) return;
    const loadEvents = async () => {
      try {
        const q = query(
          collection(db, "server_groups", serverGroupId, "mass_events"),
          orderBy("date")
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as MassEventDoc)
        );
        setEvents(list);
      } catch (err) {
        console.error(err);
        toast.error("미사 일정 불러오기 오류");
      }
    };
    loadEvents();
  }, [serverGroupId, currentMonth]);

  // ✅ 월 이동
  const handlePrevMonth = () => setCurrentMonth((prev) => prev.subtract(1, "month"));
  const handleNextMonth = () => setCurrentMonth((prev) => prev.add(1, "month"));

  // ✅ 설문 페이지 이동
  const handleGoSurvey = () => {
    navigate(`/survey/${serverGroupId}/${currentMonth.format("YYYYMM")}`);
  };

  // ✅ 달력 데이터
  const daysInMonth = currentMonth.daysInMonth();
  const startDay = currentMonth.startOf("month").day();
  const daysArray = Array.from({ length: startDay + daysInMonth }, (_, i) =>
    i < startDay ? null : i - startDay + 1
  );

  // ✅ 날짜 클릭 (Drawer 열기 예정)
  const handleDayClick = (dateNum: number | null) => {
    if (!dateNum) return;
    const date = currentMonth.date(dateNum);
    console.log("📅 Drawer open:", date.format("YYYY-MM-DD"));
  };

  return (
    <Container className="py-6 fade-in">
      {/* 상단 헤더 */}
      <div className="mb-4">
        <Heading size="md" className="text-blue-700">
          ✝️ {groupName}
        </Heading>
        <p className="text-sm text-gray-600 mt-0.5">
          {userName
            ? `${userName}${baptismalName ? ` (${baptismalName})` : ""} 복사님`
            : "복사님 정보를 불러오는 중입니다..."}
        </p>
      </div>

      {/* 상태 카드 */}
      <Card className="p-4 mb-5 flex flex-col gap-2">
        {/* 🔹 월 이동 + 상태 표시 */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-lg font-semibold text-gray-800">
              {currentMonth.format("YYYY년 M월")}
            </span>
            <Button variant="ghost" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <span
            className={`text-sm font-semibold ${
              monthStatus === "FINAL-CONFIRMED"
                ? "text-green-700"
                : monthStatus === "MASS-CONFIRMED"
                ? "text-blue-700"
                : "text-gray-500"
            }`}
          >
            {monthStatus === "FINAL-CONFIRMED"
              ? "🛡️ 최종 확정"
              : monthStatus === "MASS-CONFIRMED"
              ? "🔒 일정 확정 (설문 가능)"
              : "🕓 미확정"}
          </span>
        </div>

        {/* 🔹 안내 메시지 / 버튼 */}
        {monthStatus === "MASS-CONFIRMED" && (
          <div className="text-center mt-2">
            <p className="text-sm text-gray-600 mb-2">
              이번 달 설문에 참여해주세요.
            </p>
            <Button variant="primary" size="md" onClick={handleGoSurvey}>
              ✉️ 설문 페이지로 이동
            </Button>
          </div>
        )}

        {monthStatus === "FINAL-CONFIRMED" && (
          <p className="text-center text-sm text-gray-600 mt-2">
            아래 달력에서 본인 배정 일자를 확인하세요 🙏
          </p>
        )}
      </Card>

      {/* ✅ 미니 달력 */}
      <div className="grid grid-cols-7 gap-1 text-center text-sm mb-8">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d} className="font-semibold text-gray-600 py-1">
            {d}
          </div>
        ))}

        {daysArray.map((day, idx) => {
          if (day === null) return <div key={idx} className="h-14" />;

          const dateObj = currentMonth.date(day);
          const dayEvents = events.filter((ev) =>
            dayjs(ev.date?.toDate?.() || ev.date).isSame(dateObj, "day")
          );

          // ✅ 내 배정일 여부
          const userId = session.user?.uid;
          const isMyMass =
            !!userId && dayEvents.some((ev) => ev.member_ids?.includes(userId));

          // ✅ 미사 개수만큼 점(dot) 표시
          const dots = Array.from({ length: Math.min(dayEvents.length, 3) });

          return (
            <div
              key={idx}
              onClick={() => handleDayClick(day)}
              className={`
                relative h-14 flex flex-col items-center justify-center rounded-md cursor-pointer transition
                ${
                  isMyMass
                    ? "bg-blue-500 border border-blue-600 text-white font-bold shadow-md"
                    : dayEvents.length > 0
                    ? "bg-rose-100 border border-rose-200 text-rose-800 font-semibold"
                    : "text-gray-300"
                }
                hover:scale-[1.03] hover:shadow-sm
              `}
            >
              <span>{day}</span>

              {/* ✅ 하단 점 표시 */}
              {dayEvents.length > 0 && (
                <div className="absolute bottom-1 flex gap-0.5">
                  {dots.map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        isMyMass ? "bg-white" : "bg-rose-500"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Container>
  );
}
