import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MessageSquare, RefreshCw, Send, AlertTriangle, Trash2, Smartphone, ChevronDown, ChevronRight } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';

interface UserSupportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uid: string;
  userName: string;
  email: string;
}

export default function UserSupportDrawer({ open, onOpenChange, uid, userName, email }: UserSupportDrawerProps) {
  const [sending, setSending] = useState(false);
  const [tokens, setTokens] = useState<string[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [showTokenHelp, setShowTokenHelp] = useState(false);

  const fetchTokens = useCallback(async () => {
    if (!uid) return;
    setLoadingTokens(true);
    try {
        const docRef = doc(db, 'users', uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            setTokens(snap.data().fcm_tokens || []);
        } else {
            setTokens([]);
        }
    } catch (e) {
        console.error(e);
        toast.error('기기 토큰을 불러오지 못했습니다.');
    } finally {
        setLoadingTokens(false);
    }
  }, [uid]);

  useEffect(() => {
    if (open) {
        fetchTokens();
    }
  }, [open, fetchTokens]);

  const handleDeleteToken = async (tokenData: string) => {
    if (!confirm('정말 이 기기(토큰)를 삭제하시겠습니까? 해당 기기에서 알림을 더 이상 받지 못합니다.')) return;
    
    try {
        const docRef = doc(db, 'users', uid);
        await updateDoc(docRef, {
            fcm_tokens: arrayRemove(tokenData)
        });
        toast.success('기기 토큰이 삭제되었습니다.');
        fetchTokens(); // Refresh list
    } catch (e) {
        console.error(e);
        toast.error('토큰 삭제 실패');
    }
  };

  const handleSendTestMessage = async () => {
    try {
        // ... (existing logic)
      setSending(true);
      const sendTest = httpsCallable(functions, 'altar_sendTestNotification');
      
      const iconUrl = new URL('/pwa-icon.png', window.location.origin).href;
      const result = await sendTest({ targetUid: uid, iconUrl });
      
      if ((result.data as any).success) {
          toast.success('테스트 메세지를 발송했습니다.');
      } else {
          throw new Error((result.data as any).message || 'Unknown error');
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`발송 실패: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center gap-2 text-xl text-gray-900 dark:text-gray-100">
             <span className="bg-pink-100 text-pink-600 p-1.5 rounded-lg dark:bg-pink-900/20 dark:text-pink-300">
                <MessageSquare size={20} />
             </span>
             사용자 지원
          </DialogTitle>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
             <span className="font-bold text-gray-900 dark:text-gray-200">{userName}</span> ({email})님에 대한 지원 도구
          </div>
        </DialogHeader>

        <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
            {/* 1. Message Test Section */}
            <section className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-200 border-b border-gray-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                    메세지 발송 테스트
                </h3>
                
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className="flex items-start gap-3 mb-4">
                        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                            사용자 알림 수신 여부를 확인하기 위해 테스트 메세지를 발송합니다.
                        </p>
                    </div>

                    <div className="flex justify-end">
                        <Button 
                            onClick={handleSendTestMessage} 
                            disabled={sending}
                            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {sending ? <RefreshCw className="animate-spin" size={16}/> : <Send size={16} />}
                            테스트 메세지 발송
                        </Button>
                    </div>
                </div>
            </section>

            {/* Device Token Management */}
            <section className="space-y-3">
                 <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-200">
                        기기 토큰 관리
                    </h3>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 dark:text-gray-400 dark:hover:text-gray-200" 
                        onClick={fetchTokens}
                        disabled={loadingTokens}
                    >
                        <RefreshCw size={14} className={loadingTokens ? "animate-spin" : ""} />
                    </Button>
                </div>

                <div className="space-y-2">
                    {loadingTokens ? (
                         <div className="text-center py-4 text-xs text-gray-400">로딩 중...</div>
                    ) : tokens.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-slate-500">
                            등록된 기기(토큰)가 없습니다.
                        </div>
                    ) : (
                        tokens.map((token, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm text-xs">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="bg-gray-100 dark:bg-slate-700 p-1.5 rounded text-gray-500 dark:text-gray-400">
                                        <Smartphone size={16} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
                                            {token.substring(0, 10)}...{token.substring(token.length - 10)}
                                        </span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                            Device #{idx + 1}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                    onClick={() => handleDeleteToken(token)}
                                >
                                    <Trash2 size={16} /> 
                                </Button>
                            </div>
                        ))
                    )}
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg overflow-hidden border border-transparent dark:border-blue-900/30">
                    <button 
                        onClick={() => setShowTokenHelp(!showTokenHelp)}
                        className="w-full flex items-center justify-between p-3 text-left"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-blue-500">💡</span>
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">토큰 삭제가 필요한 경우는?</span>
                        </div>
                        {showTokenHelp ? (
                            <ChevronDown size={14} className="text-blue-400 dark:text-blue-500" />
                        ) : (
                            <ChevronRight size={14} className="text-blue-400 dark:text-blue-500" />
                        )}
                    </button>
                    
                    {showTokenHelp && (
                        <div className="px-3 pb-3 pt-0">
                            <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-snug pl-6 border-l-2 border-blue-200 dark:border-blue-800">
                                1. 사용자가 기기를 변경했거나<br/>더 이상 사용하지 않는 기기가 목록에 남아있을 때<br/>
                                2. 알림이 특정 기기로만 오지 않거나<br/>중복으로 발송될 때<br/>
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-800 mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-700">
                닫기
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
