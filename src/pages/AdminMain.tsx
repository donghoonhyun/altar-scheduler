import React from 'react';
import { MIGRATION_MEMBERS } from '@/data/migrationData';
import { SG00002_MEMBERS } from '@/data/sg00002Members';
import { DECEMBER_2025_SCHEDULE_SG00002 } from '@/data/schedule2025DecSG00002';
import { db } from '@/lib/firebase';
import { doc, writeBatch, serverTimestamp, collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { Upload } from 'lucide-react';

import { useNavigate, useParams } from 'react-router-dom';
import { Container, Card, Heading, UserRoleIcon } from '@/components/ui';
import { useSession } from '@/state/session';
import { Users, Settings, UserPlus, LayoutDashboard, Info } from 'lucide-react';
import { COLLECTIONS } from '@/lib/collections';

const AdminMain: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const session = useSession();

  const adminActions = [
    {
      title: '플래너 대시보드',
      description: '플래너 대시보드(스케줄, 복사단원 관리)로 이동합니다.',
      icon: LayoutDashboard,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      path: `/server-groups/${serverGroupId}/dashboard`,
    },
    {
      title: '플래너 권한 승인',
      description: '새로운 플래너 권한 요청을 확인하고 승인합니다.',
      icon: UserPlus,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
      path: `/server-groups/${serverGroupId}/admin/role-approval`,
    },
    {
      title: '멤버십 역할 관리',
      description: '멤버별 역할(권한)을 관리합니다.',
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      path: `/server-groups/${serverGroupId}/admin/members`,
    },
  ];

  const sgInfo = serverGroupId ? session.serverGroups[serverGroupId] : null;
  
  // Pending request count check (Real-time)
  const [pendingCount, setPendingCount] = React.useState(0);
  React.useEffect(() => {
    if (!serverGroupId) return;

    const q = query(
      collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'role_requests'), 
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      setPendingCount(snapshot.size); // snapshot.size gives the document count in the QuerySnapshot
    }, (error: any) => {
        console.error("Error watching pending requests:", error);
    });

    return () => unsubscribe();
  }, [serverGroupId]);

  const [isMigrating, setIsMigrating] = React.useState(false);

  const handleMigration = async () => {
    if (!serverGroupId) return;
    if (!confirm(`총 ${MIGRATION_MEMBERS.length}명의 단원 데이터를 업로드하시겠습니까? \n(기존 ID MB00001~MB00062 데이터가 있으면 덮어씁니다)`)) return;

    setIsMigrating(true);
    try {
      const batch = writeBatch(db);
      
      MIGRATION_MEMBERS.forEach((m, index) => {
        const id = `MB${String(index + 1).padStart(5, '0')}`;
        const ref = doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'members', id);
        batch.set(ref, {
          id: id,
          ...m,
          active: true,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        }, { merge: true });
      });

      await batch.commit();
      alert('✅ 업로드가 성공적으로 완료되었습니다! 이제 members 컬렉션을 확인해보세요.');
    } catch (e) {
      console.error(e);
      alert('❌ 업로드 실패: ' + e);
    } finally {
      setIsMigrating(false);
    }
  };

  const [isScheduleMigrating, setIsScheduleMigrating] = React.useState(false);

  const handleScheduleMigration = async () => {
    if (!serverGroupId) return;
    if (!confirm('2025년 12월 스케줄 데이터를 업로드하시겠습니까? \n(기존 동일 날짜/미사 데이터가 있으면 덮어씁니다)')) return;

    setIsScheduleMigrating(true);
    try {
      const { DECEMBER_2025_SCHEDULE } = await import('@/data/schedule2025Dec');

      // 1. Fetch Members to build matching map
      const membersRef = collection(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'members');
      const memberSnap = await getDocs(membersRef);
      const memberMap = new Map<string, string>();
      
      memberSnap.docs.forEach(d => {
        const data = d.data();
        if (data.name_kor && data.baptismal_name) {
             const key = `${data.name_kor}${data.baptismal_name}`.replace(/\s/g, '');
             memberMap.set(key, d.id);
        }
      });
      console.log(`[Migration] Loaded ${memberMap.size} members for matching.`);

      const batch = writeBatch(db);
      let matchCount = 0;

      DECEMBER_2025_SCHEDULE.forEach((item) => {
        const docId = `ME_${item.date}_${item.title}`;
        const ref = doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'mass_events', docId);
        
        const matchedServerIds = item.servers.map(name => {
           const cleanName = name.replace(/\s/g, ''); 
           const uid = memberMap.get(cleanName);
           if (!uid) {
             console.warn(`[Migration] Unmatched server in image: ${name}`);
           }
           return uid;
        }).filter(Boolean) as string[];

        matchCount += matchedServerIds.length;

        batch.set(ref, {
          id: docId,
          title: item.title,
          event_date: item.date, // "20251201"
          required_servers: item.servers.length > 0 ? item.servers.length : 2, 
          status: 'MASS-CONFIRMED', 
          member_ids: matchedServerIds,
          main_member_id: matchedServerIds.length > 0 ? matchedServerIds[0] : null,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        }, { merge: true });
      });

      await batch.commit();
      alert(`✅ 2025년 12월 스케줄 업로드 완료! (총 ${DECEMBER_2025_SCHEDULE.length}개 미사, ${matchCount}명 배정)`);

    } catch (e) {
      console.error(e);
      alert('❌ 스케줄 업로드 실패: ' + e);
    } finally {
      setIsScheduleMigrating(false);
    }
  };

  const [isSG00002Migrating, setIsSG00002Migrating] = React.useState(false);

  const handleSG00002Migration = async () => {
    if (!confirm(`총 ${SG00002_MEMBERS.length}명의 중등부(SG00002) 단원 데이터를 추가하시겠습니까?`)) return;

    setIsSG00002Migrating(true);
    try {
      const targetGroupId = 'SG00002'; // Explicitly targeting SG00002
      const batch = writeBatch(db); 
      
      SG00002_MEMBERS.forEach((m) => {
        const newDocRef = doc(collection(db, COLLECTIONS.SERVER_GROUPS, targetGroupId, 'members'));
        batch.set(newDocRef, {
          ...m,
          active: true,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      });

      await batch.commit();
      alert(`✅ SG00002(중등부) 멤버 ${SG00002_MEMBERS.length}명 추가 완료!`);
    } catch (e) {
      console.error(e);
      alert('❌ 추가 실패: ' + e);
    } finally {
      setIsSG00002Migrating(false);
    }
  };

  const [isSG00002ScheduleMigrating, setIsSG00002ScheduleMigrating] = React.useState(false);

  const handleSG00002ScheduleMigration = async () => {
    if (!confirm('SG00002(중등부) 2025년 12월 스케줄 데이터를 업로드하시겠습니까?')) return;

    setIsSG00002ScheduleMigrating(true);
    try {
      const targetGroupId = 'SG00002';
      
      const membersRef = collection(db, COLLECTIONS.SERVER_GROUPS, targetGroupId, 'members');
      const memberSnap = await getDocs(membersRef);
      const memberMap = new Map<string, string>();
      
      memberSnap.docs.forEach(d => {
        const data = d.data();
        if (data.name_kor && data.baptismal_name) {
             const key = `${data.name_kor}${data.baptismal_name}`.replace(/\s/g, '');
             memberMap.set(key, d.id);
        }
      });
      console.log(`[SG00002 Migration] Loaded ${memberMap.size} members for matching.`);

      const batch = writeBatch(db);
      let matchCount = 0;

      DECEMBER_2025_SCHEDULE_SG00002.forEach((item) => {
        const docId = `ME_${item.date}_${item.title}`;
        const ref = doc(db, COLLECTIONS.SERVER_GROUPS, targetGroupId, 'mass_events', docId);
        
        const matchedServerIds = item.servers.map(name => {
           const cleanName = name.replace(/\s/g, ''); 
           const uid = memberMap.get(cleanName);
           if (!uid) {
             console.warn(`[SG00002 Migration] Unmatched server: ${name}`);
           }
           return uid;
        }).filter(Boolean) as string[];

        matchCount += matchedServerIds.length;

        batch.set(ref, {
          id: docId,
          title: item.title,
          event_date: item.date,
          required_servers: item.servers.length > 0 ? item.servers.length : 2, 
          status: 'MASS-CONFIRMED', 
          member_ids: matchedServerIds,
          main_member_id: matchedServerIds.length > 0 ? matchedServerIds[0] : null,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        }, { merge: true });
      });

      await batch.commit();
      alert(`✅ SG00002 스케줄 업로드 완료! (총 ${DECEMBER_2025_SCHEDULE_SG00002.length}개 미사, ${matchCount}명 배정)`);

    } catch (e) {
      console.error(e);
      alert('❌ 업로드 실패: ' + e);
    } finally {
      setIsSG00002ScheduleMigrating(false);
    }
  };





  const [isSG00001JanScheduleMigrating, setIsSG00001JanScheduleMigrating] = React.useState(false);

  const handleSG00001JanScheduleMigration = async () => {
    if (!confirm('SG00001(초등부) 2026년 1월 스케줄 데이터를 업로드하시겠습니까?')) return;

    setIsSG00001JanScheduleMigrating(true);
    try {
      const { JANUARY_2026_SCHEDULE } = await import('@/data/schedule2026Jan');
      const targetGroupId = 'SG00001';
      
      const membersRef = collection(db, COLLECTIONS.SERVER_GROUPS, targetGroupId, 'members');
      const memberSnap = await getDocs(membersRef);
      const memberMap = new Map<string, string>();
      
      memberSnap.docs.forEach(d => {
        const data = d.data();
        if (data.name_kor && data.baptismal_name) {
             const key = `${data.name_kor}${data.baptismal_name}`.replace(/\s/g, '');
             memberMap.set(key, d.id);
        }
      });
      console.log(`[SG00001 Migration] Loaded ${memberMap.size} members for matching.`);

      const batch = writeBatch(db);
      let matchCount = 0;

      JANUARY_2026_SCHEDULE.forEach((item) => {
        const docId = `ME_${item.date}_${item.title}`;
        const ref = doc(db, COLLECTIONS.SERVER_GROUPS, targetGroupId, 'mass_events', docId);
        
        const matchedServerIds = item.servers.map(name => {
           const cleanName = name.replace(/\s/g, ''); 
           const uid = memberMap.get(cleanName);
           if (!uid) {
             console.warn(`[SG00001 Migration] Unmatched server: ${name}`);
           }
           return uid;
        }).filter(Boolean) as string[];

        matchCount += matchedServerIds.length;

        batch.set(ref, {
          id: docId,
          title: item.title,
          event_date: item.date,
          required_servers: item.servers.length > 0 ? item.servers.length : 2, 
          status: 'MASS-CONFIRMED', 
          member_ids: matchedServerIds,
          main_member_id: matchedServerIds.length > 0 ? matchedServerIds[0] : null,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        }, { merge: true });
      });

      await batch.commit();
      alert(`✅ SG00001 2026년 1월 스케줄 업로드 완료! (총 ${JANUARY_2026_SCHEDULE.length}개 미사, ${matchCount}명 배정)`);

    } catch (e) {
      console.error(e);
      alert('❌ 업로드 실패: ' + e);
    } finally {
      setIsSG00001JanScheduleMigrating(false);
    }
  };

  const [isSG00002JanScheduleMigrating, setIsSG00002JanScheduleMigrating] = React.useState(false);

  const handleSG00002JanScheduleMigration = async () => {
    if (!confirm('SG00002(중등부) 2026년 1월 스케줄 데이터를 업로드하시겠습니까?')) return;

    setIsSG00002JanScheduleMigrating(true);
    try {
      const { JANUARY_2026_SCHEDULE_SG00002 } = await import('@/data/schedule2026JanSG00002');
      const targetGroupId = 'SG00002';
      
      const membersRef = collection(db, COLLECTIONS.SERVER_GROUPS, targetGroupId, 'members');
      const memberSnap = await getDocs(membersRef);
      const memberMap = new Map<string, string>();
      
      memberSnap.docs.forEach(d => {
        const data = d.data();
        if (data.name_kor && data.baptismal_name) {
             const key = `${data.name_kor}${data.baptismal_name}`.replace(/\s/g, '');
             memberMap.set(key, d.id);
        }
      });
      console.log(`[SG00002 Jan Migration] Loaded ${memberMap.size} members for matching.`);

      const batch = writeBatch(db);
      let matchCount = 0;

      JANUARY_2026_SCHEDULE_SG00002.forEach((item) => {
        const docId = `ME_${item.date}_${item.title}`;
        const ref = doc(db, COLLECTIONS.SERVER_GROUPS, targetGroupId, 'mass_events', docId);
        
        const matchedServerIds = item.servers.map(name => {
           const cleanName = name.replace(/\s/g, ''); 
           const uid = memberMap.get(cleanName);
           if (!uid) {
             console.warn(`[SG00002 Jan Migration] Unmatched server: ${name}`);
           }
           return uid;
        }).filter(Boolean) as string[];

        matchCount += matchedServerIds.length;

        batch.set(ref, {
          id: docId,
          title: item.title,
          event_date: item.date,
          required_servers: item.servers.length > 0 ? item.servers.length : 2, 
          status: 'MASS-CONFIRMED', 
          member_ids: matchedServerIds,
          main_member_id: matchedServerIds.length > 0 ? matchedServerIds[0] : null,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        }, { merge: true });
      });

      await batch.commit();
      alert(`✅ SG00002 2026년 1월 스케줄 업로드 완료! (총 ${JANUARY_2026_SCHEDULE_SG00002.length}개 미사, ${matchCount}명 배정)`);

    } catch (e) {
      console.error(e);
      alert('❌ 업로드 실패: ' + e);
    } finally {
      setIsSG00002JanScheduleMigrating(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-200 to-purple-50 dark:from-slate-950 dark:to-slate-900 transition-colors duration-300">
      <Container className="py-6">
        <div className="mb-6 mt-1 flex flex-col items-center">
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 text-center relative inline-block">
            복사단 Admin Panel
            <span className="absolute -bottom-2 left-0 w-full h-1.5 bg-purple-500/30 dark:bg-purple-400/30 rounded-full"></span>
          </Heading>
        </div>

        <div className="mb-6 text-center">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            <span className="text-purple-600 dark:text-purple-400 font-extrabold inline-flex items-center justify-center gap-1">
              <UserRoleIcon category={session.userInfo?.userCategory} size={18} />
              {session.userInfo?.userName} {session.userInfo?.baptismalName && `${session.userInfo.baptismalName} `}
            </span>
            {serverGroupId && (() => {
              const roles = session.groupRoles[serverGroupId] || [];
              if (roles.includes('admin')) return '어드민';
              if (roles.includes('planner')) return '플래너';
              if (roles.includes('server')) return '복사';
              return '역할없음';
            })()}님 반갑습니다.
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {adminActions.map((action, index) => (
            <Card 
              key={index} 
              className="hover:shadow-md transition-all duration-200 cursor-pointer group border-none shadow-sm dark:bg-gray-800"
              onClick={() => action.path !== '#' && navigate(action.path)}
            >
              <div className="p-1 sm:p-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`${action.bg} ${action.color} w-9 h-9 rounded flex items-center justify-center group-hover:scale-110 transition-transform duration-200 flex-shrink-0`}>
                    <action.icon size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 break-keep">{action.title}</h3>
                  {action.title === '플래너 권한 승인' && pendingCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold shadow-sm">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight break-keep">{action.description}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Heading size="md" className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Info size={20} className="text-gray-400" />
            복사단 정보 상세
          </Heading>
          <Card className="border-none shadow-sm overflow-hidden relative dark:bg-gray-800">
            <button 
              onClick={() => navigate(`/server-groups/${serverGroupId}/admin/settings`)}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm z-10"
            >
              <Settings size={12} />
              수정
            </button>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {[
                { label: '복사단 ID', value: serverGroupId },
                { label: '복사단 명칭', value: sgInfo?.groupName },
                { label: '성당 코드', value: sgInfo?.parishCode },
                { label: '성당 명칭', value: sgInfo?.parishName },
                { label: '표시 기준', value: 'Asia/Seoul (KST)' },
              ].map((item, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between p-2 px-4 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 ${idx === 0 ? 'pr-20' : ''}`}
                >
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{item.value || '-'}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {session.user?.email === 'pongso.hyun@gmail.com' && (
          <div className="mt-8 mb-8">
            <Card className="border-none shadow-sm p-4 bg-white dark:bg-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">마이그레이션 (임시)</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">데이터 초기화를 위한 일괄 업로드 기능입니다.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleMigration}
                    disabled={isMigrating}
                    className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {isMigrating ? '업로드 중...' : (
                      <>
                        <Upload size={14} />
                        SG00001 멤버추가
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleScheduleMigration}
                    disabled={isScheduleMigrating}
                    className="flex items-center gap-2 px-3 py-2 bg-pink-600 text-white text-xs font-bold rounded-md hover:bg-pink-700 transition-colors disabled:opacity-50"
                  >
                    {isScheduleMigrating ? '처리 중...' : (
                      <>
                        <Upload size={14} />
                        SG00001 12월배정
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSG00002Migration}
                    disabled={isSG00002Migrating}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {isSG00002Migrating ? '추가 중...' : (
                      <>
                        <UserPlus size={14} />
                        SG00002 멤버추가
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSG00002ScheduleMigration}
                    disabled={isSG00002ScheduleMigrating}
                    className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white text-xs font-bold rounded-md hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {isSG00002ScheduleMigrating ? '배정 중...' : (
                      <>
                        <Upload size={14} />
                        SG00002 12월 배정
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSG00001JanScheduleMigration}
                    disabled={isSG00001JanScheduleMigrating}
                    className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white text-xs font-bold rounded-md hover:bg-cyan-700 transition-colors disabled:opacity-50"
                  >
                    {isSG00001JanScheduleMigrating ? '배정 중...' : (
                      <>
                        <Upload size={14} />
                        SG00001 1월배정
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSG00002JanScheduleMigration}
                    disabled={isSG00002JanScheduleMigrating}
                    className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white text-xs font-bold rounded-md hover:bg-rose-700 transition-colors disabled:opacity-50"
                  >
                    {isSG00002JanScheduleMigrating ? '배정 중...' : (
                      <>
                        <Upload size={14} />
                        SG00002 1월배정
                      </>
                    )}
                  </button>

                </div>
              </div>
            </Card>
          </div>
        )}


        <div className="mt-12 text-center text-gray-400 text-[10px]">
          이 페이지는 해당 복사단 멤버십에서 어드민(Admin) 역할이 있는 분들께만 보입니다.
        </div>


      </Container>
    </div>
  );

};

export default AdminMain;
