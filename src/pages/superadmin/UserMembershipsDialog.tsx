import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Shield, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Membership {
  id: string; // document id
  server_group_id: string;
  role: string | string[];
  active: boolean;
  server_group_name?: string; // fetched
}

interface UserMembershipsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  userName: string;
}

export default function UserMembershipsDialog({ open, onOpenChange, uid, userName }: UserMembershipsDialogProps) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);

  useEffect(() => {
    if (open && uid) {
      fetchMemberships();
    }
  }, [open, uid]);

  const fetchMemberships = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'memberships'), where('uid', '==', uid));
      const snap = await getDocs(q);
      
      const list: Membership[] = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      } as any));

      const enrichedList = await Promise.all(list.map(async (m) => {
        if (!m.server_group_id) return m;
        try {
            const sgSnap = await getDoc(doc(db, 'server_groups', m.server_group_id));
            if (sgSnap.exists()) {
                return { ...m, server_group_name: sgSnap.data().name };
            }
        } catch (e) {
            console.error("Failed to fetch SG name", e);
        }
        return m;
      }));

      setMemberships(enrichedList);
    } catch (e) {
      console.error(e);
      toast.error('멤버십 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (m: Membership) => {
    setEditTargetId(m.id);
    setEditRoles(Array.isArray(m.role) ? [...m.role] : [m.role]);
    setEditActive(m.active);
  };

  const cancelEdit = () => {
    setEditTargetId(null);
    setEditRoles([]);
  };

  const toggleRole = (role: string) => {
    setEditRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role]
    );
  };

  const saveEdit = async () => {
    if (!editTargetId) return;
    try {
        if (editRoles.length === 0 && editActive) {
            toast.error('Active 상태에서는 최소 하나의 역할이 필요합니다.');
            return;
        }

        await updateDoc(doc(db, 'memberships', editTargetId), {
            role: editRoles,
            active: editActive,
            updated_at: serverTimestamp()
        });

        // Update local state
        setMemberships(prev => prev.map(m => 
            m.id === editTargetId 
                ? { ...m, role: editRoles, active: editActive } 
                : m
        ));
        
        toast.success('멤버십이 수정되었습니다.');
        cancelEdit();
    } catch (e) {
        console.error(e);
        toast.error('수정 중 오류가 발생했습니다.');
    }
  };

  const AVAILABLE_ROLES = ['superadmin', 'admin', 'planner', 'server'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {userName}님의 멤버십 정보
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
             사용자가 소속된 복사단 및 역할 정보입니다.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-gray-400 dark:text-gray-500" />
            </div>
        ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {memberships.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8 bg-gray-50 dark:bg-slate-800 rounded-lg">
                        멤버십 정보가 없습니다.
                    </div>
                ) : (
                    memberships.map((m) => (
                        <div key={m.id} className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm space-y-2 relative group">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                                        {m.server_group_id === 'global' ? 'System' : (m.server_group_name || '알 수 없는 복사단')}
                                    </h4>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 block mt-0.5">
                                        {m.server_group_id === 'global' ? 'Global Admin' : m.server_group_id}
                                    </span>
                                </div>
                                {editTargetId !== m.id && (
                                     <span className={`text-[10px] px-2 py-1 rounded font-medium ${m.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                        {m.active ? 'Active' : 'Inactive'}
                                    </span>
                                )}
                            </div>
                            
                            {editTargetId === m.id ? (
                                <div className="mt-2 p-2 bg-gray-50 dark:bg-slate-900/50 rounded border border-gray-200 dark:border-slate-700">
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {AVAILABLE_ROLES.map(role => (
                                            <button 
                                                key={role}
                                                onClick={() => toggleRole(role)}
                                                className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                                                    editRoles.includes(role) 
                                                        ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' 
                                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={editActive} 
                                                onChange={(e) => setEditActive(e.target.checked)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600"
                                            />
                                            Active 상태
                                        </label>
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400">
                                                <X size={14} />
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={saveEdit} className="h-6 w-6 p-0 hover:bg-green-100 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400">
                                                <Check size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-1 items-center">
                                    {(Array.isArray(m.role) ? m.role : [m.role]).map((r, idx) => {
                                        let badgeStyle = "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600";
                                        if (r === 'superadmin') badgeStyle = "bg-black text-white border-black dark:bg-slate-950 dark:border-slate-900";
                                        else if (r === 'admin') badgeStyle = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/50";
                                        else if (r === 'planner') badgeStyle = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50";
                                        else if (r === 'server') badgeStyle = "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/50";

                                        return (
                                            <span key={idx} className={`px-2 py-0.5 border rounded text-xs font-medium ${badgeStyle}`}>
                                                {r}
                                            </span>
                                        );
                                    })}
                                    
                                    <button 
                                        onClick={() => startEdit(m)}
                                        className="ml-auto p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        )}

        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-800 mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-700">
                닫기
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
