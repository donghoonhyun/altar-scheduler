import { useSession } from "../../state/session";
import { auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { Church, LogOut, User as UserIcon, ShieldCheck, LayoutDashboard, Home, UserPlus, Settings, HelpCircle, Moon, Sun } from "lucide-react";
import ServerGroupSelector from "./ServerGroupSelector";
import AppSettingsDrawer from "../../components/common/AppSettingsDrawer";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import DrawerHeader from "@/components/common/DrawerHeader";
import { useTheme } from "@/components/common/ThemeProvider";
import { Button } from "@/components/ui/button";
import MyInfoDrawer from "../../components/common/MyInfoDrawer";
import { useState, useEffect } from "react";
import { getAppIconPath, getAppTitleWithEnv } from "@/lib/env";
import { useFcmToken } from "@/hooks/useFcmToken"; // ✅ FCM Hook

export default function Layout() {
  const { user, userInfo, groupRoles, isSuperAdmin } = useSession();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");
  const navigate = useNavigate();
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const [isMyInfoOpen, setIsMyInfoOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // ✅ PWA 진입 시 FCM 토큰 관리 (권한 요청 및 저장)
  useFcmToken();

  // ✅ 방문한 그룹 ID 기억하기 (SuperAdmin 등에서 복귀 시 사용)
  useEffect(() => {
    if (serverGroupId) {
        localStorage.setItem('lastVisitedGroupId', serverGroupId);
    }
  }, [serverGroupId]);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  const rolesInGroup = (serverGroupId && groupRoles[serverGroupId]) || [];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-blue-100 dark:from-slate-900 dark:to-slate-800 transition-colors">
      {/* 🔹공통 상단 바 (Header) */}
      <header className="sticky top-0 z-40 w-full border-b border-purple-200/50 dark:border-purple-900 bg-gradient-to-r from-purple-200/90 via-violet-100/90 to-indigo-200/90 dark:from-purple-950 dark:via-indigo-950 dark:to-violet-950 backdrop-blur-md shadow-sm">
        <div className="flex h-16 items-center justify-between pl-3 pr-1 sm:px-6 relative">
          {/* 좌측: Church Icon (Purple) */}
          <div 
            className="flex items-center gap-3 cursor-pointer shrink-0 z-10"
            onClick={() => {
              if (serverGroupId) {
                navigate(`/server-groups/${serverGroupId}`);
              } else {
                // 그룹 밖(예: SuperAdmin)에 있다면 마지막 방문 그룹으로 복귀 시도
                const lastId = localStorage.getItem('lastVisitedGroupId');
                if (lastId) {
                    navigate(`/server-groups/${lastId}`);
                } else {
                    navigate("/");
                }
              }
            }}
          >
            <img 
              src={getAppIconPath()} 
              alt="App Logo" 
              className="w-10 h-10 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700"
            />
            <span className="font-bold text-lg text-gray-900 dark:text-gray-100 hidden xs:block tracking-tight">
              {getAppTitleWithEnv()}
            </span>
          </div>

          {/* 가운데: 복사단 선택 드롭다운 (모바일: 절대위치 중앙정렬, xs이상: Flex 중앙정렬) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] flex justify-center xs:static xs:transform-none xs:w-auto xs:max-w-none xs:flex-1 xs:justify-center min-w-0 px-1 z-0">
            <ServerGroupSelector />
          </div>

          {/* 우측: Support Icon & 메뉴 버튼 (Hamburger) */}
          <div className="flex items-center gap-0 sm:gap-2 z-10">
            <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 text-indigo-700 dark:text-indigo-300 transition-transform duration-300 hover:rotate-12 hover:scale-110 active:scale-90 dark:hover:bg-purple-800/50"
                onClick={() => navigate('/support')}
            >
                <HelpCircle size={20} strokeWidth={2} />
            </Button>

            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger asChild>
                <button className="w-9 h-9 rounded-full overflow-hidden shadow-sm border-2 border-purple-300 dark:border-purple-700 transition-transform active:scale-90 hover:scale-105 hover:border-purple-400 dark:hover:border-purple-500">
                  {userInfo?.photoUrl ? (
                    <img src={userInfo.photoUrl} alt="profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-sm">
                      {userInfo?.baptismalName
                        ? userInfo.baptismalName.charAt(0)
                        : userInfo?.userName
                        ? userInfo.userName.charAt(0)
                        : user?.email?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  )}
                </button>
                </SheetTrigger>
            <SheetContent className="w-[310px] sm:w-[360px] sm:max-w-[360px] p-0 flex flex-col overflow-hidden" hideClose>
              <DrawerHeader onClose={() => setIsMenuOpen(false)}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <SheetTitle className="text-xl font-bold text-white tracking-tight font-gamja flex items-center gap-1.5">
                      {userInfo?.userName ?? ''}
                      {userInfo?.baptismalName && (
                        <span className="text-sm font-semibold text-purple-300">{userInfo.baptismalName}</span>
                      )}
                    </SheetTitle>
                    <p className="text-[11px] text-slate-100/80 font-medium tracking-tight font-gamja">
                      {user?.email}
                    </p>
                  </div>
                  {/* 다크/라이트 모드 토글 */}
                  <button
                    onClick={toggleTheme}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors border border-white/20 ${
                      isDark ? "bg-slate-900/60" : "bg-amber-300/70"
                    }`}
                    aria-label="Toggle Dark Mode"
                  >
                    <span className={`${
                      isDark ? "translate-x-4 bg-slate-700" : "translate-x-0.5 bg-white"
                    } pointer-events-none h-4 w-4 rounded-full shadow transition-transform duration-200 flex items-center justify-center`}>
                      {isDark ? (
                        <Moon className="h-2.5 w-2.5 text-cyan-400 fill-current" />
                      ) : (
                        <Sun className="h-2.5 w-2.5 text-orange-500 fill-current" />
                      )}
                    </span>
                  </button>
                </div>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {/* 역할 표시 */}
                {(rolesInGroup.length > 0 || isSuperAdmin) && (
                  <div className="text-xs font-semibold text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800 italic">
                    * 나의 역할: {[
                      ...(isSuperAdmin ? ['슈퍼어드민'] : []),
                      ...rolesInGroup.map(r => r === 'admin' ? '어드민' : r === 'planner' ? '플래너' : '복사')
                    ].join(', ')}
                  </div>
                )}

                <nav className="flex flex-col gap-1.5">
                  <Button
                    variant="ghost"
                    className="justify-start gap-3 h-9 text-sm font-medium rounded-xl"
                    onClick={() => setIsMyInfoOpen(true)}
                  >
                    <UserIcon size={18} className="text-gray-400" />
                    내정보 수정
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start gap-3 h-9 text-sm font-medium rounded-xl"
                    onClick={() => setIsSettingsOpen(true)}
                  >
                    <Settings size={18} className="text-gray-400" />
                    앱 설정
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start gap-3 h-9 text-sm font-medium rounded-xl"
                    onClick={() => {
                        navigate('/add-member');
                        setIsMenuOpen(false);
                    }}
                  >
                    <UserPlus size={18} className="text-gray-400" />
                    신규 복사 신청
                  </Button>
                </nav>

                {/* 역할별 바로가기 */}
                {((serverGroupId && rolesInGroup.length > 0) || isSuperAdmin) && (
                  <div className="mt-2 pt-3 border-t border-gray-100 dark:border-gray-600 flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-300 px-1">바로가기</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          className="flex flex-col items-center justify-center h-auto py-2.5 px-0 text-[10px] font-medium bg-gray-800 text-white hover:bg-gray-700 dark:bg-gray-900 rounded-xl gap-1"
                          onClick={() => {
                            navigate('/superadmin');
                            setIsMenuOpen(false);
                          }}
                        >
                          <ShieldCheck size={18} />
                          <span className="leading-tight">Super<br/>Admin</span>
                        </Button>
                      )}

                      {serverGroupId && rolesInGroup.length > 0 && (
                        <>
                          {rolesInGroup.includes('admin') && (
                            <Button
                              variant="ghost"
                              className="flex flex-col items-center justify-center h-auto py-2.5 px-0 text-[10px] font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 rounded-xl gap-1"
                              onClick={() => {
                                navigate(`/server-groups/${serverGroupId}/admin`);
                                setIsMenuOpen(false);
                              }}
                            >
                              <ShieldCheck size={18} />
                              <span className="leading-tight">어드민</span>
                            </Button>
                          )}

                          {rolesInGroup.includes('planner') && (
                            <Button
                              variant="ghost"
                              className="flex flex-col items-center justify-center h-auto py-2.5 px-0 text-[10px] font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50 rounded-xl gap-1"
                              onClick={() => {
                                navigate(`/server-groups/${serverGroupId}/dashboard`);
                                setIsMenuOpen(false);
                              }}
                            >
                              <LayoutDashboard size={18} />
                              <span className="leading-tight">플래너</span>
                            </Button>
                          )}

                          {rolesInGroup.includes('server') && (
                            <Button
                              variant="ghost"
                              className="flex flex-col items-center justify-center h-auto py-2.5 px-0 text-[10px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 rounded-xl gap-1"
                              onClick={() => {
                                navigate(`/server-groups/${serverGroupId}/main`);
                                setIsMenuOpen(false);
                              }}
                            >
                              <Home size={18} />
                              <span className="leading-tight">복사홈</span>
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 로그아웃 버튼 (개발자 전용) */}
                {user?.email === "pongso.hyun@gmail.com" && (
                  <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-600">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-3 h-9 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                      onClick={handleLogout}
                    >
                      <LogOut size={18} className="text-red-400" />
                      로그아웃
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </div>
      </header>

      {/* 🔹본문 영역 */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* 🔹내 정보 수정 Drawer */}
      <MyInfoDrawer 
        open={isMyInfoOpen} 
        onOpenChange={setIsMyInfoOpen}
        serverGroupId={serverGroupId}
      />

      {/* 🔹앱 설정 Drawer */}
      <AppSettingsDrawer
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </div>
  );
}
