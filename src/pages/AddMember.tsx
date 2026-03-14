// src/pages/AddMember.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { functions } from '@/lib/firebase';
import { useSession } from '@/state/session';
import { toast } from 'sonner';
import { callNotificationApi } from '@/lib/notificationApi';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import dayjs from 'dayjs';

import { Parish, getDioceseName } from '@/types/parish';
import { useParishes } from '@/hooks/useParishes';
import { useDioceses, Diocese } from '@/hooks/useDioceses';
import { COLLECTIONS } from '@/lib/collections';
import { 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Church, 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type ServerGroupItem = {
  id: string;
  name: string;
  parish_code: string;
};

export default function AddMember() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = useSession();
  const user = session.user;
  const { data: parishes } = useParishes(true);
  const { data: diocesesData } = useDioceses();

  // 선택 상태
  const [selectedDiocese, setSelectedDiocese] = useState<string>('');
  const [selectedParish, setSelectedParish] = useState<string>('');
  const [serverGroups, setServerGroups] = useState<ServerGroupItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // 복사 정보
  const [nameKor, setNameKor] = useState<string>('');
  const [baptismalName, setBaptismalName] = useState<string>('');
  const [grade, setGrade] = useState<string>('');
  const [startYear, setStartYear] = useState<string>(new Date().getFullYear().toString());

  // 중복 확인 관련 상태
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [duplicateMembers, setDuplicateMembers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 세션 정보(Ordo 온보딩 등)에서 성당 초기값 가져오기
  useEffect(() => {
    if (session.userInfo) {
        if (!selectedParish && session.userInfo.parishId) setSelectedParish(session.userInfo.parishId);
    }
  }, [session.userInfo, selectedParish]);

  // SSO/온보딩 직후 세션 정보가 비어 있는 케이스를 대비해 users/{uid}에서 직접 보완한다.
  useEffect(() => {
    if (!user) return;
    if (selectedParish) return;

    const fillFromUserDoc = async () => {
      try {
        const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
        if (!userSnap.exists()) return;
        const ud = userSnap.data() as any;

        if (!selectedParish) {
          const nextParish = ud.catholic_info?.parish_id || ud.parish_id || '';
          if (nextParish) setSelectedParish(nextParish);
        }
      } catch (err) {
        console.error('Failed to prefill from user profile:', err);
      }
    };

    void fillFromUserDoc();
  }, [user, selectedParish]);

  // ✅ URL 파라미터(sg) 또는 현재 세션 그룹(session.currentServerGroupId)로 초기값 세팅
  useEffect(() => {
    let targetSgId = searchParams.get('sg');
    if (!targetSgId && session.currentServerGroupId) {
        targetSgId = session.currentServerGroupId;
    }

    if (targetSgId && !selectedParish) {
        if (session.serverGroups[targetSgId]) {
             const sgInfo = session.serverGroups[targetSgId];
             setSelectedParish(sgInfo.parishCode);
        } else {
             getDoc(doc(db, COLLECTIONS.SERVER_GROUPS, targetSgId)).then((snap) => {
                 if (snap.exists()) {
                     const data = snap.data();
                     setSelectedParish(data.parish_code);
                 }
             }).catch(console.error);
        }
    }
  }, [searchParams, session.serverGroups, session.currentServerGroupId, selectedParish]);

  // 성당 선택 시 교구 자동 매칭
  useEffect(() => {
    if (selectedParish && parishes && !selectedDiocese) {
        const p = parishes.find(item => item.code === selectedParish);
        if (p) setSelectedDiocese(p.diocese);
    }
  }, [selectedParish, parishes, selectedDiocese]);

  // 성당 선택 시 복사단 목록 로드
  useEffect(() => {
    const load = async () => {
      if (!selectedParish) {
        setServerGroups([]);
        return;
      }
      const q = query(
        collection(db, COLLECTIONS.SERVER_GROUPS), 
        where('parish_code', '==', selectedParish),
        where('active', '==', true)
      );
      const snap = await getDocs(q);
      const list: ServerGroupItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setServerGroups(list);
      if (list.length === 1) setSelectedGroup(list[0].id);
      else setSelectedGroup(''); 
    };
    load();
  }, [selectedParish]);

  // URL sg 파라미터가 있을 때 그룹 자동 선택
  useEffect(() => {
      let targetSgId = searchParams.get('sg');
      if (targetSgId && serverGroups.length > 0 && !selectedGroup) {
          if (serverGroups.find(g => g.id === targetSgId)) {
              setSelectedGroup(targetSgId);
          }
      }
  }, [serverGroups, searchParams, selectedGroup]);

  const handleSubmit = async (e?: React.MouseEvent | React.FormEvent, force: boolean = false) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    if (!user) { toast.error('로그인이 필요합니다.'); return; }
    if (!selectedParish || !selectedGroup) { toast.error('성당과 복사단을 모두 선택해주세요.'); return; }
    if (!nameKor || !baptismalName || !grade || !startYear) { toast.error('이름, 세례명, 학년, 시작년도를 모두 입력해주세요.'); return; }

    if (!force) {
        try {
            const snap = await getDocs(
              collection(db, `${COLLECTIONS.SERVER_GROUPS}/${selectedGroup}/members`)
            );
            const sameNameMembers = snap.docs.filter(d => {
                const data = d.data();
                return (
                  data.parent_uid === user.uid &&
                  data.name_kor === nameKor &&
                  (data.active === true || data.request_confirmed === false)
                );
            });
            if (sameNameMembers.length > 0) {
                setDuplicateMembers(sameNameMembers.map(m => ({ id: m.id, ...m.data() })));
                setDuplicateConfirmOpen(true);
                return;
            }
        } catch (error) {
            console.error("Duplicate check failed:", error);
        }
    }

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, `${COLLECTIONS.SERVER_GROUPS}/${selectedGroup}/members`), {
        parent_uid: user.uid,
        name_kor: nameKor,
        baptismal_name: baptismalName,
        grade,
        start_year: startYear,
        active: false,
        request_confirmed: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      const membershipId = `${user.uid}_${selectedGroup}`;
      const existingMembership = await getDoc(doc(db, COLLECTIONS.MEMBERSHIPS, membershipId));
      if (!existingMembership.exists()) {
        await setDoc(doc(db, COLLECTIONS.MEMBERSHIPS, membershipId), {
          uid: user.uid,
          server_group_id: selectedGroup,
          role: ['server'],
          active: false,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }
      try {
        await callNotificationApi(functions, {
          action: 'enqueue_member_requested',
          serverGroupId: selectedGroup,
          memberName: nameKor,
        });
      } catch (notifyErr) {
        console.error('notification error:', notifyErr);
      }
      session.setCurrentServerGroupId?.(selectedGroup);
      setDuplicateConfirmOpen(false);
      toast.success('복사 등록 요청이 완료되었습니다!');
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      toast.error('오류가 발생했습니다.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-200">
      <div className="relative h-20 bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#3B82F6] rounded-b-[32px] shadow-lg overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        <div className="absolute top-4 left-6 right-6">
            <div className="space-y-0">
                <p className="text-sm font-medium text-white/90 tracking-tight font-gamja mb-0.5">복사단 활동을 위해</p>
                <h1 className="text-2xl font-bold text-white tracking-tight font-gamja">복사 추가하기</h1>
            </div>
        </div>
      </div>

      <div className="px-5 mt-2 pb-12 max-w-xl mx-auto space-y-4">
      <Card className="rounded-2xl border-0 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:bg-slate-900 overflow-hidden border-t-4 border-t-blue-500 bg-white/90 backdrop-blur-sm p-0">
        <div className="p-6 pb-3 border-b border-slate-100 dark:border-slate-700 mb-4 flex items-center gap-2">
           <User className="w-5 h-5 text-cyan-600" />
           <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 font-sans">기본 정보</h3>
        </div>
        <div className="p-6 pt-0 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">이름 (필수)</Label>
            <Input className="h-10 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all font-sans" placeholder="이름을 입력하세요" value={nameKor} onChange={(e) => setNameKor(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">세례명</Label>
            <Input className="h-10 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all font-sans" placeholder="세례명을 입력하세요" value={baptismalName} onChange={(e) => setBaptismalName(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-0 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:bg-slate-900 overflow-hidden border-t-4 border-t-indigo-500 bg-white/90 backdrop-blur-sm p-0">
        <div className="p-6 pb-3 border-b border-slate-100 dark:border-slate-700 mb-4 flex items-center gap-2">
           <Church className="w-5 h-5 text-cyan-600" />
           <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 font-sans">신앙 정보</h3>
        </div>
        <div className="p-6 pt-0 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">교구</Label>
            <Select value={selectedDiocese} onValueChange={(val) => { setSelectedDiocese(val); setSelectedParish(''); setSelectedGroup(''); }}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 border-slate-100 font-sans"><SelectValue placeholder="교구를 선택하세요" /></SelectTrigger>
                <SelectContent className="font-sans">{(diocesesData || []).map((d: Diocese) => <SelectItem key={d.code} value={d.code}>{d.name_kor}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">소속 본당</Label>
            <Select disabled={!selectedDiocese} value={selectedParish} onValueChange={(val) => { setSelectedParish(val); setSelectedGroup(''); }}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 border-slate-100 font-sans"><SelectValue placeholder="성당을 선택하세요" /></SelectTrigger>
                <SelectContent className="font-sans">{parishes?.filter(p => !selectedDiocese || p.diocese === selectedDiocese).map((p: Parish) => <SelectItem key={p.code} value={p.code}>{p.name_kor}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">복사단</Label>
            <Select disabled={!selectedParish} value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 border-slate-100 font-sans"><SelectValue placeholder="복사단을 선택하세요" /></SelectTrigger>
                <SelectContent className="font-sans">{serverGroups.map((sg) => <SelectItem key={sg.id} value={sg.id}>{sg.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">학년</Label>
                <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 border-slate-100 font-sans"><SelectValue placeholder="학년 선택" /></SelectTrigger>
                    <SelectContent className="font-sans">
                        {[
                            { val: 'E1', lab: '초등 1학년' }, { val: 'E2', lab: '초등 2학년' }, { val: 'E3', lab: '초등 3학년' },
                            { val: 'E4', lab: '초등 4학년' }, { val: 'E5', lab: '초등 5학년' }, { val: 'E6', lab: '초등 6학년' },
                            { val: 'M1', lab: '중등 1학년' }, { val: 'M2', lab: '중등 2학년' }, { val: 'M3', lab: '중등 3학년' },
                            { val: 'H1', lab: '고등 1학년' }, { val: 'H2', lab: '고등 2학년' }, { val: 'H3', lab: '고등 3학년' },
                            { val: 'etc', lab: '기타' },
                        ].map((g) => <SelectItem key={g.val} value={g.val}>{g.lab}</SelectItem>)}
                    </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-600 dark:text-slate-400 font-sans">입단년도</Label>
                <div className="flex gap-1 items-center">
                  <Button variant="outline" size="icon" className="h-10 w-9 rounded-xl" onClick={() => { const c = parseInt(startYear) || new Date().getFullYear(); setStartYear((c - 1).toString()); }}><ChevronLeft className="h-4 w-4" /></Button>
                  <Input type="number" className="h-10 rounded-xl text-center font-bold px-1 font-sans" value={startYear} onChange={(e) => setStartYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="YYYY" />
                  <Button variant="outline" size="icon" className="h-10 w-9 rounded-xl" onClick={() => { const c = parseInt(startYear) || new Date().getFullYear(); setStartYear((c + 1).toString()); }}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
          </div>
        </div>
      </Card>

      <Button
        type="button"
        className="w-full font-bold h-12 text-base shadow-sm"
        onClick={(e) => handleSubmit(e, false)}
        disabled={isSubmitting}
      >
        {isSubmitting ? '신청 처리 중...' : '복사 등록 신청하기'}
      </Button>
      <div className="text-center py-8">
        <p className="text-xs text-slate-400 mb-3">플래너(관리자)로 활동하실 예정인가요?</p>
        <button onClick={() => navigate('/request-planner-role')} className="text-xs text-blue-500 font-bold underline underline-offset-4">플래너 권한 신청 페이지로 이동</button>
      </div>

      <Dialog open={duplicateConfirmOpen} onOpenChange={setDuplicateConfirmOpen}>
        <DialogContent className="fixed left-[50%] top-[50%] z-50 w-[90%] max-w-lg translate-x-[-50%] translate-y-[-50%] border bg-white dark:bg-slate-900 p-0 shadow-2xl rounded-2xl overflow-hidden">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 border-b border-amber-100 dark:border-amber-900/30">
                <DialogTitle className="text-xl font-bold flex items-center gap-2">🚨 동일한 이름의 복사가 존재합니다</DialogTitle>
                <DialogDescription className="mt-2">이미 등록된 정보 중에 동일한 이름의 복사가 발견되었습니다.</DialogDescription>
            </div>
            <div className="p-6">
                <div className="space-y-3">
                    {duplicateMembers.map((m: any) => (
                        <div key={m.id} className="border rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex justify-between items-start mb-2">
                                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold uppercase", m.active ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}>
                                    {m.active ? "활동 중" : "승인 대기 중"}
                                </span>
                            </div>
                            <div className="font-bold text-lg">{m.name_kor} <span className="font-normal text-slate-500">({m.baptismal_name})</span></div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 mt-8">
                    <Button variant="ghost" className="flex-1" onClick={() => setDuplicateConfirmOpen(false)} disabled={isSubmitting}>취소</Button>
                    <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={(e) => handleSubmit(e, true)} disabled={isSubmitting}>
                      {isSubmitting ? '신청 처리 중...' : '그래도 신청하기'}
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
