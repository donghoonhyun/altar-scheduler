import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';

interface Member {
  id: string;
  name_kor: string;
  baptismal_name: string;
  grade: string;
  notes?: string;
}

const gradeOptions = [
  '초1',
  '초2',
  '초3',
  '초4',
  '초5',
  '초6',
  '중1',
  '중2',
  '중3',
  '고1',
  '고2',
  '고3',
  '성인',
];

export default function ServerList() {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 복사단 정보
  const [groupName, setGroupName] = useState<string>('');

  // 수정 모달
  const [selected, setSelected] = useState<Member | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);

  // 등록 모달
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newMember, setNewMember] = useState<Omit<Member, 'id'>>({
    name_kor: '',
    baptismal_name: '',
    grade: '',
    notes: '',
  });

  useEffect(() => {
    if (!serverGroupId) return;
    const db = getFirestore();

    // 복사단 정보 불러오기
    const fetchGroupInfo = async () => {
      const sgRef = doc(db, 'server_groups', serverGroupId);
      const sgSnap = await getDoc(sgRef);
      if (sgSnap.exists()) {
        setGroupName((sgSnap.data() as { name?: string }).name || '');
      }
    };

    // 복사단원 불러오기
    const fetchMembers = async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, 'server_groups', serverGroupId, 'members'));
      setMembers(
        snap.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<Member, 'id'>;
          return { id: docSnap.id, ...data };
        })
      );
      setLoading(false);
    };

    fetchGroupInfo();
    fetchMembers();
  }, [serverGroupId]);

  // 저장 (수정)
  const handleSave = async () => {
    if (!serverGroupId || !selected) return;
    if (!selected.name_kor || !selected.baptismal_name || !selected.grade) {
      alert('이름, 세례명, 학년은 필수 입력 항목입니다.');
      return;
    }
    const db = getFirestore();
    const ref = doc(db, 'server_groups', serverGroupId, 'members', selected.id);
    await updateDoc(ref, {
      name_kor: selected.name_kor,
      baptismal_name: selected.baptismal_name,
      grade: selected.grade,
      notes: selected.notes || '',
    });
    setMembers((prev) => prev.map((m) => (m.id === selected.id ? { ...selected } : m)));
    setShowModal(false);
  };

  // 삭제
  const handleDelete = async () => {
    if (!serverGroupId || !selected) return;
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    const db = getFirestore();
    const ref = doc(db, 'server_groups', serverGroupId, 'members', selected.id);
    await deleteDoc(ref);
    setMembers((prev) => prev.filter((m) => m.id !== selected.id));
    setShowModal(false);
  };

  // 신규 등록
  const handleAdd = async () => {
    if (!serverGroupId) return;
    if (!newMember.name_kor || !newMember.baptismal_name || !newMember.grade) {
      alert('이름, 세례명, 학년은 필수 입력 항목입니다.');
      return;
    }
    const db = getFirestore();
    const colRef = collection(db, 'server_groups', serverGroupId, 'members');
    const docRef = await addDoc(colRef, newMember);
    setMembers((prev) => [...prev, { id: docRef.id, ...newMember }]);
    setNewMember({ name_kor: '', baptismal_name: '', grade: '', notes: '' });
    setShowAddModal(false);
  };

  if (!serverGroupId) {
    return <div className="p-4">잘못된 경로입니다.</div>;
  }

  return (
    <div className="p-4">
      {/* 상단: 복사단명 + 등록 버튼 */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{groupName || '복사단'} 인원 명단</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1 bg-green-600 text-white rounded"
        >
          + 복사단원 등록
        </button>
      </div>

      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <table className="table-auto border w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">이름</th>
              <th className="p-2 border">세례명</th>
              <th className="p-2 border">학년</th>
              <th className="p-2 border">비고</th>
              <th className="p-2 border">관리</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="p-2 border">{m.name_kor}</td>
                <td className="p-2 border">{m.baptismal_name}</td>
                <td className="p-2 border">{m.grade}</td>
                <td className="p-2 border">{m.notes || '-'}</td>
                <td className="p-2 border text-center">
                  <button
                    onClick={() => {
                      setSelected(m);
                      setShowModal(true);
                    }}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                  >
                    수정
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center p-4 text-gray-500">
                  등록된 복사단원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* 수정 모달 */}
      {showModal && selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">복사단원 수정</h3>
            <div className="space-y-3">
              <input
                type="text"
                className="w-full border p-2 rounded"
                placeholder="이름"
                value={selected.name_kor}
                onChange={(e) => setSelected({ ...selected, name_kor: e.target.value })}
              />
              <input
                type="text"
                className="w-full border p-2 rounded"
                placeholder="세례명"
                value={selected.baptismal_name}
                onChange={(e) => setSelected({ ...selected, baptismal_name: e.target.value })}
              />
              {/* 학년: 드롭다운 */}
              <select
                className="w-full border p-2 rounded"
                value={selected.grade}
                onChange={(e) => setSelected({ ...selected, grade: e.target.value })}
              >
                <option value="">학년 선택</option>
                {gradeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="w-full border p-2 rounded"
                placeholder="비고"
                value={selected.notes || ''}
                onChange={(e) => setSelected({ ...selected, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={handleDelete} className="px-3 py-1 bg-red-500 text-white rounded">
                삭제
              </button>
              <div className="space-x-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1 bg-gray-300 rounded"
                >
                  취소
                </button>
                <button onClick={handleSave} className="px-3 py-1 bg-green-600 text-white rounded">
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 등록 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">복사단원 등록</h3>
            <div className="space-y-3">
              <input
                type="text"
                className="w-full border p-2 rounded"
                placeholder="이름"
                value={newMember.name_kor}
                onChange={(e) => setNewMember({ ...newMember, name_kor: e.target.value })}
              />
              <input
                type="text"
                className="w-full border p-2 rounded"
                placeholder="세례명"
                value={newMember.baptismal_name}
                onChange={(e) => setNewMember({ ...newMember, baptismal_name: e.target.value })}
              />
              <select
                className="w-full border p-2 rounded"
                value={newMember.grade}
                onChange={(e) => setNewMember({ ...newMember, grade: e.target.value })}
              >
                <option value="">학년 선택</option>
                {gradeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="w-full border p-2 rounded"
                placeholder="비고"
                value={newMember.notes || ''}
                onChange={(e) => setNewMember({ ...newMember, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end mt-6 space-x-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1 bg-gray-300 rounded"
              >
                취소
              </button>
              <button onClick={handleAdd} className="px-3 py-1 bg-green-600 text-white rounded">
                등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
