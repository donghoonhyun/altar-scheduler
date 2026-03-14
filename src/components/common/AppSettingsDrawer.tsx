import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useFcmToken } from '@/hooks/useFcmToken';
import { useSession } from '@/state/session';
import { functions } from '@/lib/firebase';
import { callNotificationApi } from '@/lib/notificationApi';
import { Bell, CheckCircle2, XCircle, AlertCircle, Monitor } from 'lucide-react';

interface AppSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AppSettingsDrawer({ open, onOpenChange }: AppSettingsDrawerProps) {
  const { permission, toggleNotification } = useFcmToken();
  const { user } = useSession();
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
  const isInIframe = window.self !== window.top;

  useEffect(() => {
    const pref = localStorage.getItem('altar_notification_enabled');
    // Enabled if permission granted AND not explicitly disabled
    setIsNotificationsEnabled(permission === 'granted' && pref !== 'false');
  }, [permission, open]); 

  const handleToggle = async (checked: boolean) => {
    if (checked) {
        if (isInIframe && permission !== 'granted') {
             toast.error('Ordo 앱 내부에서는 알림 권한 요청이 차단됩니다. 아래 "알림 설정 열기"로 단독 페이지에서 허용해 주세요.');
             setIsNotificationsEnabled(false);
             return;
        }

        if (permission === 'denied') {
             toast.error('알림 권한이 차단되어 있습니다. 브라우저 설정(주소창 자물쇠)에서 권한을 허용해주세요.');
             // Force UI refresh to off
             setIsNotificationsEnabled(false);
             return;
        }
        
        await toggleNotification(true);
        
        // Check if permission was actually granted (in case user dismissed prompt)
        if (Notification.permission === 'granted') {
            setIsNotificationsEnabled(true);
            toast.success('알림 수신이 활성화되었습니다.');
        } else {
            setIsNotificationsEnabled(false);
            if (Notification.permission === 'denied') {
                toast.error('알림 권한이 거부되었습니다.');
            }
        }
    } else {
        // Soft Opt-out: Remove token from server, set local pref to false
        await toggleNotification(false);
        setIsNotificationsEnabled(false);
        toast.success('알림 수신이 비활성화되었습니다.', { description: '더 이상 푸시 알림을 받지 않습니다.' });
    }
  };

