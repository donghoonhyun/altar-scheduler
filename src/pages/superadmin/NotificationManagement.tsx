import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, RefreshCw, Bell, Send, RotateCcw, AlertCircle,
  CheckCircle2, Clock, Zap, List, Activity, Trash2
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { db, functions } from '@/lib/firebase';
import {
  collection, query, orderBy, limit, getDocs, where,
  startAfter, Timestamp, onSnapshot
} from 'firebase/firestore';
import dayjs from 'dayjs';
import { useSession } from '@/state/session';
import { COLLECTIONS } from '@/lib/collections';
import { callNotificationApi } from '@/lib/notificationApi';

// ── 타입 ─────────────────────────────────────────────────────────────────────
type FcmStatus = 'pending' | 'processing' | 'sent' | 'partial' | 'failed';

interface NotificationDoc {
  id: string;
  title: string;
  body: string;
  click_action?: string;
  target_uids?: string[];
  app_id?: string;
  feature?: string;
  server_group_id?: string;
  triggered_by?: string;
  triggered_by_name?: string;
  fcm_status: FcmStatus;
  fcm_sent_at?: Timestamp;
  fcm_batch_id?: string;
  fcm_result?: {
    success_count: number;
    failure_count: number;
    errors?: { uid: string; token: string; error: string }[];
  };
  retry_count: number;
  last_error?: string;
  manual_retry_by?: string;
  manual_retry_at?: Timestamp;
  created_at: Timestamp;
  updated_at?: Timestamp;
}

interface FcmLog {
  id: string;
  notification_id: string;
  batch_id: string;
  app_id?: string;
  feature?: string;
  title: string;
  body: string;
  target_uid_count: number;
  token_count: number;
  success_count: number;
  failure_count: number;
  status: string;
  errors?: { uid: string; token: string; error: string }[];
  invalid_tokens_removed?: number;
  trigger_type: 'scheduled' | 'manual';
  triggered_by?: string;
  created_at: Timestamp;
}

