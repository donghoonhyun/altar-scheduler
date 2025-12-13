import React, { useState, useEffect } from 'react';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  DocumentData,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import dayjs from 'dayjs';
import { fromLocalDateToFirestore } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import type { MemberDoc } from '@/types/firestore';
import type {
  CreateMassEventRequest,
  CreateMassEventResponse,
} from '../../../functions/src/massEvents/createMassEvent';

interface MassEventDrawerProps {
  eventId?: string;
  date: Date | null;
  serverGroupId: string;
  onClose: () => void;
  monthStatus?: string;
}

const MassEventDrawer: React.FC<MassEventDrawerProps> = ({
  eventId,
  date,
  serverGroupId,
  onClose,
  monthStatus,
}) => {
  const db = getFirestore();

  const [title, setTitle] = useState('');
  const [requiredServers, setRequiredServers] = useState<number | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [mainMemberId, setMainMemberId] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string; grade: string }[]>([]);
  const [unavailableMembers, setUnavailableMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showUnavailableWarning, setShowUnavailableWarning] = useState(false);

  // ✅ 복사단 멤버 목록 불러오기
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const ref = collection(db, 'server_groups', serverGroupId, 'members');
        const snaps = await getDocs(ref);

        const list = snaps.docs
          .map((d) => {
            const data = d.data() as MemberDoc;
            return {
              docId: d.id,  // Firestore document ID
              data
            };
          })
          .filter(({ data: m }) => m.name_kor && m.baptismal_name)
          .map(({ docId, data: m }) => {
            const gradeStr = String(m.grade || '')
              .trim()
              .toUpperCase(); // ✅ 문자열 강제 변환
            const grade = [
              'E1',
              'E2',
              'E3',
              'E4',
              'E5',
              'E6',
              'M1',
              'M2',
              'M3',
              'H1',
              'H2',
              'H3',
            ].includes(gradeStr)
              ? gradeStr
              : '기타';

            const memberId = m.uid || docId;
            
            return {
              id: memberId,  // Use uid if available, otherwise Firestore document ID
              name: `${m.name_kor} ${m.baptismal_name}`,
              grade,
            };
          })
          .sort((a, b) => {
            const order = [
              'E1',
              'E2',
              'E3',
              'E4',
              'E5',
              'E6',
              'M1',
              'M2',
              'M3',
              'H1',
              'H2',
              'H3',
              '기타',
            ];
            const idxA = order.indexOf(a.grade);
            const idxB = order.indexOf(b.grade);
            if (idxA !== idxB) return idxA - idxB;
            return a.name.localeCompare(b.name, 'ko');
          });

        setMembers(list);
        // console.log(
        //   '✅ members loaded:',
        //   list.map((m) => `${m.grade}-${m.name}`)
        // ); // 디버깅용 로그
      } catch (err) {
        console.error('❌ members load error:', err);
      }
    };
    fetchMembers();
  }, [db, serverGroupId]);

  // ✅ 기존 이벤트 불러오기
  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      try {
        const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as DocumentData;
          
          setTitle(data.title || '');
          setRequiredServers(data.required_servers || null);
          const loadedMemberIds = (data.member_ids as string[]) || [];
          setMemberIds(loadedMemberIds);
          setMainMemberId(data.main_member_id || null);
        }
      } catch (err) {
        console.error('❌ 이벤트 불러오기 오류:', err);
      }
    };
    fetchEvent();
  }, [eventId, serverGroupId, db]);

  // ✅ Fetch survey responses to identify unavailable members
  useEffect(() => {
    const fetchSurveyData = async () => {
      if (!date) return;
      
      try {
        const yyyymm = dayjs(date).format('YYYYMM');
        const surveyRef = doc(db, `server_groups/${serverGroupId}/availability_surveys/${yyyymm}`);
        const surveySnap = await getDoc(surveyRef);
        
        if (surveySnap.exists()) {
          const surveyData = surveySnap.data();
          const responses = surveyData.responses || {};
          const unavailableMap = new Map<string, string[]>();
          
          Object.entries(responses).forEach(([memberId, response]: [string, any]) => {
            let unavailableIds: string[] = [];
            if (Array.isArray(response.unavailable)) {
              unavailableIds = response.unavailable;
            } else if (response.unavailable && typeof response.unavailable === 'object') {
              unavailableIds = Object.keys(response.unavailable);
            }
            
            if (unavailableIds.length > 0) {
              unavailableMap.set(memberId, unavailableIds);
            }
          });
          
          // For the current event, find which members marked it as unavailable
          if (eventId) {
            const unavailableSet = new Set<string>();
            unavailableMap.forEach((eventIds, memberId) => {
              if (eventIds.includes(eventId)) {
                unavailableSet.add(memberId);
              }
            });
            setUnavailableMembers(unavailableSet);
          }
        }
      } catch (err) {
        console.error('❌ Survey data fetch error:', err);
      }
    };
    
    fetchSurveyData();
  }, [eventId, date, serverGroupId, db]);

  // ✅ 복사 선택 토글
  const toggleMember = (id: string) => {
    const isUnavailable = unavailableMembers.has(id);
    
    if (isUnavailable && !memberIds.includes(id)) {
      setShowUnavailableWarning(true);
      setTimeout(() => setShowUnavailableWarning(false), 3000);
    }
    
    setMemberIds((prev) => {
      const newIds = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      
      // If removing main member, clear main member selection
      if (!newIds.includes(mainMemberId || '')) {
        setMainMemberId(null);
      }
      
      return newIds;
    });
  };

  // ✅ 저장 처리
  const handleSave = async () => {
    if (!title || !requiredServers || (!eventId && !date)) {
      setErrorMsg('모든 필드를 입력해주세요.');
      return;
    }

    // ✅ 선택 인원 검증 (정확히 동일해야 함) - 단, 미확정(MASS-NOTCONFIRMED) 상태일 땐 검증 스킵
    const isPlanPhase = monthStatus === 'MASS-NOTCONFIRMED';
    if (!isPlanPhase && memberIds.length !== requiredServers) {
      setErrorMsg(
        `필요 인원(${requiredServers}명)에 맞게 정확히 ${requiredServers}명을 선택해야 합니다. (현재 ${memberIds.length}명 선택됨)`
      );
      return;
    }
    
    // Validate main member selection
    if (!isPlanPhase && memberIds.length > 0 && !mainMemberId) {
      setErrorMsg('주복사를 선택해주세요.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const groupSnap = await getDoc(doc(db, 'server_groups', serverGroupId));
      const tz = (groupSnap.data()?.timezone as string) || 'Asia/Seoul';

      if (eventId) {
        const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
        await setDoc(
          ref,
          {
            title,
            required_servers: requiredServers,
            member_ids: memberIds,
            main_member_id: mainMemberId,
            updated_at: serverTimestamp(),
          },
          { merge: true }
        );
        console.log(`✅ MassEvent updated: ${eventId}`);
      } else {
        const functions = getFunctions();
        const createMassEvent = httpsCallable<CreateMassEventRequest, CreateMassEventResponse>(
          functions,
          'createMassEvent'
        );

        const localMidnight = fromLocalDateToFirestore(date!, tz);
        const formattedDate = dayjs(localMidnight).format('YYYY-MM-DD[T]00:00:00');
        const res = await createMassEvent({
          serverGroupId,
          title,
          date: formattedDate,
          requiredServers,
        });
        if (!res.data.success) throw new Error(res.data.error || '저장 실패');
      }

      onClose();
    } catch (err) {
      console.error('❌ 저장 오류:', err);
      setErrorMsg('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 삭제 처리
  const handleDelete = async () => {
    if (!eventId) return;
    if (!window.confirm('이 미사 일정을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      const ref = doc(db, 'server_groups', serverGroupId, 'mass_events', eventId);
      await deleteDoc(ref);
      console.log(`🗑️ MassEvent deleted: ${eventId}`);
      onClose();
    } catch (err) {
      console.error('❌ 삭제 오류:', err);
      setErrorMsg('삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 학년별 그룹핑
  const groupedMembers = Object.entries(
    members.reduce<Record<string, { id: string; name: string }[]>>((acc, m) => {
      const grade = m.grade || '기타';
      if (!acc[grade]) acc[grade] = [];
      acc[grade].push({ id: m.id, name: m.name });
      return acc;
    }, {})
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md h-full fixed right-0 top-0 p-6 flex flex-col bg-white shadow-2xl overflow-y-auto fade-in">
        {/* Header */}
        <div className="space-y-1">
          <DialogTitle>
            📝 {eventId ? '미사 일정 수정' : '미사 일정 등록'}
            {date && (
              <span className="ml-2 text-base font-normal text-gray-600">
                ({dayjs(date).format('M월 D일 (ddd)')})
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            미사 일정을 새로 등록하거나 기존 일정을 수정합니다.
          </DialogDescription>
        </div>
        
        <div className="border-b border-gray-200" />

        {/* Body */}
        <div className="flex flex-col gap-4 text-sm text-gray-700">
          {/* 미사 제목 */}
          <label className="block">
            <span className="font-medium">미사 제목</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border rounded px-2 py-1"
              placeholder="예: 주일 11시 미사"
              disabled={loading}
            />
          </label>

          {/* 필요 인원 */}
          <label className="block">
            <span className="font-medium">필요 인원</span>
            <div className="flex gap-2 mt-1 flex-wrap">
              {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
                <label key={n} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="requiredServers"
                    value={n}
                    checked={requiredServers === n}
                    onChange={() => setRequiredServers(n)}
                    disabled={loading}
                  />
                  {n}명
                </label>
              ))}
            </div>
          </label>

          {/* 기 배정된 복사 표시 */}
          {eventId && (
            <div className="block">
              <span className="font-medium">배정된 복사</span>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                {memberIds.length === 0 ? (
                  <p className="text-sm text-gray-500">배정된 복사가 없습니다.</p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-gray-500">로딩 중...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {memberIds.map(id => {
                      const member = members.find(m => m.id === id);
                      const isMain = id === mainMemberId;
                      return (
                        <span key={id} className={`px-2 py-1 rounded text-sm ${
                          isMain ? 'bg-blue-600 text-white font-bold' : member ? 'bg-white border' : 'bg-orange-100 border border-orange-300'
                        }`}>
                          {member ? `${member.name} ${isMain ? '(주복사)' : ''}` : `ID: ${id.substring(0, 8)}... (미확인)`}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 복사 배정 (학년별 그룹) - 미확정 상태에서는 숨김 */}
          {monthStatus !== 'MASS-NOTCONFIRMED' && (
            <label className="block">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">배정 복사 선택</span>
                {showUnavailableWarning && (
                  <span className="text-xs text-orange-600 font-medium animate-pulse">
                    ⚠️ 불참으로 설문한 복사입니다
                  </span>
                )}
              </div>
              <div className="mt-2 border rounded p-3 max-h-[420px] overflow-y-auto space-y-3">
                {groupedMembers.map(([grade, list]) => (
                  <div key={grade} className="space-y-1">
                    {/* 학년 헤더 */}
                    <div className="text-sm font-semibold text-gray-700 border-b border-gray-300 pb-0.5 mb-1">
                      {grade}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {list.map((m) => {
                        const isUnavailable = unavailableMembers.has(m.id);
                        const isSelected = memberIds.includes(m.id);
                        const isMain = m.id === mainMemberId;
                        
                        return (
                          <div key={m.id} className="space-y-1">
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                value={m.id}
                                checked={isSelected}
                                onChange={() => toggleMember(m.id)}
                                disabled={loading}
                              />
                              <span className={isUnavailable ? 'text-orange-600 font-medium' : ''}>
                                {m.name}
                              </span>
                            </label>
                            {isSelected && (
                              <label className="flex items-center gap-1 ml-5 text-xs">
                                <input
                                  type="radio"
                                  name="mainMember"
                                  checked={isMain}
                                  onChange={() => setMainMemberId(m.id)}
                                  disabled={loading}
                                />
                                <span className="text-blue-600">주복사</span>
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                정확히 {requiredServers ?? '-'}명 선택하고, 한 명을 주복사로 지정해주세요.
              </p>
            </label>
          )}

          {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

          {/* 하단 버튼 */}
          <div className="flex justify-end gap-2 mt-6">
            {eventId && (
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={loading}
                className="text-red-600 border-red-400"
              >
                삭제
              </Button>
            )}
            <DialogClose asChild>
              <Button variant="outline" disabled={loading}>
                취소
              </Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? '저장 중...' : eventId ? '수정' : '저장'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MassEventDrawer;
