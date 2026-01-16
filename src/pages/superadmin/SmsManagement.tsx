import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, RefreshCw, Smartphone, Search, MoreHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

interface SmsLog {
  id: string;
  created_at: any;
  sender: string;
  sender_phone?: string;
  receiver: string;
  message: string;
  status: string; // 'success' | 'failed'
  result_code?: string;
  result_message?: string;
  group_id?: string;
  message_type?: string;
  parish_code?: string;
  server_group_id?: string;
  error?: any;
  sender_email?: string;
}

export default function SmsManagement() {
  const navigate = useNavigate();
  
  // Test Send State
  const [smsReceiver, setSmsReceiver] = useState('01020879969');
  const [smsMessage, setSmsMessage] = useState('[알림] 미사일정 알림 테스트입니다.');
  const [isSendingSms, setIsSendingSms] = useState(false);

  // History Log State
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SmsLog | null>(null);
  
  // Cache for names
  
  // Cache for names
  const [parishMap, setParishMap] = useState<Record<string, string>>({});
  const [serverGroupMap, setServerGroupMap] = useState<Record<string, string>>({});

  const fetchNames = async () => {
      // 1. Fetch Parishes
      const parishSnap = await getDocs(collection(db, 'parishes'));
      const pMap: Record<string, string> = {};
      parishSnap.forEach(d => {
          pMap[d.id] = d.data().name_kor || d.id;
      });
      setParishMap(pMap);

      // 2. Fetch Server Groups (This might become expensive if there are many groups, but for now it's okay)
      const groupSnap = await getDocs(collection(db, 'server_groups'));
      const sgMap: Record<string, string> = {};
      groupSnap.forEach(d => {
          sgMap[d.id] = d.data().name || d.id;
      });
      setServerGroupMap(sgMap);
  };

  useEffect(() => {
    fetchNames();
  }, []);

  const fetchLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const q = query(
        collection(db, 'sms_logs'),
        orderBy('created_at', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const fetchedLogs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SmsLog[];
      setLogs(fetchedLogs);
    } catch (e) {
      console.error(e);
      toast.error('로그를 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSendTestSms = async () => {
    if (!smsReceiver || !smsMessage) {
      toast.error('수신번호와 내용을 입력해주세요.');
      return;
    }

    try {
      setIsSendingSms(true);
      const sendSms = httpsCallable(functions, 'sendSms');
      
      const cleanReceiver = smsReceiver.replace(/-/g, '');
      
      const result = await sendSms({
        receiver: cleanReceiver,
        msg: smsMessage,
      });

      const data = result.data as any;
      if (data.success) {
        const groupId = data.data?.groupInfo?._id || 'Unknown';
        toast.success(`발송 성공 (Group ID: ${groupId})`);
        // Refresh logs after short delay
        setTimeout(fetchLogs, 2000);
      } else {
        toast.error('발송 실패: 서버 응답 확인 필요');
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`발송 에러: ${e.message}`);
    } finally {
      setIsSendingSms(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    // Handle Firestore Timestamp or standard Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    
    // Check if same month and year
    if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const time = date.toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        return `[${month}.${day}] ${time}`;
    } else {
         return date.toLocaleString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '-';
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (cleaned.length === 10) {
      // 02-1234-5678 or 010-123-5678 (old format)
      if (cleaned.startsWith('02')) {
          return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
      }
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    } else if (cleaned.length === 8) {
        return cleaned.replace(/(\d{4})(\d{4})/, '$1-$2');
    }
    
    return phone;
  };

  return (
    <div className="-m-2 min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button 
          onClick={() => navigate('/superadmin')}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-violet-600" />
          SMS 문자 관리
        </h1>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* 1. 테스트 발송 카드 */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              테스트 발송
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                   수신 번호
                 </label>
                 <input 
                   type="text" 
                   value={smsReceiver}
                   onChange={(e) => setSmsReceiver(e.target.value)}
                   placeholder="01012345678"
                   className="w-full border border-slate-300 dark:border-slate-700 rounded-md p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                 />
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                   메세지 내용
                 </label>
                 <textarea 
                   rows={5}
                   value={smsMessage}
                   onChange={(e) => setSmsMessage(e.target.value)}
                   className="w-full border border-slate-300 dark:border-slate-700 rounded-md p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                 />
                 <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-slate-500">{smsMessage.length} / 2000 bytes</p>
                    <span className="text-xs text-slate-400">90바이트 초과 시 LMS 자동 전환</span>
                 </div>
               </div>

               <Button 
                onClick={handleSendTestSms}
                disabled={isSendingSms}
                variant="primary"
                className="w-full"
               >
                 {isSendingSms ? '발송 중...' : '테스트 문자 발송'}
               </Button>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-6 flex flex-col justify-center items-center text-center text-slate-500 dark:text-slate-400 text-sm">
                <Smartphone className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                <p>문자 발송 전 발신번호 설정을 확인하세요.</p>
                <p className="mt-1">현재 설정된 서비스: Solapi</p>
            </div>
          </div>
        </section>

        {/* 2. 발송 이력 조회 카드 */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    발송 이력 (최근 50건)
                </h2>
                <button 
                  onClick={fetchLogs}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
                  title="새로고침"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                </button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap w-[140px]">일시</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">수신번호</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">복사단</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">내용</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">상태</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Group ID</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {logs.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                                발송 이력이 없습니다.
                            </td>
                        </tr>
                    ) : (
                        logs.map((log) => (
                        <tr 
                            key={log.id} 
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedLog(log)}
                        >
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                                {formatDate(log.created_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100 font-mono">
                                {formatPhoneNumber(log.receiver)}
                            </td>
                             <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                                {log.parish_code && parishMap[log.parish_code] 
                                    ? (
                                        <>
                                            <div className="font-bold text-slate-700 dark:text-slate-300">
                                                {parishMap[log.parish_code]}
                                            </div>
                                            {log.server_group_id && serverGroupMap[log.server_group_id] && (
                                                <div className="text-slate-500 text-[11px]">
                                                    {serverGroupMap[log.server_group_id]}
                                                </div>
                                            )}
                                        </>
                                      )
                                    : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                <div className="flex items-center gap-1 group">
                                    <span className="truncate max-w-[120px]">
                                        {log.message.length > 12 ? `${log.message.slice(0, 12)}...` : log.message}
                                    </span>
                                    {log.message.length > 12 && (
                                        <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                                            <MoreHorizontal size={12} />
                                        </button>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                {log.status === 'success' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                        성공
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                        실패
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-slate-400 font-mono">
                                {log.group_id || '-'}
                            </td>
                        </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
        </section>

      </div>

      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="w-[310px] sm:w-[360px] sm:max-w-[360px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>SMS 상세 정보</SheetTitle>
            <SheetDescription>
                발송 이력 상세 내용입니다.
            </SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="space-y-6">
                {/* 기본 정보 */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b pb-2 dark:border-slate-800">
                        기본 정보
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500 block text-xs mb-1">발송 일시</span>
                            <span className="font-mono text-slate-900 dark:text-slate-200">
                                {formatDate(selectedLog.created_at)}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500 block text-xs mb-1">상태</span>
                             {selectedLog.status === 'success' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                    성공
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                    실패
                                </span>
                            )}
                        </div>
                        <div>
                            <span className="text-slate-500 block text-xs mb-1">수신 번호</span>
                            <span className="font-mono text-slate-900 dark:text-slate-200">{formatPhoneNumber(selectedLog.receiver)}</span>
                        </div>
                         <div>
                            <span className="text-slate-500 block text-xs mb-1">발신자</span>
                            <span className="text-slate-900 dark:text-slate-200">{selectedLog.sender || selectedLog.sender_email || '-'}</span>
                        </div>
                    </div>
                </div>

                {/* 소속 정보 */}
                <div className="space-y-4">
                     <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b pb-2 dark:border-slate-800">
                        소속 정보
                    </h3>
                     <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">성당</span>
                            <span className="font-medium text-slate-900 dark:text-slate-200">
                                {selectedLog.parish_code ? (parishMap[selectedLog.parish_code] || selectedLog.parish_code) : '-'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">복사단</span>
                            <span className="font-medium text-slate-900 dark:text-slate-200">
                                {selectedLog.server_group_id ? (serverGroupMap[selectedLog.server_group_id] || selectedLog.server_group_id) : '-'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Group ID (Solapi)</span>
                            <span className="font-mono text-slate-900 dark:text-slate-200">{selectedLog.group_id || '-'}</span>
                        </div>
                     </div>
                </div>

                {/* 메세지 내용 */}
                <div className="space-y-4">
                     <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b pb-2 dark:border-slate-800">
                        메세지 내용
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-300 leading-relaxed max-h-[300px] overflow-y-auto">
                        {selectedLog.message}
                    </div>
                </div>

                 {/* 결과 상세 (JSON) */}
                 {(selectedLog.result_message || selectedLog.error || selectedLog.result_code) && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b pb-2 dark:border-slate-800">
                            결과 상세
                         </h3>
                         <div className="bg-slate-900 rounded-lg p-3">
                            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
                                {JSON.stringify({
                                    result_code: selectedLog.result_code,
                                    result_message: selectedLog.result_message,
                                    error: selectedLog.error
                                }, null, 2)}
                            </pre>
                        </div>
                    </div>
                 )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
