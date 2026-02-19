import React, { useState, useEffect, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    collection, query, where, getDocs, getDoc, doc, writeBatch, serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { COLLECTIONS } from '@/lib/collections';
import { 
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel 
} from '@/components/ui/alert-dialog';

interface MoveMembersDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentServerGroupId: string;
    members: any[]; // Active + Inactive members
    parentInfos: Record<string, any>;
}

interface ServerGroupOption {
    id: string;
    name: string;
}

export default function MoveMembersDrawer({ 
    open, 
    onOpenChange, 
    currentServerGroupId, 
    members,
    parentInfos
}: MoveMembersDrawerProps) {
    const [targetSgId, setTargetSgId] = useState<string>('');
    const [serverGroups, setServerGroups] = useState<ServerGroupOption[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [isFetchingGroups, setIsFetchingGroups] = useState(false);
    const [actionType, setActionType] = useState<'move' | 'copy' | null>(null); // ✅ [New] Action type
    const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set(['ALL'])); // Default expand all? Or use 'ALL' concept
    const [parishCode, setParishCode] = useState<string>(''); // ✅ [New] Store parish code

    // Group members by grade
    const groupedMembers = useMemo(() => {
        const groups: Record<string, any[]> = {};
        const allGrades = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'M1', 'M2', 'M3', 'H1', 'H2', 'H3', '기타'];
        
        allGrades.forEach(g => groups[g] = []);
        
        members.forEach(m => {
            if (!m.active) return; // ✅ Only show active members
            const grade = allGrades.includes(m.grade) ? m.grade : '기타';
            groups[grade].push(m);
        });

        // specific sort by name inside groups
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => (a.name_kor || '').localeCompare(b.name_kor || ''));
        });

        // Filter out empty groups
        return Object.entries(groups).filter(([_, list]) => list.length > 0);
    }, [members]);

    // Fetch available server groups in the same parish
    useEffect(() => {
        if (open && currentServerGroupId) {
            const fetchGroups = async () => {
                setIsFetchingGroups(true);
                try {
                    // 1. Get current SG to find parish_code
                    const currentSgSnap = await getDoc(doc(db, COLLECTIONS.SERVER_GROUPS, currentServerGroupId));
                    if (!currentSgSnap.exists()) return;
                    
                    const code = currentSgSnap.data().parish_code;
                    setParishCode(code);

                    // 2. Query other SGs in same parish
                    const q = query(
                        collection(db, COLLECTIONS.SERVER_GROUPS), 
                        where('parish_code', '==', code)
                    );
                    const snap = await getDocs(q);
                    
                    const options = snap.docs
                        .map(d => ({ id: d.id, name: d.data().name }))
                        .filter(sg => sg.id !== currentServerGroupId); // Exclude current

                    setServerGroups(options);
                } catch (e) {
                    console.error('Failed to fetch server groups', e);
                    toast.error('복사단 목록을 불러오지 못했습니다.');
                } finally {
                    setIsFetchingGroups(false);
                }
            };
            fetchGroups();
            // Reset selection
            setSelectedIds(new Set());
            setTargetSgId('');
        }
    }, [open, currentServerGroupId]);

    const handleToggleMember = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleToggleGrade = (gradeMembers: any[]) => {
        const ids = gradeMembers.map(m => m.id);
        const allSelected = ids.every(id => selectedIds.has(id));
        
        const newSet = new Set(selectedIds);
        if (allSelected) {
            ids.forEach(id => newSet.delete(id));
        } else {
            ids.forEach(id => newSet.add(id));
        }
        setSelectedIds(newSet);
    };

    const moveButtonDisabled = loading;

    const handleAction = (type: 'move' | 'copy') => {
        if (!targetSgId) {
            toast.error(`이동할 대상 복사단을 선택해주세요.`);
            return;
        }
        if (selectedIds.size === 0) {
            toast.error(`이동할 복사단원을 선택해주세요.`);
            return;
        }
        setActionType(type);
    };

    const executeAction = async () => {
        if (!actionType) return;
        
        setLoading(true);
        // Do not close confirm here, let it close by clearing actionType
        
        const auth = getAuth();
        const currentUser = auth.currentUser;

        try {
            const batch = writeBatch(db);
            let count = 0;

            // Process each selected member
            const selectedMembersList = members.filter(m => selectedIds.has(m.id));

            for (const member of selectedMembersList) {
                const uid = member.id; // Assuming member.id is uid (which is true for active members)
                
                // 1. Create new member doc in target SG
                const targetMemberRef = doc(db, COLLECTIONS.SERVER_GROUPS, targetSgId, 'members', uid);
                
                // Fetch target SG name if possible? No need.
                
                const memberData = {
                    ...member,
                    server_group_id: targetSgId, 
                    moved_from_sg_id: currentServerGroupId, // ✅ 어디서 왔는지 기록
                    updated_at: serverTimestamp(),
                };
                // Remove ID from data if it exists physically in object
                delete memberData.id; 
                delete memberData.is_moved; 
                delete memberData.moved_at; 
                delete memberData.moved_by_uid; 
                delete memberData.moved_by_name; 
                delete memberData.moved_to_sg_id; 

                // If copy, ensure active is true (or keep original status?)
                // Usually when moving/copying, we want them active in new place?
                // Let's keep original active status unless we want to reset.
                // Resetting to 'active: true' might be safer for 'copy' to new group. 
                // But let's stick to original data + basic resets.
                
                batch.set(targetMemberRef, memberData);

                // 2. Handle Old Member based on Action Type
                if (actionType === 'move') {
                    const oldMemberRef = doc(db, COLLECTIONS.SERVER_GROUPS, currentServerGroupId, 'members', uid);
                    batch.update(oldMemberRef, { 
                        active: false, 
                        is_moved: true,
                        moved_at: serverTimestamp(),
                        moved_by_uid: currentUser?.uid,
                        moved_by_name: currentUser?.displayName || '관리자',
                        moved_to_sg_id: targetSgId,
                        updated_at: serverTimestamp() 
                    });

                    // Remove old membership
                    const oldMembershipRef = doc(db, COLLECTIONS.MEMBERSHIPS, `${uid}_${currentServerGroupId}`);
                    batch.delete(oldMembershipRef);
                } else if (actionType === 'copy') {
                    // Update old member to record copy history
                    const oldMemberRef = doc(db, COLLECTIONS.SERVER_GROUPS, currentServerGroupId, 'members', uid);
                    batch.update(oldMemberRef, {
                        copied_to_sg_id: targetSgId,
                        copied_at: serverTimestamp(),
                        copied_by_uid: currentUser?.uid,
                        copied_by_name: currentUser?.displayName || '관리자',
                        updated_at: serverTimestamp()
                    });
                }
                // If copy, do nothing to old member/membership.

                // 3. Create New Membership
                // Membership ID is `{uid}_{sgId}`
                const newMembershipRef = doc(db, COLLECTIONS.MEMBERSHIPS, `${uid}_${targetSgId}`);
                
                batch.set(newMembershipRef, {
                    uid: uid,
                    server_group_id: targetSgId,
                    role: ['server'], // Reset to basic server role
                    active: member.active, // Maintain active status
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                    parish_code: member.parish_code || parishCode // Use member's parish_code if available, else fallback to current SG's parish_code
                });
                
                count++;
            }

            await batch.commit();
            toast.success(`총 ${count}명의 복사단원이 ${actionType === 'move' ? '이동' : '복제'}되었습니다.`);
            setActionType(null);
            onOpenChange(false);

        } catch (e) {
            console.error('Migration failed', e);
            toast.error(`${actionType === 'move' ? '이동' : '복제'} 중 오류가 발생했습니다.`);
        } finally {
            setLoading(false);
            setActionType(null);
        }
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent 
                className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900"
            >
                <div className="p-6 pb-2 shrink-0">
                <DialogHeader>
                        <DialogTitle>복사단 이동(복제)</DialogTitle>
                        <DialogDescription>
                            선택한 복사단원들을 같은 성당 내 다른 복사단으로 이동하거나 복제합니다.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">이동할 복사단 (To)</label>
                            {isFetchingGroups ? (
                                <div className="h-10 w-full bg-gray-100 dark:bg-slate-800 animate-pulse rounded-md" />
                            ) : (
                                <Select value={targetSgId} onValueChange={setTargetSgId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="복사단을 선택하세요" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-[9999] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
                                        {serverGroups.map(sg => (
                                            <SelectItem key={sg.id} value={sg.id}>{sg.name}</SelectItem>
                                        ))}
                                        {serverGroups.length === 0 && (
                                            <div className="p-2 text-xs text-center text-gray-500">이동 가능한 복사단이 없습니다.</div>
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-2">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                             <span className="text-sm font-bold text-gray-600 dark:text-gray-400">대상 복사단원 선택</span>
                             <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                 {selectedIds.size}명 선택됨
                             </span>
                        </div>
                        
                        {groupedMembers.map(([grade, list]) => {
                            const isAllSelected = list.every((m: any) => selectedIds.has(m.id));
                            const isIndeterminate = list.some((m: any) => selectedIds.has(m.id)) && !isAllSelected;

                            return (
                                <div key={grade} className="border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 dark:bg-slate-800 p-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Checkbox 
                                                checked={isAllSelected}
                                                onCheckedChange={() => handleToggleGrade(list)}
                                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                            />
                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{grade}</span>
                                        </div>
                                        <span className="text-xs text-gray-400">{list.length}명</span>
                                    </div>
                                    <div className="divide-y divide-gray-50 dark:divide-slate-800">
                                        {list.map((m: any) => {
                                            const parent = m.parent_uid ? parentInfos[m.parent_uid] : undefined;
                                            return (
                                                <div 
                                                    key={m.id} 
                                                    className="flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer"
                                                    onClick={() => handleToggleMember(m.id)}
                                                >
                                                    <Checkbox 
                                                        checked={selectedIds.has(m.id)}
                                                        onCheckedChange={() => handleToggleMember(m.id)}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.name_kor}</span>
                                                            <span className="text-xs text-gray-500 dark:text-gray-500">({m.baptismal_name})</span>
                                                            {parent && (
                                                              <span className="text-xs text-gray-400 dark:text-gray-600 ml-1">
                                                                · 신청: {parent.user_name}
                                                              </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {members.length === 0 && (
                            <p className="text-center text-gray-400 text-sm py-8">이동할 멤버가 없습니다.</p>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 shrink-0 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                    <div className="flex gap-2 ml-auto">
                        <Button 
                            variant="secondary"
                            onClick={() => handleAction('copy')} 
                            disabled={moveButtonDisabled}
                            className="bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                        >
                            {loading && actionType === 'copy' ? '복제 중...' : '복제 (유지)'}
                        </Button>
                        <Button 
                            onClick={() => handleAction('move')} 
                            disabled={moveButtonDisabled}
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                            {loading && actionType === 'move' ? '이동 중...' : '이동 (삭제)'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* ✅ Confirmation Alert Dialog */}
        <AlertDialog open={!!actionType} onOpenChange={(open) => !open && setActionType(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {actionType === 'move' ? '복사단원 이동 (삭제)' : '복사단원 복제 (유지)'}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                        {`선택한 ${selectedIds.size}명의 복사단원을\n[${serverGroups.find(g => g.id === targetSgId)?.name || targetSgId}] 복사단으로 ${actionType === 'move' ? '이동' : '복제'}하시겠습니까?\n\n`}
                        {actionType === 'move' ? (
                            <span className="text-red-500 font-bold block mt-2">
                                ⚠️ 주의: 이동 후에는 현재 복사단 목록에서 제외됩니다.
                            </span>
                        ) : (
                            <span className="text-blue-500 font-bold block mt-2">
                                ℹ️ 안내: 현재 복사단 목록은 유지되며, 대상 복사단에 새로 추가됩니다.
                            </span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setActionType(null)}>취소</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={(e) => {
                            e.preventDefault(); 
                            executeAction();
                        }}
                        className={actionType === 'move' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}
                    >
                        {actionType === 'move' ? '이동하기' : '복제하기'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
