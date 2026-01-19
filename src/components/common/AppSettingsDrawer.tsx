import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useFcmToken } from '@/hooks/useFcmToken';
import { Bell, CheckCircle2, XCircle, AlertCircle, Monitor, Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '@/components/common/ThemeProvider';
import { cn } from '@/lib/utils';

interface AppSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AppSettingsDrawer({ open, onOpenChange }: AppSettingsDrawerProps) {
  const { theme, setTheme } = useTheme();
  const { permission, toggleNotification } = useFcmToken();
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);

  useEffect(() => {
    const pref = localStorage.getItem('altar_notification_enabled');
    // Enabled if permission granted AND not explicitly disabled
    setIsNotificationsEnabled(permission === 'granted' && pref !== 'false');
  }, [permission, open]); // Re-check on open

  const handleToggle = async (checked: boolean) => {
    if (checked) {
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

  const handleTestNotification = () => {
    if (permission !== 'granted') {
      toast.error('브라우저 알림 권한이 필요합니다.');
      return;
    }
    
    if (!isNotificationsEnabled) {
        toast.error('알림 수신 설정이 활성화되어야 테스트할 수 있습니다.');
        return;
    }

    // Local Test Notification
    try {
      new Notification('🔔 알림 테스트', {
        body: '알림이 정상적으로 수신됩니다! (로컬 테스트)',
        icon: '/icons/icon-192x192.png', // Adjust path if needed
      });
      toast.success('테스트 알림을 발송했습니다.');
    } catch (e) {
      console.error(e);
      toast.error('알림 발송에 실패했습니다.');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[310px] sm:w-[360px] sm:max-w-[360px]">
        <SheetHeader>
          <SheetTitle>앱 설정</SheetTitle>
        </SheetHeader>
        
        <div className="py-4 space-y-4">
          {/* Display Settings */}
          <section className="space-y-3">
            <div className="px-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Monitor size={16} className="text-emerald-500" />
                    화면 설정
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    앱의 화면 모드를 설정합니다.
                </p>
            </div>

            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-1.5 shadow-sm grid grid-cols-3 gap-1">
                <button
                    onClick={() => setTheme('light')}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
                        theme === 'light' 
                            ? "bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-600" 
                            : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-400"
                    )}
                >
                    <Sun size={20} />
                    라이트
                </button>
                <button
                    onClick={() => setTheme('dark')}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
                        theme === 'dark' 
                             ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-600" 
                            : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-400"
                    )}
                >
                    <Moon size={20} />
                    다크
                </button>
                <button
                    onClick={() => setTheme('system')}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
                        theme === 'system' 
                             ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-600" 
                            : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-400"
                    )}
                >
                    <Laptop size={20} />
                    시스템
                </button>
            </div>
          </section>

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

                {/* Manual Status Indicator */}
                <div className="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-lg flex items-center gap-2">
                    {permission === 'granted' ? (
                        <CheckCircle2 className="text-green-500 shrink-0" size={20} />
                    ) : permission === 'denied' ? (
                        <XCircle className="text-red-500 shrink-0" size={20} />
                    ) : (
                        <AlertCircle className="text-amber-500 shrink-0" size={20} />
                    )}
                    <div className="text-xs text-gray-700 dark:text-gray-300">
                        브라우저 권한: 
                        <span className="font-bold ml-1">
                            {permission === 'granted' ? '허용됨' : permission === 'denied' ? '거부됨' : '미설정'}
                        </span>
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
            </div>
          </section>


        </div>
      </SheetContent>
    </Sheet>
  );
}
