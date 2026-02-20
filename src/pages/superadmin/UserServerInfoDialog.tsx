import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Contact } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { COLLECTIONS } from '@/lib/collections';

interface ServerMemberInfo {
  id: string;
  name: string;
  baptismal_name: string;
  status: string; 
  role: string; 
  grade?: string; 
  joined_at?: any;
}

interface ServerGroupData {
    groupId: string;
    groupName: string;
    parishName: string;
    members: ServerMemberInfo[];
}

interface UserServerInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  userName: string;
}

export default function UserServerInfoDialog({ open, onOpenChange, uid, userName }: UserServerInfoDialogProps) {
  const [groupedInfos, setGroupedInfos] = useState<ServerGroupData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && uid) {
      fetchServerInfos();
    }
  }, [open, uid]);

  const fetchServerInfos = async () => {
    setLoading(true);
    try {
      // 1. memberships에서 소속된 그룹 찾기
      const q = query(collection(db, COLLECTIONS.MEMBERSHIPS), where('uid', '==', uid));
      const membershipSnap = await getDocs(q);
      
      const results: ServerGroupData[] = [];
      const processedGroupIds = new Set<string>();

      for (const mDoc of membershipSnap.docs) {
        const mData = mDoc.data();
        const groupId = mData.server_group_id;

        if (!groupId || groupId === 'global' || processedGroupIds.has(groupId)) continue;
        processedGroupIds.add(groupId);

        // 기본 정보
        let groupName = groupId;
        let parishName = '';
        
        // 2. 그룹 및 성당 정보 가져오기
        try {
            const groupSnap = await getDoc(doc(db, COLLECTIONS.SERVER_GROUPS, groupId));
            if (groupSnap.exists()) {
                const gData = groupSnap.data();
                groupName = gData.name;
                
                // parish_code로 성당 이름 조회
                if (gData.parish_code) {
                     const parishSnap = await getDoc(doc(db, COLLECTIONS.PARISHES, gData.parish_code));
                     if (parishSnap.exists()) {
                         parishName = parishSnap.data().name_kor;
                     }
                }
            }
        } catch (e) {
            console.error(`Error fetching group info ${groupId}`, e);
        }

        // 3. 해당 그룹의 members 컬렉션에서 멤버 찾기
        const groupMembers: ServerMemberInfo[] = [];
        try {
            const membersRef = collection(db, COLLECTIONS.SERVER_GROUPS, groupId, 'members');
            // parent_uid로 조회 (자녀들)
            const qMembers = query(membersRef, where('parent_uid', '==', uid));
            const membersSnap = await getDocs(qMembers);

            if (!membersSnap.empty) {
                membersSnap.forEach(memberDoc => {
                    const memberData = memberDoc.data();
                    groupMembers.push({
                        id: memberDoc.id,
                        name: memberData.name_kor || memberData.name || userName,
                        baptismal_name: memberData.baptismal_name || '',
                        status: memberData.active ? '활동중' : (memberData.request_confirmed === false ? '승인대기' : '활동중지'), 
                        role: Array.isArray(mData.role) ? mData.role.join(', ') : mData.role,
                        grade: memberData.grade,
                        joined_at: memberData.created_at
                    });
                });
            } else {
                // parent_uid로 없는 경우 -> 본인 계정(legacy or self) 확인
                const docRef = doc(db, COLLECTIONS.SERVER_GROUPS, groupId, 'members', uid);
                const selfSnap = await getDoc(docRef);
                
                if (selfSnap.exists()) {
                     const memberData = selfSnap.data();
                     groupMembers.push({
                        id: selfSnap.id,
                        name: memberData.name_kor || memberData.name || userName,
                        baptismal_name: memberData.baptismal_name || '',
                        status: memberData.active ? '활동중' : (memberData.request_confirmed === false ? '승인대기' : '활동중지'),
                        role: Array.isArray(mData.role) ? mData.role.join(', ') : mData.role,
                        grade: memberData.grade,
                        joined_at: memberData.created_at
                    });
                } else {
                    // 정말 없는 경우
                    groupMembers.push({
                        id: 'unknown',
                        name: '(등록 정보 없음)',
                        baptismal_name: '-',
                        status: '미등록',
                        role: Array.isArray(mData.role) ? mData.role.join(', ') : mData.role,
                    });
                }
            }
        } catch (e) {
            console.error(`Error fetching members for ${groupId}`, e);
        }

        // 이름순 정렬
        groupMembers.sort((a, b) => a.name.localeCompare(b.name));

        results.push({
            groupId,
            groupName,
            parishName,
            members: groupMembers
        });
      }

      setGroupedInfos(results);
    } catch (e) {
      console.error(e);
      toast.error('복사 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Contact className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            {userName}님의 복사 활동 정보
          </DialogTitle>
           <div 
            className="text-xs text-gray-400 font-mono mt-1 cursor-pointer hover:text-blue-500 transition-colors flex items-center gap-1"
            onClick={() => {
                navigator.clipboard.writeText(uid);
                toast.success('UID가 복사되었습니다.');
            }}
            title="클릭하여 UID 복사"
          >
            UID: {uid}
          </div>
          <DialogDescription className="text-gray-500 dark:text-gray-400 mt-1">
             각 복사단에 등록된 상세 프로필 정보입니다.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
            <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-gray-400 dark:text-gray-500" />
            </div>
        ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {groupedInfos.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8 bg-gray-50 dark:bg-slate-800 rounded-lg">
                        등록된 복사 활동 정보가 없습니다.
                    </div>
                ) : (
                    groupedInfos.map((group) => (
                        <div key={group.groupId} className="border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
                            {/* Group Header */}
                            <div className="bg-gray-50 dark:bg-slate-800/80 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 font-medium">
                                    {group.parishName || '성당 미지정'}
                                </div>
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                                        {group.groupName}
                                    </h4>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-600">
                                        {group.groupId}
                                    </span>
                                </div>
                            </div>

                            {/* Members List */}
                            <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                {group.members.map((member, idx) => (
                                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                                                    {member.name}
                                                </span>
                                                {member.baptismal_name && (
                                                    <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                                        ({member.baptismal_name})
                                                    </span>
                                                )}
                                                {member.grade && (
                                                    <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                                        {member.grade}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-2">
                                                <span>권한: {member.role}</span>
                                                {member.joined_at && (
                                                    <>
                                                        <span className="text-gray-300 dark:text-slate-600">|</span>
                                                        <span>{member.joined_at?.toDate ? member.joined_at.toDate().toLocaleDateString() : String(new Date(member.joined_at)).split('T')[0]} 등록</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <span className={`text-xs px-2 py-0.5 rounded font-medium border whitespace-nowrap ml-2 ${
                                            member.status === '활동중' 
                                                ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50' 
                                                : member.status === '승인대기' 
                                                    ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50'
                                                    : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                        }`}>
                                            {member.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
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
