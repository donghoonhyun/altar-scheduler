import { useSession } from "../../state/session";
import { auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { Church, Menu, LogOut, User as UserIcon, ShieldCheck } from "lucide-react";
import ServerGroupSelector from "./ServerGroupSelector";
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

export default function Layout() {
  const { user, userInfo, groupRoles } = useSession();
  const navigate = useNavigate();
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const [isMyInfoOpen, setIsMyInfoOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  const rolesInGroup = (serverGroupId && groupRoles[serverGroupId]) || [];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-blue-100">
      {/* 🔹공통 상단 바 (Header) */}
      <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          {/* 좌측: Church Icon (Purple) */}
          <div 
            className="flex items-center gap-2 cursor-pointer text-[#a855f7]"
            onClick={() => navigate("/")}
          >
            <Church size={32} strokeWidth={2.5} />
          </div>

          {/* 가운데: 복사단 선택 드롭다운 */}
          <div className="flex-1 flex justify-center max-w-[280px] px-2">
            <ServerGroupSelector />
          </div>

          {/* 우측: 메뉴 버튼 (Hamburger) */}
          <Sheet>
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
                <div className="mb-2 px-1">
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

                {/* 역할 표시 */}
                {rolesInGroup.length > 0 && (
                  <div className="text-xs font-semibold text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-100 italic">
                    * 역할: {rolesInGroup.map(r => r === 'admin' ? '어드민' : r === 'planner' ? '플래너' : '복사').join(', ')}
                  </div>
                )}

                <nav className="flex flex-col gap-2">
                  {rolesInGroup.includes('admin') && (
                    <Button
                      variant="ghost"
                      className="justify-start gap-3 h-10 text-sm font-medium rounded-xl text-purple-600 hover:bg-purple-50"
                      onClick={() => navigate(`/server-groups/${serverGroupId}/admin`)}
                    >
                      <ShieldCheck size={18} className="text-purple-400" />
                      어드민 설정
                    </Button>
                  )}
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
                    className="justify-start gap-3 h-10 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                    onClick={handleLogout}
                  >
                    <LogOut size={18} className="text-red-400" />
                    로그아웃
                  </Button>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* 🔹본문 영역 */}
      <main className="flex-1 p-4 overflow-y-auto">
        <Outlet />
      </main>

      {/* 🔹내 정보 수정 Drawer */}
      <MyInfoDrawer 
        open={isMyInfoOpen} 
        onOpenChange={setIsMyInfoOpen}
        serverGroupId={serverGroupId}
      />
    </div>
  );
}
