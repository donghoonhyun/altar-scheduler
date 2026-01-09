import { useSession } from "../../state/session";
import { auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { Church, Menu, LogOut, User as UserIcon, ShieldCheck, LayoutDashboard, Home, UserPlus, Settings, Mail, X } from "lucide-react";
import ServerGroupSelector from "./ServerGroupSelector";
import AppSettingsDrawer from "../../components/common/AppSettingsDrawer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import MyInfoDrawer from "../../components/common/MyInfoDrawer";
import { useState } from "react";
import { getAppIconPath, getAppTitleWithEnv } from "@/lib/env";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Download, CheckCircle2 } from "lucide-react";
import { useFcmToken } from "@/hooks/useFcmToken"; // ✅ FCM Hook

export default function Layout() {
  const { user, userInfo, groupRoles, isSuperAdmin } = useSession();
  const navigate = useNavigate();
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const [isMyInfoOpen, setIsMyInfoOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt();
  
  // ✅ PWA 진입 시 FCM 토큰 관리 (권한 요청 및 저장)
  useFcmToken();

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  const rolesInGroup = (serverGroupId && groupRoles[serverGroupId]) || [];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-blue-100">
      {/* 🔹공통 상단 바 (Header) */}
      <header className="sticky top-0 z-40 w-full border-b border-purple-200/50 bg-gradient-to-r from-purple-200/90 via-violet-100/90 to-indigo-200/90 backdrop-blur-md shadow-sm">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          {/* 좌측: Church Icon (Purple) */}
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <img 
              src={getAppIconPath()} 
              alt="App Logo" 
              className="w-10 h-10 rounded-lg shadow-sm border border-gray-100"
            />
            <span className="font-bold text-lg text-gray-900 hidden xs:block tracking-tight">
              {getAppTitleWithEnv()}
            </span>
          </div>

          {/* 가운데: 복사단 선택 드롭다운 */}
          <div className="flex-1 flex justify-center max-w-[280px] px-2">
            <ServerGroupSelector />
          </div>

          {/* 우측: 메뉴 버튼 (Hamburger) */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-800">
                <Menu size={32} strokeWidth={2.5} />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>메뉴</SheetTitle>
              </SheetHeader>
              
              <div className="flex flex-col gap-4 pt-4">
                {/* 사용자 정보 */}
                {/* 사용자 정보 & 설정 버튼 */}
                <div className="mb-2 px-1 flex justify-between items-start">
                  <div>
                    <p className="text-xl font-extrabold text-gray-900">
                      {userInfo?.userName}
                      {userInfo?.baptismalName && (
                        <span className="ml-1 text-sm font-bold text-purple-600">
                          {userInfo.baptismalName}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-0"
                    onClick={() => {
                        setIsSettingsOpen(true);
                        // Optional: Keep menu open or close it? usually settings is on top, so maybe keep menu underneath or close menu?
                        // Let's keep menu open for now, drawer will overlay.
                    }}
                  >
                      <Settings size={22} />
                  </Button>
                </div>

                {/* 역할 표시 */}
                {(rolesInGroup.length > 0 || isSuperAdmin) && (
                  <div className="text-xs font-semibold text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-100 italic">
                    * 나의 역할: {[
                      ...(isSuperAdmin ? ['슈퍼어드민'] : []),
                      ...rolesInGroup.map(r => r === 'admin' ? '어드민' : r === 'planner' ? '플래너' : '복사')
                    ].join(', ')}
                  </div>
                )}

                <nav className="flex flex-col gap-2">
                  <Button 
                    variant="ghost" 
                    className="justify-start gap-3 h-10 text-sm font-medium rounded-xl"
                    onClick={() => setIsMyInfoOpen(true)}
                  >
                    <UserIcon size={18} className="text-gray-400" />
                    내정보 수정
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="justify-start gap-3 h-10 text-sm font-medium rounded-xl"
                    onClick={() => {
                        navigate('/add-member');
                        setIsMenuOpen(false);
                    }}
                  >
                    <UserPlus size={18} className="text-gray-400" />
                    권한 신청
                  </Button>
                </nav>

                {/* 역할별 바로가기 및 앱 설치 */}
                {((serverGroupId && rolesInGroup.length > 0) || !isInstalled || isSuperAdmin) && (
                  <div className="mt-2 pt-4 border-t border-gray-100 flex flex-col gap-2">
                    <div className="flex items-center justify-between px-1 mb-1">
                        <span className="text-xs font-semibold text-gray-500">바로가기</span>
                        <div className="relative">
                            <button 
                                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500"
                                onClick={() => setIsContactOpen(!isContactOpen)}
                            >
                                <Mail size={12} />
                                <span>문의</span>
                            </button>
                            
                            {isContactOpen && (
                                <div className="absolute right-0 top-6 z-50 bg-white p-3 rounded-xl shadow-xl border w-64 text-left animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold text-gray-900">문의사항이 있으신가요?</h4>
                                        <button onClick={() => setIsContactOpen(false)} className="text-gray-400 hover:text-gray-600">
                                            <X size={14} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mb-2 leading-snug">
                                        아래 이메일로 편하게 연락주세요.
                                    </p>
                                    <div className="bg-gray-50 p-2 rounded-lg text-[10px] space-y-1 text-gray-600 border border-gray-100">
                                        <div>
                                            <span className="font-bold text-gray-800 mr-1">수신:</span> 
                                            jagalchi@naver.com
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-800 mr-1">제목:</span> 
                                            [Altar 앱문의] 문구포함
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-800 mr-1">내용:</span> 
                                            이용중이신 본당명, 복사단명 포함하여 문의사항을 작성해 주시면 감사하겠습니다.
                                        </div>
                                    </div>
                                    <div className="absolute -top-1 right-2 w-2 h-2 bg-white border-t border-l transform rotate-45" />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {isSuperAdmin && (
                      <Button
                        variant="ghost"
                        className="justify-start gap-3 h-10 text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 rounded-xl"
                        onClick={() => {
                          navigate('/superadmin');
                          setIsMenuOpen(false);
                        }}
                      >
                        <ShieldCheck size={18} />
                        Super Admin
                      </Button>
                    )}

                    {serverGroupId && rolesInGroup.length > 0 && (
                      <>
                        {rolesInGroup.includes('admin') && (
                          <Button
                            variant="ghost" 
                            className="justify-start gap-3 h-10 text-sm font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl"
                            onClick={() => {
                              navigate(`/server-groups/${serverGroupId}/admin`);
                              setIsMenuOpen(false);
                            }}
                          >
                            <ShieldCheck size={18} />
                            어드민 페이지
                          </Button>
                        )}

                        {rolesInGroup.includes('planner') && (
                          <Button
                            variant="ghost"
                            className="justify-start gap-3 h-10 text-sm font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-xl"
                            onClick={() => {
                              navigate(`/server-groups/${serverGroupId}/dashboard`);
                              setIsMenuOpen(false);
                            }}
                          >
                            <LayoutDashboard size={18} />
                            플래너 대시보드
                          </Button>
                        )}

                        {rolesInGroup.includes('server') && (
                          <Button
                            variant="ghost"
                            className="justify-start gap-3 h-10 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl"
                            onClick={() => {
                              navigate(`/server-groups/${serverGroupId}/main`);
                              setIsMenuOpen(false);
                            }}
                          >
                            <Home size={18} />
                            복사 메인
                          </Button>
                        )}
                      </>
                    )}

                    {/* 앱 설치 버튼 */}
                    {!isInstalled && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (isInstallable) {
                            promptInstall();
                          } else {
                            alert('현재 브라우저에서는 설치 기능을 지원하지 않거나, 이미 설치되어 있을 수 있습니다. \n브라우저 메뉴(⋮)에서 [앱 설치]를 확인해주세요.');
                          }
                        }}
                        className="w-full text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 h-auto py-2 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Download size={14} />
                        앱으로 설치하고 간편하게 접속하세요
                      </Button>
                    )}
                  </div>
                )}
                
                {/* 이미 설치됨 표시 (선택사항) */}
                {isInstalled && (
                  <div className="mt-auto px-4 py-3 bg-gray-50 rounded-xl flex items-center justify-center gap-2 text-gray-500 text-xs font-medium">
                    <CheckCircle2 size={16} className="text-green-500" />
                    앱이 설치되어 있습니다
                  </div>
                )}

                {/* 로그아웃 버튼 (최하단 이동) */}
                <div className="mt-auto pt-4 border-t border-gray-100">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-3 h-10 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                    onClick={handleLogout}
                  >
                    <LogOut size={18} className="text-red-400" />
                    로그아웃
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* 🔹본문 영역 */}
      <main className="flex-1 p-2 overflow-y-auto">
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
