import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/state/session';
import { useParishes } from '@/hooks/useParishes';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Parish } from '@/types/parish';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { Plus, User, ChevronRight, MoreHorizontal } from 'lucide-react';

export default function SuperAdminMain() {
  const session = useSession();
  const navigate = useNavigate();
  const { data: parishes, refetch } = useParishes();

  const [isEditing, setIsEditing] = useState(false);
  const [editingParish, setEditingParish] = useState<Partial<Parish>>({});
  
  const [recentUsers, setRecentUsers] = useState<any[]>([]);



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

  const handleEdit = (parish: Parish) => {
    setEditingParish(parish);
    setIsEditing(true);
  };

  const handleCreate = () => {
    setEditingParish({ active: true });
    setIsEditing(true);
  };

  const handleSave = async () => {
    const code = editingParish.code?.trim();
    const nameKor = editingParish.name_kor?.trim();
    const nameEng = editingParish.name_eng?.trim();

    if (!code || !nameKor || !editingParish.diocese) {
      toast.error('코드, 한글 이름, 교구는 필수입니다.');
      return;
    }

    try {
      // 신규 생성일 경우 중복 체크
      if (!editingParish.updated_at) {
        // 1. Code 중복 체크
        const existingDoc = await getDoc(doc(db, 'parishes', code));
        if (existingDoc.exists()) {
          toast.error(`이미 존재하는 성당코드입니다: ${code}`);
          return;
        }

        // 2. 이름(한글, 영문) 중복 체크
        const qKor = query(collection(db, 'parishes'), where('name_kor', '==', nameKor));
        const snapKor = await getDocs(qKor);
        if (!snapKor.empty) {
          toast.error(`이미 존재하는 한글 이름입니다: ${nameKor}`);
          return;
        }

        if (nameEng) {
          const qEng = query(collection(db, 'parishes'), where('name_eng', '==', nameEng));
          const snapEng = await getDocs(qEng);
          if (!snapEng.empty) {
             toast.error(`이미 존재하는 영문 이름입니다: ${nameEng}`);
             return;
          }
        }
      }
      const ref = doc(db, 'parishes', code);
      await setDoc(ref, {
        ...editingParish,
        code, // ensure trimmed
        name_kor: nameKor, // ensure trimmed
        name_eng: nameEng,
        updated_at: serverTimestamp(),
      }, { merge: true });

      toast.success('저장되었습니다.');
      setIsEditing(false);
      setEditingParish({});
      refetch();
    } catch (e) {
      console.error(e);
      toast.error('저장 실패');
    }
  };

  const handleDelete = async (code: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'parishes', code));
      toast.success('삭제되었습니다.');
      refetch();
    } catch (e) {
      console.error(e);
      toast.error('삭제 실패');
    }
  };



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
        {/* 성당 관리 섹션 */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
               성당 관리
            </h2>
             <button
                onClick={handleCreate}
                className="h-8 px-3 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md flex items-center gap-1 transition-colors"
              >
                <Plus size={14} />
                성당 추가
              </button>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
              <thead className="bg-white dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">이름 (한글)</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">교구</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">상태</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">관리</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800">
                {parishes?.map((p) => (
                  <tr key={p.code} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300 font-mono">{p.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-slate-100">{p.name_kor}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{p.diocese}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {p.active !== false ? (
                        <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50">
                          Active
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => navigate(`/superadmin/parish/${p.code}/admins`)}
                        className="text-violet-600 dark:text-violet-400 hover:text-violet-900 dark:hover:text-violet-300 font-semibold mr-3"
                      >
                        어드민관리
                      </button>
                      <Button
                        variant="edit"
                        size="sm"
                        onClick={() => handleEdit(p)}
                        className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        수정
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden p-3 space-y-2 bg-slate-50/50 dark:bg-slate-800/50">
            {parishes?.map((p) => (
              <div key={p.code} className="bg-white dark:bg-slate-900 shadow-sm rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-1">
                   <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{p.name_kor}</h3>
                      {p.active !== false ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Active"></span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" title="Inactive"></span>
                      )}
                   </div>
                   <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/superadmin/parish/${p.code}/admins`)}
                        className="bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 px-3 py-1.5 rounded text-xs font-medium transition-colors border border-violet-100 dark:border-violet-900/50"
                      >
                        어드민관리
                      </button>
                      <Button
                        size="sm"
                        variant="edit"
                        onClick={() => handleEdit(p)}
                        className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        수정
                      </Button>
                   </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span>{p.code}</span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span>{p.diocese}</span>
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* 유저 관리 섹션 */}
        <section className="mt-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-800 shadow-sm overflow-hidden">
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
          </div>
        </section>

      </div>


      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold mb-4 dark:text-slate-100">성당 정보 {editingParish.code ? '수정' : '추가'}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">성당코드 (ID)</label>
                <input
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-700 rounded-md p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  value={editingParish.code || ''}
                  onChange={(e) => setEditingParish({...editingParish, code: e.target.value})}
                  disabled={!!editingParish.updated_at} // 수정 시 ID 변경 불가 (간단 처리)
                  placeholder="예: DAEGU-BEOMEO"
                />
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">형식: 교구코드 + &apos;-&apos; + 성당코드 (영문 대문자) (예: DAEGU-BEOMEO)</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">이름 (한글)</label>
                <input
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-700 rounded-md p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  value={editingParish.name_kor || ''}
                  onChange={(e) => setEditingParish({...editingParish, name_kor: e.target.value})}
                  placeholder="예: 대구 범어성당"
                />
                 <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">형식: 교구명 + &apos;(공백 1자리)&apos; + 성당명 (예: 대구 범어성당)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">이름 (영문)</label>
                <input
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-700 rounded-md p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  value={editingParish.name_eng || ''}
                  onChange={(e) => setEditingParish({...editingParish, name_eng: e.target.value})}
                  placeholder="예: Daegu Beomeo"
                />
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">(예: Daegu Beomeo)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">교구</label>
                <select
                  className="mt-1 block w-full border border-gray-300 dark:border-slate-700 rounded-md p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  value={editingParish.diocese || ''}
                  onChange={(e) => setEditingParish({...editingParish, diocese: e.target.value})}
                >
                  <option value="">교구를 선택하세요</option>
                  {[
                    '서울대교구', '인천교구', '수원교구', '의정부교구', '춘천교구', '대전교구', 
                    '대구대교구', '부산교구', '광주교구', '전주교구', '제주교구'
                  ].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  id="active-check"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  checked={editingParish.active !== false}
                  onChange={(e) => setEditingParish({...editingParish, active: e.target.checked})}
                />
                <label htmlFor="active-check" className="ml-2 block text-sm text-gray-900 dark:text-slate-300">
                  활성 상태 (Active)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  id="sms-active-check"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  checked={editingParish.sms_service_active || false}
                  onChange={(e) => setEditingParish({...editingParish, sms_service_active: e.target.checked})}
                />
                <label htmlFor="sms-active-check" className="ml-2 block text-sm text-gray-900 dark:text-slate-300">
                  SMS 서비스 활성화 (SMS Service)
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center">
              {/* 좌측: 삭제 버튼 (수정 모드일 때만 표시) */}
              <div>
                {editingParish.updated_at && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                        if (editingParish.code) {
                            handleDelete(editingParish.code);
                            setIsEditing(false); // 수정을 완료하고 모달 닫기
                        }
                    }}
                  >
                    삭제
                  </Button>
                )}
              </div>

              {/* 우측: 취소/저장 버튼 */}
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                >
                  저장
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
