import React from 'react';
import { useSession } from '../state/session';
import { Container, Card } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, MessageCircle, ExternalLink, Download, Share } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export default function Support() {
  const { user, groupRoles, isSuperAdmin } = useSession();
  const navigate = useNavigate();
  const { isInstallable, promptInstall } = useInstallPrompt();

  const isLoggedIn = !!user;

  // Collect all roles across all groups to check if user has any specific role
  const allRoles = new Set<string>();
  if (isLoggedIn) {
      Object.values(groupRoles).forEach(roles => {
          roles.forEach(r => allRoles.add(r));
      });
  }
  
  const hasAnyRole = allRoles.has('server') || allRoles.has('planner') || allRoles.has('admin') || isSuperAdmin;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors p-4">
      <Container className="max-w-2xl py-6">
        <div className="flex items-center gap-2 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="dark:text-gray-200">
                <ArrowLeft size={24} />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">고객지원 & 도움말</h1>
        </div>

        <div className="space-y-6">
            {/* 1. 사용자 매뉴얼 섹션 */}
            <Card className="p-6 dark:bg-slate-800 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-300">
                        <BookOpen size={24} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">사용자 매뉴얼</h2>
                </div>
                
                <div className="space-y-4">
                    {/* (1) 권한이 없어도 표시: 회원가입과 로그인 설명서 */}
                    <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-100 dark:border-slate-600">
                         <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">처음 오셨나요?</h3>
                         <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">회원가입 및 로그인 방법에 대해 알아보세요.</p>
                         <a 
                            href="https://thankful-newsprint-eaf.notion.site/Altar-Scheduler-2dc5c7438dc480169460d0eef551bd70?source=copy_link" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                         >
                            회원가입과 로그인 설명서 보기 <ExternalLink size={14} />
                         </a>
                    </div>

                    {/* (2) 로그인 & 권한 보유 시 표시: 복사 사용자 설명서 */}
                    {isLoggedIn && hasAnyRole && (
                        <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-100 dark:border-slate-600">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">복사단 활동 가이드</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">복사를 위한 상세 사용법입니다.</p>
                            <a 
                                href="https://thankful-newsprint-eaf.notion.site/2dc5c7438dc480a2b2d4eed2d5e35687?source=copy_link" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                복사 사용자 설명서 보기 <ExternalLink size={14} />
                            </a>
                        </div>
                    )}

                    {/* (3) 플래너 이상 권한 보유 시 표시: 플래너 활동 가이드 */}
                    {isLoggedIn && (allRoles.has('planner') || allRoles.has('admin') || isSuperAdmin) && (
                        <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-100 dark:border-slate-600">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">플래너 활동 가이드</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">플래너와 관리자를 위한 스케줄링 및 관리 매뉴얼입니다.</p>
                            <a 
                                href="#" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                onClick={(e) => {
                                   if (e.currentTarget.getAttribute('href') === '#') {
                                       e.preventDefault();
                                       alert('준비 중인 페이지입니다.');
                                   }
                                }}
                            >
                                플래너 활동 가이드 보기 <ExternalLink size={14} />
                            </a>
                        </div>
                    )}
                </div>
            </Card>

             {/* 2. 앱 설치 (PWA) 섹션 - 모든 사용자에게 표시 (로그인 안해도 설치 가능) */}
            <Card className="p-6 dark:bg-slate-800 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-300">
                        <Download size={24} />
                    </div>
                    <div className="div">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">앱 설치 (PWA)</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">앱을 홈 화면에 추가하여 더 편리하게 이용하세요.</p>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3 space-y-3 border border-gray-100 dark:border-slate-600">
                    {isInstallable && (
                        <>
                            <Button 
                                variant="outline"
                                className="w-full justify-center gap-2 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                onClick={promptInstall}
                            >
                                <Download size={16} />
                                앱설치
                            </Button>
                            <div className="h-px bg-gray-200 dark:bg-slate-600" />
                        </>
                    )}

                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="bg-white dark:bg-slate-800 p-1.5 rounded text-gray-600 dark:text-gray-300 mt-0.5 border border-gray-100 dark:border-slate-600">
                                <Share size={16} />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block mb-0.5">iOS (iPhone/iPad)</span>
                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-snug">
                                    Safari 브라우저 하단 <strong>공유</strong> 버튼 <Share size={10} className="inline mx-0.5" /> 클릭 후 <br/>
                                    <strong>'홈 화면에 추가'</strong>를 선택하세요.
                                </p>
                            </div>
                        </div>

                        <div className="h-px bg-gray-200 dark:bg-slate-600" />

                        <div className="flex items-start gap-3">
                            <div className="bg-white dark:bg-slate-800 p-1.5 rounded text-gray-600 dark:text-gray-300 mt-0.5 border border-gray-100 dark:border-slate-600">
                                <Download size={16} />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block mb-0.5">Android</span>
                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-snug">
                                    Chrome 브라우저 메뉴에서 <strong>'앱 설치'</strong> 또는 <br/>
                                    <strong>'홈 화면에 추가'</strong>를 선택하세요.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* 3. 문의 하기 영역: 로그인 상태에서만 표시 */}
            {isLoggedIn && (
                <Card className="p-6 dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-pink-100 dark:bg-pink-900/50 rounded-lg text-pink-600 dark:text-pink-300">
                            <MessageCircle size={24} />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">문의하기</h2>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        <p>앱 사용 중 문제가 발생하거나 건의사항이 있으시면 아래 이메일로 연락주세요.</p>
                        <p className="font-bold text-blue-600 dark:text-blue-400 mt-2 select-all">jagalchi@naver.com</p>
                    </div>
                </Card>
            )}
        </div>
      </Container>
    </div>
  );
}
