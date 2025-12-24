import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  setDoc,
  getDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Container, Heading, Card } from '@/components/ui';
import { useSession } from '@/state/session';
import { ArrowLeft } from 'lucide-react';

interface RoleRequest {
  uid: string;
  email: string;
  user_name: string;
  baptismal_name: string;
  phone: string;
  role: 'planner';
  status: 'pending' | 'approved' | 'rejected';
  created_at: any;
}

export default function PlannerRoleApproval() {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const session = useSession();
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!serverGroupId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'server_groups', serverGroupId, 'role_requests'),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      const list: RoleRequest[] = snap.docs.map((d) => d.data() as RoleRequest);
      // Sort manually as we might not have compound index for sorting yet
      list.sort((a, b) => (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0));
      setRequests(list);
    } catch (e) {
      console.error(e);
      toast.error('요청 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [serverGroupId]);

  const handleApprove = async (req: RoleRequest) => {
    if (!serverGroupId) return;
    if (!confirm(`${req.user_name}님의 플래너 권한을 승인하시겠습니까?`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        // 1. PREPARE & READ: Check membership existence first (READ)
        const membershipRef = doc(db, 'memberships', `${req.uid}_${serverGroupId}`);
        const membershipSnap = await transaction.get(membershipRef);
        
        // 2. WRITE OPERATIONS
        
        // A) Update request status
        const requestRef = doc(db, 'server_groups', serverGroupId, 'role_requests', req.uid);
        transaction.update(requestRef, {
          status: 'approved',
          updated_at: serverTimestamp(),
        });

        // B) Update memberships
        if (membershipSnap.exists()) {
          const currentData = membershipSnap.data();
          let newRoles = [];
          if (Array.isArray(currentData.role)) {
            newRoles = [...currentData.role];
            if (!newRoles.includes('planner')) {
              newRoles.push('planner');
            }
          } else {
            // fallback if string
            newRoles = [currentData.role, 'planner'];
          }

          transaction.update(membershipRef, {
            role: newRoles, 
            active: true,
            updated_at: serverTimestamp(),
          });
        } else {
          // Create new membership with JUST planner role
          transaction.set(membershipRef, {
            uid: req.uid,
            server_group_id: serverGroupId,
            role: ['planner'],
            active: true,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        }

        // C) Update User Profile
        const userRef = doc(db, 'users', req.uid);
        transaction.set(userRef, {
          user_name: req.user_name,
          baptismal_name: req.baptismal_name,
          phone: req.phone,
          updated_at: serverTimestamp(),
        }, { merge: true });
      });

      toast.success('승인 완료되었습니다.');
      fetchRequests(); // Refresh list
    } catch (e) {
      console.error(e);
      toast.error('승인 처리 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async (req: RoleRequest) => {
    if (!serverGroupId) return;
    if (!confirm(`${req.user_name}님의 요청을 반려하시겠습니까?`)) return;

    try {
      await updateDoc(doc(db, 'server_groups', serverGroupId, 'role_requests', req.uid), {
        status: 'rejected',
        updated_at: serverTimestamp(),
      });
      toast.success('반려되었습니다.');
      fetchRequests();
    } catch (e) {
      console.error(e);
      toast.error('반려 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <Container className="py-8 min-h-screen">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </Button>
        <div>
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900">
            신규 권한 승인
          </Heading>
          <p className="text-gray-500 text-sm">
            플래너 권한 요청을 확인하고 승인합니다.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">로딩 중...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500">대기 중인 권한 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.uid} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg text-gray-900">{req.user_name}</span>
                  <span className="text-sm text-gray-600">({req.baptismal_name})</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium border border-purple-200">
                    플래너 신청
                  </span>
                </div>
                <div className="text-sm text-gray-500 space-y-0.5">
                  <p>{req.email}</p>
                  <p>{req.phone}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    신청일시: {req.created_at?.toDate().toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                    className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => handleApprove(req)}
                >
                  승인
                </Button>
                <Button 
                    variant="outline" 
                    className="flex-1 sm:flex-none text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                    onClick={() => handleReject(req)}
                >
                  반려
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
}