  const handleTestNotification = async () => {
    if (permission !== 'granted') {
      toast.error('브라우저 알림 권한이 필요합니다.');
      return;
    }
    
    if (!isNotificationsEnabled) {
        toast.error('알림 수신 설정이 활성화되어야 테스트할 수 있습니다.');
        return;
    }

    // Use Service Worker for mobile compatibility
    try {
      // Check if Service Worker is available
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        // Use Service Worker's showNotification (works on mobile)
        await registration.showNotification('🔔 알림 테스트', {
          body: '알림이 정상적으로 수신됩니다! (로컬 테스트)',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          tag: 'test-notification',
          requireInteraction: false,
        });
        
        toast.success('테스트 알림을 발송했습니다.');
      } else {
        // Fallback for non-PWA environments (desktop browsers)
        new Notification('🔔 알림 테스트', {
          body: '알림이 정상적으로 수신됩니다! (로컬 테스트)',
          icon: '/icons/icon-192x192.png',
        });
        toast.success('테스트 알림을 발송했습니다.');
      }
    } catch (e) {
      console.error('Test notification error:', e);
      toast.error('알림 발송에 실패했습니다.', {
        description: e instanceof Error ? e.message : '알 수 없는 오류'
      });
    }
  };

  const handleTestFcmNotification = async () => {
    if (!user?.uid) {
      toast.error('로그인 정보가 없습니다.');
      return;
    }

    try {
      const res = await callNotificationApi<any>(functions, {
        action: 'enqueue_test',
        targetUid: user.uid,
      });

      if (res?.success) {
        toast.success('테스트 FCM 알림이 대기열에 등록되었습니다.');
      } else {
        toast.error(`실패: ${res?.message || '알 수 없는 오류'}`);
      }
    } catch (e: any) {
      toast.error(`FCM 테스트 등록 실패: ${e?.message || '알 수 없는 오류'}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[310px] sm:w-[360px] sm:max-w-[360px]">
        <SheetHeader>
          <SheetTitle>앱 설정</SheetTitle>
        </SheetHeader>
        
        <div className="py-4 space-y-4">
          {/* Notification Settings */}
          <section className="space-y-3">
            <div className="px-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Bell size={16} className="text-purple-500" />
                    알림 설정
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                    주요 일정 및 공지사항 알림을 설정합니다.
                </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3 space-y-3 shadow-sm">
                {/* Status & Toggle */}
                <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">알림 수신</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {isNotificationsEnabled 
                        ? '알림을 받고 있습니다.' 
                        : permission === 'denied' 
                        ? '알림 권한이 차단되었습니다.' 
                        : permission === 'granted'
                        ? '알림 수신이 중지되었습니다.'
                        : '알림 권한이 필요합니다.'}
                    </span>
                </div>
                <Switch 
                    checked={isNotificationsEnabled}
                    onCheckedChange={handleToggle}
                    disabled={false}
                />
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100 dark:bg-gray-700" />

                {/* Notification Settings Area */}
                <div className="space-y-4">
                {isNotificationsEnabled && permission !== 'granted' && !isInIframe && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs border border-red-100 dark:border-red-900/50 space-y-2">
                        <div className="flex items-center gap-2 font-bold">
                            <AlertCircle size={16} />
                            알림 권한이 차단되어 있습니다
                        </div>
                        <p className="leading-relaxed opacity-90">
                            브라우저 주소창 왼쪽의 <b>'자물쇠'</b> 또는 <b>'설정'</b> 아이콘을 눌러 <b>[알림: 허용]</b>으로 변경해 주세요.
                        </p>
                    </div>
                )}

                {/* Manual Status Indicator */}
                <div className="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-lg flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        {permission === 'granted' ? (
                            <CheckCircle2 className="text-green-500 shrink-0" size={20} />
                        ) : (permission === 'denied' || isInIframe) ? (
                            <XCircle className="text-red-500 shrink-0" size={20} />
                        ) : (
                            <AlertCircle className="text-amber-500 shrink-0" size={20} />
                        )}
                        <div className="text-xs text-gray-700 dark:text-gray-300">
                            브라우저 권한: 
                            <span className="font-bold ml-1">
                                {permission === 'granted' ? '허용됨' : (permission === 'denied' || isInIframe) ? '제한됨(거부)' : '미설정'}
                            </span>
                        </div>
                    </div>
                    
                    {isInIframe && permission !== 'granted' && (
                        <div className="mt-1 border-t border-gray-200 dark:border-gray-700 pt-2">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mb-2">
                                * Ordo 앱(iframe) 내부에서는 보안을 위해 알림 권한 요청이 차단됩니다. 단독 페이지에서 알림 권한을 허용해 주세요.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-[10px] h-7 bg-white dark:bg-slate-800 font-bold border-indigo-200 text-indigo-600"
                                onClick={() => {
                                  const standaloneUrl = `${window.location.origin}/?openSettings=notifications`;
                                  window.open(standaloneUrl, '_blank', 'noopener,noreferrer');
                                }}
                            >
                                <Monitor size={12} className="mr-1" />
                                알림 설정 열기
                            </Button>
                            <p className="text-[9px] text-gray-400 mt-1 text-center">
                                (보안 정책에 따라 한 번 더 로그인이 필요할 수 있습니다.)
                            </p>
                        </div>
                    )}
                </div>
                </div>

                {/* Test Button */}
                <div>
                    <Button 
                        variant="ghost" 
                        size="sm"
                        className="w-full justify-start gap-2 h-9 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200 border dark:border-gray-600" 
                        onClick={handleTestNotification}
                    >
                        <Bell size={14} />
                        <span className="text-xs">테스트 알림 발송 (로컬)</span>
                    </Button>
                </div>
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 h-9 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200 border dark:border-gray-600"
                        onClick={handleTestFcmNotification}
                    >
                        <Bell size={14} />
                        <span className="text-xs">테스트 알림 발송 (FCM)</span>
                    </Button>
                </div>
            </div>
          </section>


        </div>
      </SheetContent>
    </Sheet>
  );
}
