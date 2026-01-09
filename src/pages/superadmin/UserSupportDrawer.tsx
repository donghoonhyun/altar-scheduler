import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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

  // Note: This relies on a backend Cloud Function named 'sendTestNotification'.
  // If not implemented, this will fail or we need to stub it / use alternate method
  // like creating a document in a trigger collection.
  const handleSendTestMessage = async () => {
    try {
      setSending(true);
      const sendTest = httpsCallable(functions, 'sendTestNotification');
      
      const result = await sendTest({ targetUid: uid });
      
      if ((result.data as any).success) {
          toast.success('테스트 메세지를 발송했습니다.');
      } else {
          throw new Error((result.data as any).message || 'Unknown error');
      }
    } catch (e: any) {
      console.error(e);
      // For demo purposes, we will simulate success if function is missing or fails in dev,
      // but clearly mark it as simulation if possible or just show error.
      // However, user ASKED for the feature.
      // Let's assume we can write to a 'notifications' collection which triggers a function.
      // Or just try the function call.
      toast.error(`발송 실패: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[340px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 text-xl">
             <span className="bg-pink-100 text-pink-600 p-1.5 rounded-lg">
                <MessageSquare size={20} />
             </span>
             사용자 지원
          </SheetTitle>
          <div className="text-sm text-gray-500 mt-1">
             <span className="font-bold text-gray-900">{userName}</span> ({email})님에 대한 지원 도구
          </div>
        </SheetHeader>

        <div className="space-y-8">
            {/* 1. Message Test Section */}
            <section className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center justify-between">
                    메세지 발송 테스트
                    {/* <span className="text-[10px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Admin Only</span> */}
                </h3>
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex items-start gap-3 mb-4">
                        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                        <p className="text-xs text-gray-600 leading-relaxed">
                            사용자 알림 수신 여부를 확인하기 위해 테스트 메세지를 발송합니다.
                        </p>
                    </div>

                    <div className="flex justify-end">
                        <Button 
                            onClick={handleSendTestMessage} 
                            disabled={sending}
                            variant="primary" // Assuming primary is the standard blue/brand color
                            className="gap-2"
                        >
                            {sending ? <RefreshCw className="animate-spin" size={16}/> : <Send size={16} />}
                            테스트 메세지 발송
                        </Button>
                    </div>
                </div>
            </section>

            {/* Device Token Management */}
            <section className="space-y-4">
                 <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-bold text-gray-900">
                        기기 토큰 관리
                    </h3>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0" 
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
                        <div className="p-4 rounded-xl border border-dashed border-gray-300 text-center text-xs text-gray-400">
                            등록된 기기(토큰)가 없습니다.
                        </div>
                    ) : (
                        tokens.map((token, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm text-xs">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="bg-gray-100 p-1.5 rounded text-gray-500">
                                        <Smartphone size={16} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-medium text-gray-700 truncate max-w-[180px]">
                                            {token.substring(0, 10)}...{token.substring(token.length - 10)}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                            Device #{idx + 1}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => handleDeleteToken(token)}
                                >
                                    <Trash2 size={16} /> 
                                </Button>
                            </div>
                        ))
                    )}
                </div>
                
                <div className="bg-blue-50 rounded-lg overflow-hidden">
                    <button 
                        onClick={() => setShowTokenHelp(!showTokenHelp)}
                        className="w-full flex items-center justify-between p-3 text-left"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-blue-500">💡</span>
                            <span className="text-xs font-bold text-blue-700">토큰 삭제가 필요한 경우는?</span>
                        </div>
                        {showTokenHelp ? (
                            <ChevronDown size={14} className="text-blue-400" />
                        ) : (
                            <ChevronRight size={14} className="text-blue-400" />
                        )}
                    </button>
                    
                    {showTokenHelp && (
                        <div className="px-3 pb-3 pt-0">
                            <p className="text-[11px] text-blue-700 leading-snug pl-6 border-l-2 border-blue-200">
                                1. 사용자가 기기를 변경했거나 더 이상 사용하지 않는 기기가 목록에 남아있을 때<br/>
                                2. 알림이 특정 기기로만 오지 않거나, 중복으로 발송될 때<br/>
                                3. 너무 많은 토큰이 쌓여 발송 오류가 발생할 때
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
