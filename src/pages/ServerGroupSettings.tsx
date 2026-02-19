import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Container, Card, Heading, Button, Input, Label, InfoBox } from '@/components/ui';
import { ArrowLeft, Save, Info, Plus, X, MessageSquare, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/state/session';
import { COLLECTIONS } from '@/lib/collections';

const ServerGroupSettings: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [parishSmsActive, setParishSmsActive] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    parish_code: '',
    active: true,
    sms_service_active: false,
    sms_reminder_template: '',
  });

  // Calculate bytes for Korean (approx 2 bytes) and others (1 byte)
  const getByteLength = (s: string) => {
    let b = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        b += c >> 11 ? 2 : 1;
    }
    return b;
  };

  // 복사단 생성 관련 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);


  useEffect(() => {
    const fetchSgInfo = async () => {
      if (!serverGroupId) return;
      try {
        const sgDoc = await getDoc(doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId));
        if (sgDoc.exists()) {
          const data = sgDoc.data();
          const pCode = data.parish_code || '';
          
          setFormData({
            name: data.name || '',
            parish_code: pCode,
            active: data.active !== false,
            sms_service_active: data.sms_service_active === true,
            sms_reminder_template: data.sms_reminder_template || '[알림] 내일({date}) {title} {name} 복사 배정이 있습니다. 늦지 않게 준비바랍니다.',
          });

          // Fetch Parish Settings
          if (pCode) {
             const parishDoc = await getDoc(doc(db, COLLECTIONS.PARISHES, pCode));
             if (parishDoc.exists()) {
                 setParishSmsActive(parishDoc.data().sms_service_active === true);
             }
          }
        }
      } catch (err) {
        console.error('Failed to fetch server group info:', err);
        toast.error('복사단 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchSgInfo();
  }, [serverGroupId]);

  const handleCreateNew = async () => {
    if (!newGroupName.trim()) {
      toast.error('새 복사단 이름을 입력해주세요.');
      return;
    }
    if (!formData.parish_code || !session.user) {
      toast.error('성당 코드 또는 사용자 정보를 찾을 수 없습니다.');
      return;
    }

    setCreating(true);
    try {
      const counterRef = doc(db, COLLECTIONS.COUNTERS, COLLECTIONS.SERVER_GROUPS);
      
      const newSgId = await runTransaction(db, async (transaction) => {
        // 1) 카운터 조회 및 증가
        const counterDoc = await transaction.get(counterRef);
        let nextSeq = 1;
        if (counterDoc.exists()) {
          nextSeq = (counterDoc.data().last_seq || 0) + 1;
        }
        transaction.set(counterRef, { last_seq: nextSeq }, { merge: true });

        // 2) SG00000 포맷 ID 생성
        const sgId = `SG${nextSeq.toString().padStart(5, '0')}`;
        const sgRef = doc(db, COLLECTIONS.SERVER_GROUPS, sgId);

        // 3) 복사단 문서 생성
        transaction.set(sgRef, {
          parish_code: formData.parish_code,
          name: newGroupName,
          active: true,
          sms_service_active: false, // Default OFF
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });

        // 4) 생성자를 해당 복사단의 어드민/플래너로 등록 (선택 사항이나 보통 필요함)
        const membershipId = `${session.user?.uid}_${sgId}`;
        const membershipRef = doc(db, COLLECTIONS.MEMBERSHIPS, membershipId);
        transaction.set(membershipRef, {
          uid: session.user?.uid,
          server_group_id: sgId,
          parish_code: formData.parish_code,
          role: ['admin', 'planner'],
          active: true,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });

        return sgId;
      });

      console.log('New SG Created Directly:', newSgId);
      
      // 5) 세션 갱신 (새로운 역할을 State에 반영)
      await session.refreshSession?.();

      toast.success(`새로운 복사단(${newSgId})이 성공적으로 생성되었습니다!`);
      setIsModalOpen(false);
      setNewGroupName('');
      
      // 생성 후 해당 그룹으로 이동
      navigate(`/server-groups/${newSgId}/admin/settings`);
      
    } catch (err) {
      console.error('Failed to create server group directly:', err);
      toast.error('복사단 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!serverGroupId) return;
    if (!formData.name.trim()) {
      toast.error('복사단 이름을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId), {
        name: formData.name,
        active: formData.active,
        sms_service_active: formData.sms_service_active, 
        sms_reminder_template: formData.sms_reminder_template,
        updated_at: Timestamp.now(),
      });
      
      toast.success('복사단 정보가 성공적으로 수정되었습니다.');
      // 세션 정보 갱신을 위해 필요한 경우 처리 (여기서는 단순 내비게이션 혹은 새로고침 유도)
      // 실제로는 전역 상태 업데이트가 필요할 수 있음
      navigate(-1);
    } catch (err) {
      console.error('Failed to update server group info:', err);
      toast.error('정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container className="py-12 text-center text-gray-500">
        정보를 불러오는 중...
      </Container>
    );
  }

  return (
    <Container className="py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <Heading size="lg" className="text-2xl font-extrabold text-gray-900">
              복사단 설정
            </Heading>
            <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-purple-200 text-purple-600 hover:bg-purple-50 rounded-xl"
                onClick={() => setIsModalOpen(true)}
            >
              <Plus size={18} /> 새 복사단
            </Button>
          </div>
          <p className="text-gray-500 text-sm">
            복사단의 기본 정보 및 운영 설정을 관리합니다.
          </p>
        </div>
      </div>

      {/* 새 복사단 생성 모달 (직접 구현) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <Heading size="md" className="text-xl font-bold">새 복사단 생성</Heading>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label className="text-sm font-bold">성당 (Code)</Label>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-500 font-medium">
                  {formData.parish_code}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-name" className="text-sm font-bold">복사단 이름</Label>
                <Input 
                  id="new-name" 
                  placeholder="예: 학생 복사단" 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                    variant="ghost" 
                    className="flex-1" 
                    onClick={() => setIsModalOpen(false)}
                    disabled={creating}
                >
                  취소
                </Button>
                <Button 
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={handleCreateNew}
                    disabled={creating}
                >
                  {creating ? '생성 중...' : '생성하기'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card className="p-6 border-none shadow-sm space-y-6">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="sg-id" className="text-sm font-bold text-gray-700">복사단 ID</Label>
            <Input id="sg-id" value={serverGroupId} disabled className="bg-gray-50 text-gray-400 border-gray-100" />
            <p className="text-[10px] text-gray-400">시스템에서 할당된 고유 ID입니다. 변경할 수 없습니다.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="parish-code" className="text-sm font-bold text-gray-700">성당 코드</Label>
            <Input id="parish-code" value={formData.parish_code} disabled className="bg-gray-50 text-gray-400 border-gray-100" />
          </div>

          <hr className="border-gray-50 my-2" />

          <div className="grid gap-2">
            <Label htmlFor="name" className="text-sm font-bold text-gray-700">복사단 이름</Label>
            <Input 
              id="name" 
              placeholder="예: 초등부복사단" 
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          </div>

          <div className="flex items-center gap-3 pt-2">
            <input 
              type="checkbox" 
              id="active" 
              className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
              checked={formData.active}
              onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
            />
            <Label htmlFor="active" className="text-sm font-bold text-gray-700 cursor-pointer">
              복사단 활성화 상태
            </Label>
          </div>

          <hr className="border-gray-50 my-2" />

          {/* SMS Notification Settings */}
          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-700 p-1.5 rounded-lg">
                        <MessageSquare size={16} />
                    </span>
                    <Label className="text-sm font-bold text-gray-800">문자(SMS) 알림 발송 설정</Label>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${parishSmsActive ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                        성당 설정: {parishSmsActive ? 'ON' : 'OFF'}
                    </span>
                </div>
             </div>
             
             <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700 space-y-4">
                <div className="flex items-start gap-3">
                    <input 
                      type="checkbox" 
                      id="sms_active" 
                      className="mt-1 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 disabled:opacity-50"
                      checked={formData.sms_service_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, sms_service_active: e.target.checked }))}
                      disabled={!parishSmsActive} 
                    />
                    <div className="flex-1">
                        <Label htmlFor="sms_active" className={`text-sm font-bold block mb-1 cursor-pointer ${!parishSmsActive && 'opacity-50'}`}>
                           문자 알림 서비스 켜기
                        </Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                           중요 알림(미사 배정, 변경사항 등)을 학부모님께 문자로 발송합니다.<br/>
                           <span className="text-amber-600 font-medium">* 비용이 발생하므로 성당 설정이 ON 상태여야 활성화할 수 있습니다.</span>
                        </p>
                    </div>
                </div>

                {!parishSmsActive && (
                    <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
                        <ShieldAlert size={14} />
                        성당의 SMS 설정이 꺼져 있어 활성화할 수 없습니다. 관리자에게 문의하세요.
                    </div>
                )}

                {/* SMS Template Setting */}
                {parishSmsActive && formData.sms_service_active && (
                    <div className="pt-2 border-t border-gray-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                        <Label htmlFor="sms_template" className="text-sm font-bold block mb-1.5">
                            미사 SMS 리마인더 문구 
                            <span className="text-xs font-normal text-gray-500 ml-2">
                                * 최대 50자(한글 기준 약 90Byte)
                            </span>
                        </Label>
                        <textarea
                            id="sms_template"
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-700"
                            value={formData.sms_reminder_template}
                            onChange={(e) => {
                                const newVal = e.target.value;
                                // Simple Byte Limit Check (90 bytes usually, safe 80 bytes)
                                // Let's enforce soft limit UI but hard limit somewhat?
                                // User requested "limit". I'll just warn or stop input.
                                // Let's stop input if length > 80 chars for now to be safe, but actually check bytes.
                                if (getByteLength(newVal) <= 90) {
                                    setFormData(prev => ({ ...prev, sms_reminder_template: newVal }));
                                }
                            }}
                            placeholder="[알림] 내일({date}) {title} {name} 복사 배정이 있습니다."
                        />
                        <div className="flex justify-between items-start mt-1.5">
                            <p className="text-[11px] text-gray-400">
                                사용 가능 변수: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{`{date}`}</code>(날짜), <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{`{title}`}</code>(미사명), <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{`{name}`}</code>(복사명)
                            </p>
                            <span className={`text-[11px] font-mono ${getByteLength(formData.sms_reminder_template) > 80 ? 'text-amber-500 font-bold' : 'text-gray-400'}`}>
                                {getByteLength(formData.sms_reminder_template)} / 90 bytes
                            </span>
                        </div>
                    </div>
                )}
             </div>
          </div>


        <div className="pt-4 border-t border-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>
            취소
          </Button>
          <Button 
            className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white flex gap-2 items-center"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '저장 중...' : <><Save size={18} /> 설정 저장하기</>}
          </Button>
        </div>
      </Card>

      <InfoBox title="주의" className="mt-8">
        복사단 이름을 변경하면 모든 단원의 화면에 즉시 반영됩니다. 
        비활성화(`Active` 해제) 처리 시 일반 단원들은 더 이상 이 복사단 정보에 접근할 수 없게 됩니다.
      </InfoBox>
    </Container>
  );
};

export default ServerGroupSettings;