interface RecipientDevice {
  uid: string;
  user_name: string;
  token: string;
  failed: boolean;
  error_code: string | null;
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<FcmStatus, { label: string; icon: React.ReactNode; className: string }> = {
  pending:    { label: '대기중',   icon: <Clock className="w-3 h-3" />,        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
  processing: { label: '처리중',   icon: <Activity className="w-3 h-3" />,     className: 'bg-blue-50  text-blue-700  border-blue-200  dark:bg-blue-900/30  dark:text-blue-300  dark:border-blue-800' },
  sent:       { label: '발송완료', icon: <CheckCircle2 className="w-3 h-3" />, className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
  partial:    { label: '부분성공', icon: <AlertCircle className="w-3 h-3" />,  className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' },
  failed:     { label: '실패',     icon: <AlertCircle className="w-3 h-3" />,  className: 'bg-red-50   text-red-700   border-red-200   dark:bg-red-900/30   dark:text-red-300   dark:border-red-800' },
};

const FEATURE_COLORS: Record<string, string> = {
  TEST_SEND:          'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  MASS_REMINDER:      'bg-blue-100  text-blue-800  dark:bg-blue-900/40  dark:text-blue-300',
  MEMBER_APPLICATION: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  ROLE_REQUEST:       'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  SURVEY_OPENED:      'bg-sky-100    text-sky-800    dark:bg-sky-900/40    dark:text-sky-300',
  SURVEY_CLOSED:      'bg-pink-100   text-pink-800   dark:bg-pink-900/40   dark:text-pink-300',
  MONTHLY_STATUS:     'bg-teal-100   text-teal-800   dark:bg-teal-900/40   dark:text-teal-300',
};

const formatDate = (ts: Timestamp | undefined) => {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts as any);
  return dayjs(d).format('MM/DD HH:mm:ss');
};

const formatRecentMinutes = (ts: Timestamp | undefined, nowMs: number = Date.now()) => {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts as any);
  const diffMin = Math.floor((nowMs - d.getTime()) / 60000);
  if (diffMin < 0 || diffMin > 10) return null;
  if (diffMin < 1) return '방금';
  return `${diffMin}분전`;
};

// ── 컴포넌트: 상태 뱃지 ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: FcmStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.failed;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.className}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ── 컴포넌트: Feature 뱃지 ────────────────────────────────────────────────
function FeatureBadge({ feature }: { feature?: string }) {
  if (!feature) return null;
  const cls = FEATURE_COLORS[feature] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${cls}`}>{feature}</span>;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export default function NotificationManagement() {
  const navigate = useNavigate();
  const session = useSession();
  const [nowMs, setNowMs] = useState(() => Date.now());

  // 탭
  const [activeTab, setActiveTab] = useState<'queue' | 'logs'>('queue');

  // 알림 큐 상태
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const [lastNotifDoc, setLastNotifDoc] = useState<any>(null);
  const [hasMoreNotifs, setHasMoreNotifs] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<NotificationDoc | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [recipientDevices, setRecipientDevices] = useState<RecipientDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isDeletingDevices, setIsDeletingDevices] = useState(false);
  const [isDeletingNotification, setIsDeletingNotification] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'success' | 'failed'>('all');

  // FCM 발송 이력
  const [fcmLogs, setFcmLogs] = useState<FcmLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [lastLogDoc, setLastLogDoc] = useState<any>(null);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);

  // 테스트 발송
  const [isSendingTest, setIsSendingTest] = useState(false);

  // 큐 통계
  const [queueStats, setQueueStats] = useState({ pending: 0, failed: 0, partial: 0 });

  // ── 알림 큐 조회 ────────────────────────────────────────────────────────
  const fcmLogsCollectionRef = collection(db, COLLECTIONS.FCM_LOGS);

  const applyQueueStats = (data: NotificationDoc[]) => {
    const pending = data.filter(n => n.fcm_status === 'pending').length;
    const failed  = data.filter(n => n.fcm_status === 'failed').length;
    const partial = data.filter(n => n.fcm_status === 'partial').length;
    setQueueStats({ pending, failed, partial });
  };

  const syncSelectedNotification = (data: NotificationDoc[]) => {
    if (!selectedNotif) return;
    const latest = data.find(n => n.id === selectedNotif.id);
    if (latest) setSelectedNotif(latest);
  };

  const fetchNotifications = useCallback(async (isLoadMore = false) => {
    setIsLoadingNotifs(true);
    try {
      let q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        orderBy('created_at', 'desc'),
        limit(30)
      );
      if (isLoadMore && lastNotifDoc) {
        q = query(
          collection(db, COLLECTIONS.NOTIFICATIONS),
          orderBy('created_at', 'desc'),
          startAfter(lastNotifDoc),
          limit(30)
        );
      }
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as NotificationDoc[];

      if (isLoadMore) setNotifications(prev => [...prev, ...data]);
      else {
        setNotifications(data);
        applyQueueStats(data);
        syncSelectedNotification(data);
      }

      setLastNotifDoc(snap.docs[snap.docs.length - 1]);
      setHasMoreNotifs(snap.docs.length === 30);
    } catch (e: any) {
      toast.error('알림 목록을 불러오지 못했습니다.');
      console.error(e);
    } finally {
      setIsLoadingNotifs(false);
    }
  }, [lastNotifDoc]);

  // ── FCM 이력 조회 ────────────────────────────────────────────────────────
  const fetchFcmLogs = useCallback(async (isLoadMore = false) => {
    setIsLoadingLogs(true);
    try {
      let q = query(
        fcmLogsCollectionRef,
        orderBy('created_at', 'desc'),
        limit(30)
      );
      if (isLoadMore && lastLogDoc) {
        q = query(
          fcmLogsCollectionRef,
          orderBy('created_at', 'desc'),
          startAfter(lastLogDoc),
          limit(30)
        );
      }
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as FcmLog[];

      if (isLoadMore) setFcmLogs(prev => [...prev, ...data]);
      else setFcmLogs(data);

      setLastLogDoc(snap.docs[snap.docs.length - 1]);
      setHasMoreLogs(snap.docs.length === 30);
    } catch (e: any) {
      toast.error('FCM 이력을 불러오지 못했습니다.');
    } finally {
      setIsLoadingLogs(false);
    }
  }, [lastLogDoc]);

  useEffect(() => {
    fetchNotifications();
    fetchFcmLogs();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  // ── 실시간 구독: 알림 큐 / FCM 로그 (최신 30건) ───────────────────────────
  useEffect(() => {
    const notiQuery = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      orderBy('created_at', 'desc'),
      limit(30)
    );

    const unsubNoti = onSnapshot(notiQuery, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as NotificationDoc[];
      setNotifications(data);
      setLastNotifDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMoreNotifs(snap.docs.length === 30);
      applyQueueStats(data);
      syncSelectedNotification(data);
      setIsLoadingNotifs(false);
    }, (e) => {
      console.error('notifications realtime error:', e);
    });

    const logsQuery = query(
      fcmLogsCollectionRef,
      orderBy('created_at', 'desc'),
      limit(30)
    );

    const unsubLogs = onSnapshot(logsQuery, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as FcmLog[];
      setFcmLogs(data);
      setLastLogDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMoreLogs(snap.docs.length === 30);
      setIsLoadingLogs(false);
    }, (e) => {
      console.error('fcm logs realtime error:', e);
    });

    return () => {
      unsubNoti();
      unsubLogs();
    };
  }, [selectedNotif]);

  // ── 테스트 발송 ──────────────────────────────────────────────────────────
  const handleSendTest = async () => {
    if (!session.user?.uid) { toast.error('로그인 정보가 없습니다.'); return; }
    setIsSendingTest(true);
    try {
      const res = await callNotificationApi<any>(functions, { action: 'enqueue_test', targetUid: session.user.uid });
      if (res.success) {
        toast.success('테스트 알림이 대기열에 등록되었습니다. 목록을 갱신합니다.');
        setTimeout(() => { fetchNotifications(); fetchFcmLogs(); }, 2000);
      } else {
        toast.error(`실패: ${res.message}`);
      }
    } catch (e: any) {
      toast.error(`에러: ${e.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  // ── 수동 재발송 ──────────────────────────────────────────────────────────
  const handleRetry = async (notif: NotificationDoc, action: 'retry' | 'force_send') => {
    setRetryingId(notif.id);
    try {
      const res = await callNotificationApi<any>(functions, { notificationId: notif.id, action });
      if (res.success) {
        toast.success(res.message);
        setTimeout(fetchNotifications, 1000);
      } else {
        toast.error(`실패: ${res.message}`);
      }
    } catch (e: any) {
      toast.error(`에러: ${e.message}`);
    } finally {
      setRetryingId(null);
      setSelectedNotif(null);
    }
  };

  const tabs = [
    { key: 'queue', label: '알림 큐', icon: <List className="w-4 h-4" /> },
    { key: 'logs',  label: 'FCM 발송 이력', icon: <Activity className="w-4 h-4" /> },
  ] as const;

  const maskToken = (token: string) => {
    if (!token || token.length < 18) return token;
    return `${token.slice(0, 10)}...${token.slice(-8)}`;
  };

  const successDevicesCount = recipientDevices.filter((d) => !d.failed).length;
  const failedDevicesCount = recipientDevices.filter((d) => d.failed).length;
  const filteredRecipientDevices = recipientDevices.filter((d) => {
    if (deviceFilter === 'success') return !d.failed;
    if (deviceFilter === 'failed') return d.failed;
    return true;
  });

  const loadRecipientDevices = useCallback(async (notificationId: string) => {
    setIsLoadingDevices(true);
    try {
      const res = await callNotificationApi<any>(functions, {
        action: 'get_target_devices',
        notificationId,
      });

      if (res?.success) {
        const devices = Array.isArray(res.devices) ? res.devices : [];
        setRecipientDevices(devices);
      } else {
        setRecipientDevices([]);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`수신 기기 조회 실패: ${e.message}`);
      setRecipientDevices([]);
    } finally {
      setIsLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedNotif?.id) {
      setRecipientDevices([]);
      setDeviceFilter('all');
      return;
    }
    loadRecipientDevices(selectedNotif.id);
  }, [selectedNotif?.id, loadRecipientDevices]);

  const handleDeleteFailedDevices = async (tokens?: string[]) => {
    if (!selectedNotif?.id) return;
    setIsDeletingDevices(true);
    try {
      const res = await callNotificationApi<any>(functions, {
        action: 'delete_failed_devices',
        notificationId: selectedNotif.id,
        tokens: tokens || [],
      });

      if (res?.success) {
        toast.success(res.message || '실패 기기를 삭제했습니다.');
        await loadRecipientDevices(selectedNotif.id);
      } else {
        toast.error(res?.message || '삭제 실패');
      }
    } catch (e: any) {
      toast.error(`실패 기기 삭제 오류: ${e.message}`);
    } finally {
      setIsDeletingDevices(false);
    }
  };

  const handleDeleteNotification = async () => {
    if (!selectedNotif?.id) return;
    const ok = window.confirm('이 알림 건을 삭제하시겠습니까?');
    if (!ok) return;

    setIsDeletingNotification(true);
    try {
      const res = await callNotificationApi<any>(functions, {
        action: 'delete_notification',
        notificationId: selectedNotif.id,
      });

      if (res?.success) {
        toast.success(res.message || '알림을 삭제했습니다.');
        setSelectedNotif(null);
      } else {
        toast.error(res?.message || '삭제 실패');
      }
    } catch (e: any) {
      toast.error(`알림 삭제 오류: ${e.message}`);
    } finally {
      setIsDeletingNotification(false);
    }
  };

  return (
    <div className="-m-2 min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate('/superadmin')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-500" />
          알림 관리
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleSendTest} disabled={isSendingTest} className="text-xs h-8 gap-1">
            <Send className="w-3 h-3" />
            {isSendingTest ? '발송 중...' : '나에게 테스트'}
          </Button>
          <button
            onClick={() => { fetchNotifications(); fetchFcmLogs(); }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingNotifs || isLoadingLogs ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '대기중', count: queueStats.pending, cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
            { label: '실패', count: queueStats.failed, cls: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
            { label: '부분성공', count: queueStats.partial, cls: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 text-center ${s.bg}`}>
              <div className={`text-2xl font-bold ${s.cls}`}>{s.count}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 배치 처리 안내 */}
        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          <Zap className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">비동기 큐 처리 방식</span>으로 운영 중입니다.
            pending 상태 알림은 <span className="font-semibold">매 1분마다</span> 자동 배치 FCM 발송됩니다.
            실패 건은 최대 3회 자동 재시도되며, 아래에서 수동으로도 재발송할 수 있습니다.
          </div>
        </div>

        {/* 탭 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors ${
                  activeTab === tab.key
                    ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 -mb-px bg-amber-50/50 dark:bg-amber-900/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* ── 탭 1: 알림 큐 ── */}
          {activeTab === 'queue' && (
            <div>
              {/* 필터 없이 전체 조회 - 상태별로 색으로 구분 */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoadingNotifs && notifications.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">로딩 중...</div>
                ) : notifications.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">알림이 없습니다.</div>
                ) : (
                  notifications.map(n => {
                    const recent = formatRecentMinutes(n.created_at, nowMs);
                    return (
                    <div
                      key={n.id}
                      onClick={() => setSelectedNotif(n)}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      {/* 상태 */}
                      <div className="shrink-0">
                        <StatusBadge status={n.fcm_status} />
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{n.title}</span>
                          <FeatureBadge feature={n.feature} />
                          {n.retry_count > 0 && (
                            <span className="text-[10px] text-slate-400">재시도 {n.retry_count}회</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{n.body}</div>
                        {n.last_error && (
                          <div className="text-[11px] text-red-500 mt-0.5 truncate">⚠ {n.last_error}</div>
                        )}
                      </div>

                      {/* 메타 */}
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-slate-400 font-mono">{formatDate(n.created_at)}</div>
                        {recent && (
                          <div className="text-[10px] text-indigo-500 font-semibold">
                            {recent}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {n.target_uids?.length || 0}명
                          {n.fcm_result && (
                            <span className="ml-1 text-green-600 dark:text-green-400">
                              ✓{n.fcm_result.success_count}
                              {n.fcm_result.failure_count > 0 && (
                                <span className="text-red-500"> ✗{n.fcm_result.failure_count}</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>

              {hasMoreNotifs && (
                <div className="p-4 text-center border-t border-slate-100 dark:border-slate-800">
                  <Button variant="ghost" size="sm" onClick={() => fetchNotifications(true)} disabled={isLoadingNotifs}>
                    더 보기
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── 탭 2: FCM 발송 이력 ── */}
          {activeTab === 'logs' && (
            <div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoadingLogs && fcmLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">로딩 중...</div>
                ) : fcmLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">발송 이력이 없습니다.</div>
                ) : (
                  fcmLogs.map(log => {
                    const recent = formatRecentMinutes(log.created_at, nowMs);
                    return (
                    <div key={log.id} className="flex items-center gap-4 px-5 py-3.5">
                      {/* 상태 */}
                      <div className="shrink-0">
                        {log.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                            <CheckCircle2 className="w-3 h-3" />발송완료
                          </span>
                        ) : log.status === 'partial' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800">
                            <AlertCircle className="w-3 h-3" />부분성공
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                            <AlertCircle className="w-3 h-3" />실패
                          </span>
                        )}
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{log.title}</span>
                          <FeatureBadge feature={log.feature} />
                          {log.trigger_type === 'manual' && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-1.5 py-0.5 rounded font-medium">수동</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          대상 {log.target_uid_count}명 · 성공 <span className="text-green-600 font-semibold">{log.success_count}</span> · 실패 <span className="text-red-500 font-semibold">{log.failure_count}</span>
                          {(log.invalid_tokens_removed ?? 0) > 0 && (
                            <span className="text-slate-400 ml-2">무효 토큰 {log.invalid_tokens_removed}개 정리</span>
                          )}
                        </div>
                      </div>

                      {/* 메타 */}
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-slate-400 font-mono">{formatDate(log.created_at)}</div>
                        {recent && (
                          <div className="text-[10px] text-indigo-500 font-semibold">
                            {recent}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5 font-mono truncate max-w-[100px]">{log.batch_id}</div>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>

              {hasMoreLogs && (
                <div className="p-4 text-center border-t border-slate-100 dark:border-slate-800">
                  <Button variant="ghost" size="sm" onClick={() => fetchFcmLogs(true)} disabled={isLoadingLogs}>
                    더 보기
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 알림 상세 Sheet ── */}
      <Sheet open={!!selectedNotif} onOpenChange={open => !open && setSelectedNotif(null)}>
        <SheetContent className="w-[340px] sm:w-[400px] sm:max-w-[400px] overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle>알림 상세</SheetTitle>
            <SheetDescription>상태 확인 및 수동 재발송</SheetDescription>
          </SheetHeader>

          {selectedNotif && (
            <div className="space-y-5 text-sm">
              {/* 상태 */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">FCM 상태</span>
                <StatusBadge status={selectedNotif.fcm_status} />
              </div>

              {/* Feature / 그룹 */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">유형</span>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  <FeatureBadge feature={selectedNotif.feature} />
                  {selectedNotif.app_id && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">{selectedNotif.app_id}</span>
                  )}
                  {selectedNotif.server_group_id && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">{selectedNotif.server_group_id}</span>
                  )}
                </div>
              </div>

              {/* 내용 */}
              <div>
                <span className="text-slate-500 block mb-1">제목</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{selectedNotif.title}</div>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">내용</span>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {selectedNotif.body}
                </div>
              </div>

              {/* 발송 결과 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{selectedNotif.target_uids?.length || 0}</div>
                  <div className="text-[11px] text-slate-500">대상</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-green-700 dark:text-green-400">{selectedNotif.fcm_result?.success_count ?? '-'}</div>
                  <div className="text-[11px] text-slate-500">성공</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-red-600 dark:text-red-400">{selectedNotif.fcm_result?.failure_count ?? '-'}</div>
                  <div className="text-[11px] text-slate-500">실패</div>
                </div>
              </div>

              {/* 오류 */}
              {selectedNotif.last_error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="text-[11px] font-semibold text-red-600 dark:text-red-400 mb-1">마지막 오류</div>
                  <div className="text-xs text-red-700 dark:text-red-300 font-mono">{selectedNotif.last_error}</div>
                </div>
              )}

              {/* 타임스탬프 */}
              <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                <div>생성: {formatDate(selectedNotif.created_at)}</div>
                {selectedNotif.triggered_by_name && (
                  <div className="font-sans text-slate-500">
                    발신자: {selectedNotif.triggered_by_name}
                    {selectedNotif.triggered_by && (
                      <span className="ml-1 text-[10px] text-slate-400">({selectedNotif.triggered_by})</span>
                    )}
                  </div>
                )}
                {selectedNotif.fcm_sent_at && <div>발송: {formatDate(selectedNotif.fcm_sent_at)}</div>}
                {selectedNotif.retry_count > 0 && <div>재시도 횟수: {selectedNotif.retry_count}회</div>}
                {selectedNotif.fcm_batch_id && <div>배치 ID: {selectedNotif.fcm_batch_id}</div>}
              </div>

              {/* 수신 기기 목록 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    수신 기기
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={isDeletingDevices || isLoadingDevices || failedDevicesCount === 0}
                    onClick={() => handleDeleteFailedDevices()}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    실패 기기 전체 삭제
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={deviceFilter === 'all' ? 'primary' : 'outline'}
                    className="h-7 text-[11px] px-2"
                    onClick={() => setDeviceFilter('all')}
                  >
                    전체 {recipientDevices.length}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={deviceFilter === 'success' ? 'primary' : 'outline'}
                    className="h-7 text-[11px] px-2"
                    onClick={() => setDeviceFilter('success')}
                  >
                    성공 {successDevicesCount}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={deviceFilter === 'failed' ? 'primary' : 'outline'}
                    className="h-7 text-[11px] px-2"
                    onClick={() => setDeviceFilter('failed')}
                  >
                    실패 {failedDevicesCount}
                  </Button>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoadingDevices ? (
                    <div className="p-3 text-xs text-slate-400">기기 목록 조회 중...</div>
                  ) : filteredRecipientDevices.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400">등록된 기기가 없습니다.</div>
                  ) : (
                    filteredRecipientDevices.map((device, idx) => (
                      <div key={`${device.uid}-${idx}`} className="p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {device.user_name}
                          </div>
                          {device.failed ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300">
                                실패
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] text-red-600"
                                disabled={isDeletingDevices}
                                onClick={() => handleDeleteFailedDevices([device.token])}
                              >
                                삭제
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300">
                              정상
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono break-all">
                          {maskToken(device.token)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {device.uid}
                          {device.error_code && (
                            <span className="ml-1 text-red-500">{device.error_code}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 수동 재발송 버튼 */}
              <div className="pt-2 space-y-2">
                <Button
                  className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteNotification}
                  disabled={isDeletingNotification || !!retryingId}
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeletingNotification ? '삭제 중...' : '이 알림 건 삭제'}
                </Button>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">수동 재발송</div>
                <Button
                  className="w-full gap-2"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetry(selectedNotif, 'retry')}
                  disabled={!!retryingId}
                >
                  <RotateCcw className="w-4 h-4" />
                  {retryingId === selectedNotif.id ? '처리 중...' : '대기열에 추가 (다음 배치)'}
                </Button>
                <Button
                  className="w-full gap-2"
                  size="sm"
                  onClick={() => handleRetry(selectedNotif, 'force_send')}
                  disabled={!!retryingId}
                >
                  <Zap className="w-4 h-4" />
                  {retryingId === selectedNotif.id ? '발송 중...' : '즉시 발송'}
                </Button>
                <p className="text-[10px] text-slate-400 text-center">
                  "즉시 발송"은 현재 실패/부분성공 건에 권장됩니다.
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
