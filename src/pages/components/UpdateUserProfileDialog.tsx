// src/pages/components/UpdateUserProfileDialog.tsx
import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Sparkles, ShieldCheck } from 'lucide-react';

interface UpdateUserProfileDialogProps {
  uid: string;
  currentName?: string;
  currentBaptismalName?: string;
  onClose: () => void;
}

export default function UpdateUserProfileDialog({
  uid,
  currentName,
  currentBaptismalName,
  onClose,
}: UpdateUserProfileDialogProps) {
  const [name, setName] = useState(currentName || '');
  const [baptismalName, setBaptismalName] = useState(currentBaptismalName || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('이름은 필수 입력 항목입니다.');
      return;
    }

    try {
      setLoading(true);
      const ref = doc(db, 'users', uid);
      await setDoc(ref, {
        user_name: name.trim(),
        baptismal_name: baptismalName.trim(),
        updated_at: serverTimestamp(),
      }, { merge: true });
      
      toast.success('프로필 정보가 업데이트되었습니다.');
      window.location.reload(); 
    } catch (err) {
      console.error(err);
      toast.error('업데이트 실패');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">프로필 정보 입력</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          원활한 서비스 이용을 위해 사용자의 성명과 세례명을 입력해주세요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <User className="w-4 h-4 text-slate-400" />
                성명 <span className="text-red-500 font-bold">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              autoFocus
              className="h-11 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Sparkles className="w-4 h-4 text-slate-400" />
                세례명
            </Label>
            <Input
              value={baptismalName}
              onChange={(e) => setBaptismalName(e.target.value)}
              placeholder="베드로"
              className="h-11 dark:bg-slate-800"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 h-11 text-slate-500"
            >
              나중에 하기
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 h-11 font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
            >
              {loading ? '저장 중...' : '저장하기'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
