import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, RefreshCw, Bell, Search, MoreHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { db, functions } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import dayjs from 'dayjs';
import { useSession } from '@/state/session';
import { httpsCallable } from 'firebase/functions';

interface NotificationLog {
  id: string;
  created_at: any;
  title: string;
  body: string;
  data?: any;
  target_uids?: string[];
  target_device_count?: number;
  success_count?: number;
  failure_count?: number;
  status: string;
  click_action?: string;
  feature?: string;
  server_group_id?: string;
  triggered_by?: string;
  triggered_by_name?: string;
  trigger_status?: string;
}

export default function NotificationManagement() {
  const navigate = useNavigate();
  const session = useSession();
  
  // History Log State
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchLogs = async (isLoadMore = false) => {
    try {
      setIsLoadingLogs(true);
      // Query Top-Level Collection 'system_notification_logs'
      let q = query(
        collection(db, 'system_notification_logs'),
        orderBy('created_at', 'desc'),
        limit(50)
      );

      if (isLoadMore && lastDoc) {
          q = query(
            collection(db, 'system_notification_logs'),
            orderBy('created_at', 'desc'),
            startAfter(lastDoc),
            limit(50)
          );
      }
      
      const snap = await getDocs(q);
      const fetchedLogs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NotificationLog[];
      
      if (isLoadMore) {
          setLogs(prev => [...prev, ...fetchedLogs]);
      } else {
          setLogs(fetchedLogs);
      }

      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === 50);

    } catch (e: any) {
      console.error(e);
      toast.error('로그를 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSendTest = async () => {
      if (!session.user?.uid) {
          toast.error('로그인 정보가 없습니다.');
          return;
      }
      
      try {
          setIsSendingTest(true);
          const sendTest = httpsCallable(functions, 'sendTestNotification');
          const res = await sendTest({ targetUid: session.user.uid });
          const data = res.data as any;
          
          if (data.success) {
              toast.success('발송 성공! 잠시 후 목록을 갱신합니다.');
              setTimeout(fetchLogs, 2000);
          } else {
              toast.error(`발송 실패: ${data.message}`);
          }
      } catch(e: any) {
          console.error(e);
          toast.error(`에러 발생: ${e.message}`);
      } finally {
          setIsSendingTest(false);
      }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
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
          <Bell className="w-5 h-5 text-amber-500" />
          Notification 설정 및 이력 관리
        </h1>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* 발송 이력 조회 카드 */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    통합 발송 이력 (최근 50건)
                </h2>
                <div className="flex items-center gap-2">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleSendTest} 
                        disabled={isSendingTest}
                        className="text-xs h-8"
                    >
                        {isSendingTest ? '발송 중...' : '🔔 나에게 테스트 발송'}
                    </Button>
                    <button 
                      onClick={() => fetchLogs(false)}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
                      title="새로고침"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap w-[160px]">일시</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">유형 / 트리거</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">제목</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">내용</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">발송 대상</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">상태</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {logs.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                                {isLoadingLogs ? '로딩 중...' : '발송 이력이 없습니다.'}
                            </td>
                        </tr>
                    ) : (
                        logs.map((log) => (
                        <tr 
                            key={log.id} 
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedLog(log)}
                        >
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 font-mono">
                                {formatDate(log.created_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1 items-start">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${
                                        log.feature === 'TEST_SEND' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                                        log.feature === 'MASS_REMINDER' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' :
                                        'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                    }`}>
                                        {log.feature || 'unknown'}
                                    </span>
                                    {log.trigger_status && (
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                            {log.trigger_status}
                                        </span>
                                    )}
                                    {(log.triggered_by_name || log.triggered_by) && (
                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 truncate max-w-[120px]" title={log.triggered_by}>
                                            by {log.triggered_by_name || 'User'}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-slate-100">
                                {log.title || '(제목 없음)'}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                <div className="flex items-center gap-1 group">
                                    <span className="truncate max-w-[200px]">
                                        {log.body?.length > 30 ? `${log.body.slice(0, 30)}...` : log.body}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                                {log.target_uids?.length || 0} 명
                                <span className="text-slate-400 ml-1">({log.success_count || 0} 성공)</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                {log.status === 'success' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                        성공
                                    </span>
                                ) : (
                                    <span className="text-xs text-gray-500">{log.status}</span>
                                )}
                            </td>
                        </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>
            
            {/* Load More Button */}
            {hasMore && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-center">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => fetchLogs(true)}
                        disabled={isLoadingLogs}
                        className="text-slate-500 dark:text-slate-400"
                    >
                        {isLoadingLogs ? '로딩 중...' : '더 보기'}
                    </Button>
                </div>
            )}
        </section>
      </div>

      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <SheetContent className="w-[310px] sm:w-[360px] sm:max-w-[360px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>알림 상세 정보</SheetTitle>
            <SheetDescription>
                발송 이력 상세 내용입니다.
            </SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="space-y-6">
                <div>
                     <span className="text-slate-500 block text-xs mb-1">발송 일시</span>
                     <span className="font-mono text-slate-900 dark:text-slate-200 text-sm">
                         {formatDate(selectedLog.created_at)}
                     </span>
                </div>
                 <div>
                      <span className="text-slate-500 block text-xs mb-1">발송 유형 (Feature)</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {selectedLog.feature || 'unknown'}
                        </span>
                        {selectedLog.server_group_id && (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800">
                                G: {selectedLog.server_group_id}
                            </span>
                        )}
                        {selectedLog.trigger_status && (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800">
                                {selectedLog.trigger_status}
                            </span>
                        )}
                        {(selectedLog.triggered_by_name || selectedLog.triggered_by) && (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700" title={selectedLog.triggered_by}>
                                👤 {selectedLog.triggered_by_name || 'User'}
                            </span>
                        )}
                      </div>
                 </div>
                <div>
                     <span className="text-slate-500 block text-xs mb-1">제목</span>
                     <span className="font-bold text-slate-900 dark:text-slate-200 text-sm">
                         {selectedLog.title}
                     </span>
                </div>
                <div>
                     <span className="text-slate-500 block text-xs mb-1">내용</span>
                     <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm text-slate-800 dark:text-slate-300 whitespace-pre-wrap">
                         {selectedLog.body}
                     </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <span className="text-slate-500 block text-xs mb-1">대상 인원 (User)</span>
                        <span className="font-mono font-bold">{selectedLog.target_uids?.length || 0}</span>
                     </div>
                     <div>
                        <span className="text-slate-500 block text-xs mb-1">대상 기기 (Device)</span>
                        <span className="font-mono font-bold">{selectedLog.target_device_count || 0}</span>
                     </div>
                     <div>
                        <span className="block text-xs mb-1 text-green-600">성공</span>
                        <span className="font-mono font-bold text-green-600">{selectedLog.success_count || 0}</span>
                     </div>
                     <div>
                        <span className="block text-xs mb-1 text-red-500">실패</span>
                        <span className="font-mono font-bold text-red-500">{selectedLog.failure_count || 0}</span>
                     </div>
                </div>

                {selectedLog.target_uids && selectedLog.target_uids.length > 0 && (
                     <div>
                        <span className="text-slate-500 block text-xs mb-1">대상 UID 목록</span>
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-[10px] font-mono max-h-[100px] overflow-y-auto">
                            {selectedLog.target_uids.join(', ')}
                        </div>
                     </div>
                )}

                <div>
                     <span className="text-slate-500 block text-xs mb-1">메타데이터 (JSON)</span>
                     <div className="bg-slate-900 rounded-lg p-3">
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(selectedLog, null, 2)}
                        </pre>
                    </div>
                </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
