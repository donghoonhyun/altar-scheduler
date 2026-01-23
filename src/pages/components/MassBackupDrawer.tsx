import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DialogDescription } from '@/components/ui/dialog-description';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Archive, RotateCcw, Trash2, Pencil, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { 
    getFirestore, collection, addDoc, getDocs, 
    query, where, orderBy, serverTimestamp, 
    deleteDoc, doc, writeBatch, getDoc, updateDoc 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // ✅ Added Auth
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface MassBackupDrawerProps {
  open: boolean;
  onClose: () => void;
  serverGroupId: string;
  currentMonth: Dayjs;
}

interface BackupDoc {
    id: string;
    label: string;
    created_at: any;
    created_by?: string;
    event_count: number;
    month_key: string;
    // events data is stored but effectively loaded only on restore logic usually, 
    // but here we might store it in the doc if small enough.
}

const MassBackupDrawer: React.FC<MassBackupDrawerProps> = ({
  open,
  onClose,
  serverGroupId,
  currentMonth
}) => {
  const db = getFirestore();
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [backups, setBackups] = useState<BackupDoc[]>([]);
  const [editingBackupId, setEditingBackupId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const monthKey = currentMonth.format('YYYYMM');

  // Load backups list
  const fetchBackups = async () => {
    try {
        const ref = collection(db, 'server_groups', serverGroupId, 'mass_backups'); // ✅ mass_backups
        const q = query(
            ref, 
            where('month_key', '==', monthKey), 
            orderBy('created_at', 'desc')
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({
            id: d.id,
            ...d.data()
        } as BackupDoc));
        setBackups(list);
    } catch (e) {
        console.error('Failed to fetch backups', e);
    }
  };

  useEffect(() => {
      if (open) {
          fetchBackups();
          setLabel(`${dayjs().format('YYYY-MM-DD HH:mm')} 백업`);
      }
  }, [open, serverGroupId, monthKey]);

  const handleCreateBackup = async () => {
    if (!label.trim()) {
        toast.error('백업 이름을 입력해주세요.');
        return;
    }

    try {
        setLoading(true);
        // 1. Fetch current events
        const startStr = currentMonth.startOf('month').format('YYYYMMDD');
        const endStr = currentMonth.endOf('month').format('YYYYMMDD');
        const eventsRef = collection(db, 'server_groups', serverGroupId, 'mass_events');
        const q = query(eventsRef, where('event_date', '>=', startStr), where('event_date', '<=', endStr));
        const snap = await getDocs(q);
        
        const eventsData = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (eventsData.length === 0) {
            toast.warning('백업할 미사 일정이 없습니다.');
            return;
        }

        // 2. Save to backups
        const auth = getAuth();
        const user = auth.currentUser;
        const backupRef = collection(db, 'server_groups', serverGroupId, 'mass_backups'); // ✅ mass_backups
        
        await addDoc(backupRef, {
            month_key: monthKey,
            label: label,
            events: eventsData,
            event_count: eventsData.length,
            created_at: serverTimestamp(),
            created_by: user?.uid || 'unknown',
            created_by_email: user?.email || '',
        });

        toast.success(`✅ ${eventsData.length}건의 일정이 백업되었습니다.`);
        setLabel(`${dayjs().format('YYYY-MM-DD HH:mm')} 백업`);
        fetchBackups();
    } catch (e) {
        console.error(e);
        toast.error('백업 생성 실패');
    } finally {
        setLoading(false);
    }
  };

  const handleRestore = async (backupId: string, eventCount: number) => {
      if (!window.confirm(`⚠️ 현재 일정을 모두 지우고 이 백업본(${eventCount}건)으로 복원하시겠습니까?`)) return;

      try {
          setLoading(true);
          const backupDocRef = doc(db, 'server_groups', serverGroupId, 'mass_backups', backupId); // ✅ mass_backups
          // We need to fetch the doc specially if we didn't load 'events' field in list (usually good practice to store big data separately or ignore in brief list, but here we loaded it all in simple query).
          // Assuming 'events' is in the loaded doc data? Wait, fetchBackups does fetch all fields by default.
          // Firestore getDocs fetches full documents.
          // So we should have it in `backups` state if we mapped it, but I didn't map `events` to State Type `BackupDoc` to save memory?
          // Let's create a helper to fetch full doc for restore.
          const fullSnap = await import('firebase/firestore').then(mod => mod.getDoc(backupDocRef));
          if (!fullSnap.exists()) throw new Error('Backup not found');
          
          const backupData = fullSnap.data();
          const eventsToRestore = backupData.events as any[];

          // 1. Delete current events
          const startStr = currentMonth.startOf('month').format('YYYYMMDD');
          const endStr = currentMonth.endOf('month').format('YYYYMMDD');
          const eventsRef = collection(db, 'server_groups', serverGroupId, 'mass_events');
          const currentEventsQ = query(eventsRef, where('event_date', '>=', startStr), where('event_date', '<=', endStr));
          const currentSnap = await getDocs(currentEventsQ);
          
          const batch = writeBatch(db);
          currentSnap.docs.forEach(d => {
              batch.delete(d.ref);
          });
          
          // 2. Insert restored events
          eventsToRestore.forEach(ev => {
             const { id, ...data } = ev;
             const newRef = doc(eventsRef, id); // Use original ID
             batch.set(newRef, data);
          });

          await batch.commit();
          toast.success('복원이 완료되었습니다.');
          onClose(); // Close to refresh Parent
      } catch (e) {
          console.error(e);
          toast.error('복원 실패');
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (backupId: string) => {
      if (!window.confirm('이 백업본을 삭제하시겠습니까?')) return;
      try {
          await deleteDoc(doc(db, 'server_groups', serverGroupId, 'mass_backups', backupId)); // ✅ mass_backups
          toast.success('삭제되었습니다.');
          fetchBackups();
      } catch (e) {
          console.error(e);
          toast.error('삭제 실패');
      }
  };

  const handleUpdateLabel = async (backupId: string) => {
      if (!editLabel.trim()) return;
      try {
          await updateDoc(doc(db, 'server_groups', serverGroupId, 'mass_backups', backupId), {
              label: editLabel
          });
          toast.success('이름이 수정되었습니다.');
          setEditingBackupId(null);
          fetchBackups();
      } catch (e) {
          console.error(e);
          toast.error('수정 실패');
      }
  };

  const startEditing = (backup: BackupDoc) => {
      setEditingBackupId(backup.id);
      setEditLabel(backup.label);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-6 max-h-[85vh] flex flex-col">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold mb-2">
          <Archive size={20} className="text-gray-600" />
          미사 일정 백업 및 복원
          <span className="text-gray-500 text-base ml-1">
            ({currentMonth.format('YYYY년 M월')})
          </span>
        </DialogTitle>

        <DialogDescription className="text-sm text-gray-600 mb-3">
            자동 배정 등을 실행하기 전에 현재 상태를 백업해두면 언제든 복원할 수 있습니다.
        </DialogDescription>

        <div className="border-b border-gray-200 dark:border-gray-700 my-2" />

        {/* Create Backup Section */}
        <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg space-y-3">
             <Label htmlFor="backup-label">새 백업 생성</Label>
             <div className="flex gap-2">
                 <Input 
                    id="backup-label" 
                    value={label} 
                    onChange={e => setLabel(e.target.value)}
                    placeholder="백업 이름을 입력하세요"
                 />
                 <Button onClick={handleCreateBackup} disabled={loading} className="shrink-0 gap-2">
                     {loading ? <Loader2 className="animate-spin" /> : <Save size={16} />}
                     백업하기
                 </Button>
             </div>
        </div>

        {/* List Section */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-2">
             <Label>백업 목록</Label>
             {backups.length === 0 ? (
                 <p className="text-center text-sm text-gray-500 py-4">저장된 백업이 없습니다.</p>
             ) : (
                 <div className="space-y-2">
                      {backups.map(backup => (
                          <div key={backup.id} className="flex items-center justify-between p-3 border rounded bg-white dark:bg-slate-900 shadow-sm hover:border-blue-300 transition-colors group">
                              {editingBackupId === backup.id ? (
                                  <div className="flex items-center gap-2 flex-1 mr-2">
                                      <Input 
                                          value={editLabel} 
                                          onChange={e => setEditLabel(e.target.value)}
                                          className="h-8 text-sm"
                                          autoFocus
                                          onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleUpdateLabel(backup.id);
                                              if (e.key === 'Escape') setEditingBackupId(null);
                                          }}
                                      />
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleUpdateLabel(backup.id)}>
                                          <Check size={16} />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:bg-gray-100" onClick={() => setEditingBackupId(null)}>
                                          <X size={16} />
                                      </Button>
                                  </div>
                              ) : (
                                  <div className="flex flex-col flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{backup.label}</span>
                                        <button 
                                            className="text-gray-300 opacity-0 group-hover:opacity-100 hover:text-blue-500 transition-all p-1"
                                            onClick={() => startEditing(backup)}
                                            title="이름 수정"
                                        >
                                            <Pencil size={12} />
                                        </button>
                                      </div>
                                      <span className="text-xs text-gray-500">
                                          {backup.created_at?.toDate ? dayjs(backup.created_at.toDate()).format('YYYY-MM-DD HH:mm:ss') : '-'}
                                          {' · '}{backup.event_count}개 일정
                                      </span>
                                  </div>
                              )}
                              
                              {editingBackupId !== backup.id && (
                                <div className="flex items-center gap-1">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 text-xs gap-1 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                        onClick={() => handleRestore(backup.id, backup.event_count)}
                                        disabled={loading}
                                    >
                                        <RotateCcw size={12} /> 복원
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-gray-400 hover:text-red-500"
                                        onClick={() => handleDelete(backup.id)}
                                        disabled={loading}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                              )}
                          </div>
                      ))}
                 </div>
             )}
        </div>

        <div className="flex justify-end pt-4 mt-auto border-t">
          <Button variant="ghost" onClick={onClose}>닫기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MassBackupDrawer;
