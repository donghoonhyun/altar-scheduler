// src/state/session.ts
import { useEffect, useState, useCallback } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';


export interface Session {
  user: User | null;
  loading: boolean;
  groupRoles: Record<string, string[]>;
  groupRolesLoaded: boolean;
  currentServerGroupId: string | null;
  serverGroups: Record<string, { parishCode: string; parishName: string; groupName: string }>;
  managerParishes: string[];
  userInfo: { userName: string; baptismalName: string } | null;
  isSuperAdmin: boolean;
  setCurrentServerGroupId?: (id: string | null) => void;
  refreshSession?: () => Promise<void>;
}

const initialSession: Session = {
  user: null,
  loading: true,
  groupRoles: {},
  groupRolesLoaded: false,
  currentServerGroupId: null,
  serverGroups: {},
  managerParishes: [],
  userInfo: null,
  isSuperAdmin: false,
};

let cachedSession: Session = { ...initialSession };

export function useSession() {
  const [session, setSession] = useState<Session>(cachedSession);

  // ⭐ 세션 데이터 로드 함수 (추출)
  const fetchSessionData = useCallback(async (user: User) => {
    const newSession: Session = {
      ...initialSession,
      user,
      loading: false,
      groupRolesLoaded: false,
    };

    try {
      const roles: Record<string, string[]> = {};
      const serverGroups: Session['serverGroups'] = {};
      const userUid = user.uid;

      /** 0) users/{uid} 사용자 프로필 로드 */
      let userInfoData = null;
      try {
        const userDoc = await getDoc(doc(db, 'users', userUid));
        if (userDoc.exists()) {
          const ud = userDoc.data();
          userInfoData = {
            userName: ud.user_name || ud.displayName || '', // DB field: user_name
            baptismalName: ud.baptismal_name || '',
          };
        }
      } catch (e) {
        console.error('사용자 프로필 로드 실패', e);
      }
      newSession.userInfo = userInfoData;

      /** 1) memberships로 planner/server 역할 로드 */
      const membershipSnap = await getDocs(
        query(collection(db, 'memberships'), where('uid', '==', userUid))
      );

      // server_group_id 수집용 Set
      const targetSgIds = new Set<string>();

      for (const d of membershipSnap.docs) {
        const data = d.data();
        const sgId = data.server_group_id;
        if (!sgId || !data.role) continue;

        const rolesInDoc = Array.isArray(data.role) ? data.role : [data.role];
        
        // Super Admin 체크 ('global' 그룹은 일반 그룹 로직에서 제외)
        if (sgId === 'global' || data.role.includes('superadmin')) {
          if (rolesInDoc.includes('superadmin')) {
            newSession.isSuperAdmin = true;
          }
          continue; // serverGroups 목록에는 포함하지 않음
        }
        
        if (!roles[sgId]) roles[sgId] = [];
        rolesInDoc.forEach(r => {
          if (r && !roles[sgId].includes(r)) {
            roles[sgId].push(r);
          }
        });
        targetSgIds.add(sgId);
      }

      /** 2) server_groups/{sg}/members 에서 active=true 복사 취득 */
      const memberSnap = await getDocs(
        query(
          collectionGroup(db, 'members'),
          where('parent_uid', '==', userUid),
          where('active', '==', true)
        )
      );

      for (const d of memberSnap.docs) {
        const path = d.ref.path.split('/');
        const sgId = path[1];
        if (!sgId) continue;

        if (!roles[sgId]) roles[sgId] = [];
        if (!roles[sgId].includes('server')) {
          roles[sgId].push('server');
        }
        targetSgIds.add(sgId);
      }

      /** 3) 수집된 ServerGroup 정보 병렬 조회 (Parish 정보 포함) */
      const sgIdsArray = Array.from(targetSgIds);
      
      const sgResults = await Promise.all(
        sgIdsArray.map(async (id) => {
          try {
            const sgDoc = await getDoc(doc(db, 'server_groups', id));
            if (!sgDoc.exists()) return null;
            
            const sg = sgDoc.data();
            const parishCode = sg.parish_code || '';
            let parishName = parishCode;

            if (parishCode) {
              const parishDoc = await getDoc(doc(db, 'parishes', parishCode));
              if (parishDoc.exists()) {
                const parishData = parishDoc.data();
                parishName = parishData.name_kor || parishCode;
              }
            }

            return {
              id: sgDoc.id,
              data: {
                parishCode,
                parishName,
                groupName: sg.name ?? sgDoc.id,
              }
            };
          } catch (e) {
            console.error(`Error fetching SG info for ${id}`, e);
            return null;
          }
        })
      );

      sgResults.forEach((res) => {
        if (res) {
          serverGroups[res.id] = res.data;
        }
      });

      newSession.groupRoles = roles;
      newSession.serverGroups = serverGroups;
      newSession.groupRolesLoaded = true;

      // ✅ managerParishes 계산: planner 권한이 있는 serverGroup의 parishCode 수집 (중복 제거)
      const plannerParishes = new Set<string>();
      for (const [sgId, rolesInGroup] of Object.entries(roles)) {
        if (rolesInGroup.includes('planner')) {
          const info = serverGroups[sgId];
          if (info && info.parishCode) {
            plannerParishes.add(info.parishCode);
          }
        }
      }
      newSession.managerParishes = Array.from(plannerParishes);

      /** 3) 기본 currentServerGroupId 설정 */
      const sgKeys = Object.keys(serverGroups);
      if (sgKeys.length > 0) {
        newSession.currentServerGroupId = sgKeys[0];
      } else {
        newSession.currentServerGroupId = null;
      }

      newSession.loading = false;
      return newSession;
    } catch (err) {
      console.error('세션 데이터 패치 오류:', err);
      return {
        ...initialSession,
        user,
        loading: false,
        groupRolesLoaded: true,
      };
    }
  }, []);

  // ⭐ 수동 세션 갱신 함수
  const refreshSession = useCallback(async () => {
    if (!auth.currentUser) return;
    const updatedSession = await fetchSessionData(auth.currentUser);
    cachedSession = updatedSession;
    setSession(updatedSession);
  }, [fetchSessionData]);

  // ⭐ setter 함수 구현
  const setCurrentServerGroupId = (id: string | null) => {
    cachedSession = { ...cachedSession, currentServerGroupId: id };
    setSession((prev) => ({ ...prev, currentServerGroupId: id }));
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSession((prev) => {
        if (prev.loading) {
          console.warn('⚠️ Session auth check timed out. Forcing loading: false');
          return { ...prev, loading: false };
        }
        return prev;
      });
    }, 10000);

    const unsub = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeoutId);

      if (!user) {
        cachedSession = { ...initialSession, loading: false, groupRolesLoaded: true };
        setSession(cachedSession);
        return;
      }

      // 로그인 상태 확인 직후 즉시 데이터 로딩
      const updatedSession = await fetchSessionData(user);
      cachedSession = updatedSession;
      setSession(updatedSession);
    });

    return () => unsub();
  }, [fetchSessionData]);

  return {
    ...session,
    setCurrentServerGroupId,
    refreshSession, 
  };
}
