// src/state/session.ts
import { useEffect, useState } from 'react';
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
import { PARISHES } from '../config/parishes';

export interface Session {
  user: User | null;
  loading: boolean;
  groupRoles: Record<string, 'planner' | 'server'>;
  groupRolesLoaded: boolean;
  currentServerGroupId: string | null;
  serverGroups: Record<string, { parishCode: string; parishName: string; groupName: string }>;
  managerParishes: string[];
  userInfo: { userName: string; baptismalName: string } | null;
  setCurrentServerGroupId?: (id: string | null) => void;
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
};

let cachedSession: Session = { ...initialSession };

export function useSession() {
  const [session, setSession] = useState<Session>(cachedSession);

  // ⭐ setter 함수 구현
  const setCurrentServerGroupId = (id: string | null) => {
    cachedSession = { ...cachedSession, currentServerGroupId: id };
    setSession((prev) => ({ ...prev, currentServerGroupId: id }));
  };

  useEffect(() => {
    // ⚠️ 안전장치: 3초가 지나도 응답이 없으면 로딩 해제 (네트워크 이슈 등 대비)
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
      clearTimeout(timeoutId); // 응답 오면 타임아웃 해제

      if (!user) {
        cachedSession = { ...initialSession, loading: false, groupRolesLoaded: true };
        setSession(cachedSession);
        return;
      }
      // ... (이하 동일)

      // 1) Auth 상태 확인 완료 (일단 렌더링 허용)
      setSession({
        ...initialSession,
        user,
        loading: false, // Auth 확인 끝
        groupRolesLoaded: false, // 데이터는 아직
      });

      // 2) 비동기 데이터 로딩 시작
      const newSession: Session = {
        ...initialSession,
        user,
        loading: false,
        groupRolesLoaded: false,
      };

      try {
        const roles: Record<string, 'planner' | 'server'> = {};
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
          if (!data.server_group_id || !data.role) continue;
          roles[data.server_group_id] = data.role;
          targetSgIds.add(data.server_group_id);
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

          if (!roles[sgId]) roles[sgId] = 'server';
          targetSgIds.add(sgId);
        }

        /** 3) 수집된 ServerGroup 정보 병렬 조회 */
        const sgIdsArray = Array.from(targetSgIds);
        const sgDocs = await Promise.all(
          sgIdsArray.map((id) => getDoc(doc(db, 'server_groups', id)))
        );

        sgDocs.forEach((sgDoc) => {
          if (sgDoc.exists()) {
            const sg = sgDoc.data();
            const parishCode = sg.parish_code || '';
            const parishName =
              PARISHES.find((p) => p.code === parishCode)?.name_kor || parishCode;

            serverGroups[sgDoc.id] = {
              parishCode,
              parishName,
              groupName: sg.name ?? sgDoc.id,
            };
          }
        });

        newSession.groupRoles = roles;
        newSession.serverGroups = serverGroups;
        newSession.groupRolesLoaded = true;

        // ✅ managerParishes 계산: planner 권한이 있는 serverGroup의 parishCode 수집 (중복 제거)
        const plannerParishes = new Set<string>();
        for (const [sgId, role] of Object.entries(roles)) {
          if (role === 'planner') {
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

        cachedSession = newSession;
        setSession(newSession);
      } catch (err) {
        console.error('세션 로딩 중 오류:', err);
        cachedSession = {
          ...initialSession,
          loading: false,
          groupRolesLoaded: true,
        };
        setSession(cachedSession);
      }
    });

    return () => unsub();
  }, []);

  return {
    ...session,
    setCurrentServerGroupId, // ⭐ setter 추가 반환
  };
}
