import { useState } from 'react';
import { useSession } from '@/state/session';
import { useParishes } from '@/hooks/useParishes';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Parish } from '@/types/parish';
import { toast } from 'sonner';

export default function SuperAdminMain() {
  const session = useSession();
  const { data: parishes, refetch } = useParishes();

  const [isEditing, setIsEditing] = useState(false);
  const [editingParish, setEditingParish] = useState<Partial<Parish>>({});

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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">시스템 관리 (Super Admin)</h1>
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + 성당 추가
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름 (한글)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">교구</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {parishes?.map((p) => (
              <tr key={p.code}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name_kor}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.diocese}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {p.active !== false ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEdit(p)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(p.code)}
                    className="text-red-600 hover:text-red-900"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">성당 정보 {editingParish.code ? '수정' : '추가'}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">성당코드 (ID)</label>
                <input
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  value={editingParish.code || ''}
                  onChange={(e) => setEditingParish({...editingParish, code: e.target.value})}
                  disabled={!!editingParish.updated_at} // 수정 시 ID 변경 불가 (간단 처리)
                  placeholder="예: DAEGU-BEOMEO"
                />
                <p className="text-xs text-gray-500 mt-1">형식: 교구코드 + &apos;-&apos; + 성당코드 (영문 대문자) (예: DAEGU-BEOMEO)</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">이름 (한글)</label>
                <input
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  value={editingParish.name_kor || ''}
                  onChange={(e) => setEditingParish({...editingParish, name_kor: e.target.value})}
                  placeholder="예: 대구 범어성당"
                />
                 <p className="text-xs text-gray-500 mt-1">형식: 교구명 + &apos;(공백 1자리)&apos; + 성당명 (예: 대구 범어성당)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">이름 (영문)</label>
                <input
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  value={editingParish.name_eng || ''}
                  onChange={(e) => setEditingParish({...editingParish, name_eng: e.target.value})}
                  placeholder="예: Daegu Beomeo"
                />
                <p className="text-xs text-gray-500 mt-1">(예: Daegu Beomeo)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">교구</label>
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
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
                <label htmlFor="active-check" className="ml-2 block text-sm text-gray-900">
                  활성 상태 (Active)
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
