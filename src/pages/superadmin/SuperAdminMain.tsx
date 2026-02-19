import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/state/session';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, getDocs, limit, orderBy } from 'firebase/firestore';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { User, ChevronRight, Settings, Sparkles } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function SuperAdminMain() {
  const session = useSession();
  const navigate = useNavigate();

  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  // AI Settings State
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState('');
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);

  // Fetch AI Settings & Body Scroll Lock
  useEffect(() => {
    if (showAiSettings) {
        // Lock Scroll
        document.body.style.overflow = 'hidden';
        
        const fetchSettings = async () => {
            try {
                const ref = doc(db, 'system_settings/ai_config');
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    const tmpl = data.prompt_analyze_monthly_assignments?.template || data.prompt_template || '';
                    setPromptTemplate(tmpl);
                }
            } catch (e) {
                console.error('Failed to fetch AI settings', e);
            }
        };
        fetchSettings();
    } else {
        // Unlock Scroll
        document.body.style.overflow = 'unset';
    }

    return () => {
        document.body.style.overflow = 'unset';
    };
  }, [showAiSettings]);


  useEffect(() => {
    const fetchRecentUsers = async () => {
        try {
            const q = query(
                collection(db, 'users'), 
                orderBy('updated_at', 'desc'), 
                limit(3)
            );
            const snap = await getDocs(q);
            setRecentUsers(snap.docs.map(d => ({uid: d.id, ...d.data()})));
        } catch (e) {
            console.error(e);
        }
    };
    fetchRecentUsers();
  }, []);

  if (!session.loading && !session.isSuperAdmin) {
    return (
      <div className="p-10 text-center text-red-500 font-bold">
        접근 권한이 없습니다. (Super Admin Only)
      </div>
    );
  }

  return (
    <div className="-m-2 min-h-screen bg-slate-200 dark:bg-transparent pb-20">
      {/* Header Section */}
      <div className="py-12 text-center">
        <div className="relative inline-block">
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight relative z-10">
             시스템 관리 (Super Admin)
          </h1>
          <div className="absolute -bottom-2 left-0 w-full h-4 bg-purple-300/60 dark:bg-purple-900/60 -z-0 rounded-sm transform -rotate-1" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* 유저 관리 섹션 */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
               유저 관리
            </h2>
             <button
                onClick={() => navigate('/superadmin/users')}
                className="h-8 px-3 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md flex items-center gap-1 transition-colors"
              >
                더보기
                <ChevronRight size={14} />
              </button>
          </div>

          {/* Desktop Table: Hidden on Mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
              <thead className="bg-white dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">이름 / 세례명</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">이메일</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">전화번호</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">최근 수정</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800">
                {recentUsers.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">
                            최근 활동한 유저가 없습니다.
                        </td>
                    </tr>
                ) : (
                    recentUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                    <User size={16} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{u.user_name}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{u.baptismal_name}</div>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">{u.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-slate-400 dark:text-slate-500">
                            {u.updated_at?.toDate().toLocaleString()}
                        </td>
                    </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile List View */}
          <div className="md:hidden p-3 space-y-2 bg-slate-50/50 dark:bg-slate-800/50">
            {recentUsers.length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-400 text-sm">
                    최근 활동한 유저가 없습니다.
                </div>
            ) : (
                <>
                    {recentUsers.map((u) => (
                    <div key={u.uid} className="bg-white dark:bg-slate-900 shadow-sm rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-2">
                             <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0">
                                      <User size={16} />
                                 </div>
                                 <div>
                                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                         {u.user_name}
                                         {u.baptismal_name && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({u.baptismal_name})</span>}
                                      </div>
                                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                         {u.updated_at?.toDate().toLocaleString()}
                                      </div>
                                 </div>
                             </div>
                        </div>
                        
                        <div className="flex flex-col gap-1 pl-10">
                            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                               <span className="text-slate-400 dark:text-slate-500 w-10">이메일</span> 
                               <span className="truncate">{u.email}</span>
                            </div>
                             <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                               <span className="text-slate-400 dark:text-slate-500 w-10">연락처</span> 
                               <span>{u.phone || '-'}</span>
                            </div>
                        </div>
                    </div>
                    ))}
                </>
            )}
          </div>
        </section>

        {/* 알림 관리 섹션 */}
        <section className="mt-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-800 shadow-sm overflow-hidden mb-10">
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
               알림 관리
            </h2>
          </div>
          <div className="p-6">
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-white">SMS 문자 서비스</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    발송 테스트 및 전체 발송 이력을 조회합니다.
                  </p>
                </div>
                <Button 
                  onClick={() => navigate('/superadmin/sms')}
                  className="gap-2"
                >
                  SMS문자 관리
                </Button>
             </div>

             <div className="my-4 border-t border-slate-100 dark:border-slate-800" />

             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-white">Notification 관리</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    전체 앱 푸시 발송 이력을 조회하고 관리합니다.
                  </p>
                </div>
                <Button 
                  onClick={() => navigate('/superadmin/notifications')}
                  className="gap-2 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                  variant="outline"
                >
                  Notification 관리
                </Button>
             </div>
          </div>
        </section>

        {/* AI 관리 섹션 */}
        <section className="mt-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-800 shadow-sm overflow-hidden mb-10">
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
               AI 관리
            </h2>
          </div>
          <div className="p-6">
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-white">배정 결과 분석 AI</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    [AI 배정 분석] 기능에 사용되는 프롬프트를 수정합니다.
                  </p>
                </div>
                <Button 
                  onClick={() => setShowAiSettings(true)}
                  className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Sparkles size={16} />
                  Prompt-배정결과분석
                </Button>
             </div>
          </div>
        </section>
      </div>

      {/* AI Settings Modal */}
      {showAiSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-lg shadow-xl border dark:border-slate-700 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Settings size={18} /> AI 프롬프트 설정 (배정결과분석)
                    </h3>
                    <button onClick={() => setShowAiSettings(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                        ✕
                    </button>
                </div>
                <div className="p-4 flex-1 overflow-hidden flex flex-col">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md mb-3 text-xs text-yellow-800 dark:text-yellow-200 border border-yellow-100 dark:border-yellow-900/30">
                        주의: 프롬프트를 수정하면 모든 성당의 분석 결과에 영향을 미칩니다. 
                        <code>{'{{variable}}'}</code> 형식은 AI가 데이터를 삽입하는 위치이므로 삭제하지 않도록 주의하세요.
                    </div>
                    <div className="flex gap-2 mb-2 text-xs text-purple-600 dark:text-purple-400 flex-wrap font-mono">
                        <span className="bg-purple-50 dark:bg-purple-900/20 px-1 rounded">{'{{yyyymm}}'}</span>
                        <span className="bg-purple-50 dark:bg-purple-900/20 px-1 rounded">{'{{totalMembers}}'}</span>
                        <span className="bg-purple-50 dark:bg-purple-900/20 px-1 rounded">{'{{assignedCount}}'}</span>
                        <span className="bg-purple-50 dark:bg-purple-900/20 px-1 rounded">{'{{dataList}}'}</span>
                        <span className="bg-purple-50 dark:bg-purple-900/20 px-1 rounded">{'{{thisMonthTotal}}'}</span>
                        <span className="bg-purple-50 dark:bg-purple-900/20 px-1 rounded">{'{{prevMonthAssignedCount}}'}</span>
                    </div>
                    <textarea 
                        className="flex-1 w-full p-3 text-sm border rounded-md font-mono bg-gray-50 dark:bg-slate-900 dark:border-slate-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 outline-none resize-y min-h-[400px] leading-relaxed"
                        value={promptTemplate}
                        onChange={(e) => setPromptTemplate(e.target.value)}
                        placeholder="프롬프트 내용을 입력하세요..."
                    />
                </div>
                <div className="p-4 border-t dark:border-slate-700 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAiSettings(false)}>취소</Button>
                    <Button 
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        disabled={isSavingAiSettings}
                        onClick={async () => {
                            setIsSavingAiSettings(true);
                            try {
                                await setDoc(doc(db, 'system_settings/ai_config'), { 
                                    prompt_analyze_monthly_assignments: {
                                        template: promptTemplate,
                                        updated_at: serverTimestamp()
                                    }
                                }, { merge: true });
                                setShowAiSettings(false);
                                toast.success('프롬프트 설정이 저장되었습니다.');
                            } catch(e) {
                                console.error(e);
                                toast.error('저장 실패');
                            } finally {
                                setIsSavingAiSettings(false);
                            }
                        }}
                    >
                        {isSavingAiSettings ? <LoadingSpinner size="sm" /> : '저장하기'}
                    </Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
