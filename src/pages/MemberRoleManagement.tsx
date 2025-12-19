import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Container, Card, Heading, Button } from '@/components/ui';
import { ArrowLeft, User, Shield, Calendar, Edit2, Check, X, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

interface MembershipWithUser {
  id: string;
  uid: string;
  role: string[];
  parish_code: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  user_name?: string;
  baptismal_name?: string;
  email?: string;
}

const MemberRoleManagement: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<MembershipWithUser[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);

  const fetchMemberships = async () => {
    if (!serverGroupId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'memberships'),
        where('server_group_id', '==', serverGroupId)
      );
      const snap = await getDocs(q);
      
      const membershipData = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const userDoc = await getDoc(doc(db, 'users', data.uid));
          const userData = userDoc.exists() ? userDoc.data() : {};
          
          return {
            id: d.id,
            ...data,
            role: Array.isArray(data.role) ? data.role : [data.role],
            user_name: userData.user_name || 'Unknown',
            baptismal_name: userData.baptismal_name || '',
            email: userData.email || '',
          } as MembershipWithUser;
        })
      );
      
      setMemberships(membershipData);
    } catch (err) {
      console.error('Failed to fetch memberships:', err);
      toast.error('멤버 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberships();
  }, [serverGroupId]);

  const handleEdit = (m: MembershipWithUser) => {
    setEditingId(m.id);
    setEditRoles(m.role);
  };

  const toggleRole = (role: string) => {
    setEditRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role]
    );
  };

  const handleUpdate = async (id: string) => {
    if (editRoles.length === 0) {
      toast.error('최소 하나 이상의 역할이 필요합니다.');
      return;
    }

    try {
      await updateDoc(doc(db, 'memberships', id), {
        role: editRoles,
        updated_at: Timestamp.now()
      });
      toast.success('역할이 수정되었습니다.');
      setEditingId(null);
      fetchMemberships();
    } catch (err) {
      console.error('Update role failed:', err);
      toast.error('역할 수정에 실패했습니다.');
    }
  };

  const availableRoles = ['admin', 'planner', 'server'];

  return (
    <Container className="py-8 min-h-screen">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </Button>
        <div>
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900">
            멤버 역할 관리
          </Heading>
          <p className="text-gray-500 text-sm">
            복사단의 멤버별 권한과 정보를 관리합니다.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                <th className="px-4 py-2">사용자</th>
                <th className="px-4 py-2">역할</th>
                <th className="px-4 py-2">정보</th>
                <th className="px-4 py-2 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    로딩 중...
                  </td>
                </tr>
              ) : memberships.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    멤버 정보가 없습니다.
                  </td>
                </tr>
              ) : (
                memberships.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                          <User size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">
                            {m.user_name} {m.baptismal_name && <span className="text-gray-500 text-xs font-normal">({m.baptismal_name})</span>}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {editingId === m.id ? (
                        <div className="flex flex-wrap gap-1">
                          {availableRoles.map(r => (
                            <button
                              key={r}
                              onClick={() => toggleRole(r)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                                editRoles.includes(r)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                            >
                              {r === 'admin' ? '어드민' : r === 'planner' ? '플래너' : '복사'}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {m.role.map(r => (
                            <span 
                              key={r} 
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                r === 'admin' ? 'bg-purple-100 text-purple-600' :
                                r === 'planner' ? 'bg-blue-100 text-blue-600' :
                                'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {r === 'admin' ? '어드민' : r === 'planner' ? '플래너' : '복사'}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="space-y-0.5 text-[10px] text-gray-500">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Info size={10} />
                          <span>성당: {m.parish_code}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={10} />
                          <span>생성/수정: {m.created_at ? format(m.created_at.toDate(), 'yy.MM.dd') : '-'}/{m.updated_at ? format(m.updated_at.toDate(), 'yy.MM.dd') : '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {editingId === m.id ? (
                        <div className="flex justify-end gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-green-600 hover:bg-green-50"
                            onClick={() => handleUpdate(m.id)}
                          >
                            <Check size={14} />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                            onClick={() => setEditingId(null)}
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => handleEdit(m)}
                        >
                          <Edit2 size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      <div className="mt-8 bg-blue-50 p-6 rounded-2xl border border-blue-100 flex gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
          <Shield size={24} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 mb-1">역할 부여 안내</h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            한 멤버에게 여러 역할을 동시에 부여할 수 있습니다. 
            변경 사항은 저장 즉시 반영되며 다음 로그인부터 해당 권한이 활성화됩니다.
            어드민은 모든 설정을 변경할 수 있으며, 플래너는 일정 관리 권한을 가집니다.
          </p>
        </div>
      </div>
    </Container>
  );
};

export default MemberRoleManagement;
