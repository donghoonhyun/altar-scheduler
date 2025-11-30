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
  setCurrentServerGroupId?: (id: string | null) => void; // ⭐ 추가됨
}

const initialSession: Session = {
  user: null,
  loading: true,
  groupRoles: {},
  groupRolesLoaded: false,
  currentServerGroupId: null,
  serverGroups: {},
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        cachedSession = { ...initialSession, loading: false, groupRolesLoaded: true };
        setSession(cachedSession);
        return;
      }

      const newSession: Session = {
        ...initialSession,
        user,
        loading: true,
        groupRolesLoaded: false,
      };

      try {
        const roles: Record<string, 'planner' | 'server'> = {};
        const serverGroups: Session['serverGroups'] = {};
        const userUid = user.uid;

        /** 1) memberships로 planner/server 역할 로드 */
        const membershipSnap = await getDocs(
          query(collection(db, 'memberships'), where('uid', '==', userUid))
        );

        for (const d of membershipSnap.docs) {
          const data = d.data();
          if (!data.server_group_id || !data.role) continue;

          const sgId = data.server_group_id;
          roles[sgId] = data.role;

          const sgDoc = await getDoc(doc(db, 'server_groups', sgId));
          if (sgDoc.exists()) {
            const sg = sgDoc.data();
            const parishCode = sg.parish_code || '';
            const parishName = PARISHES.find((p) => p.code === parishCode)?.name_kor || parishCode;

            serverGroups[sgId] = {
              parishCode,
              parishName,
              groupName: sg.name ?? sgId,
            };
          }
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

          const sgDoc = await getDoc(doc(db, 'server_groups', sgId));
          if (sgDoc.exists()) {
            const sg = sgDoc.data();
            const parishCode = sg.parish_code || '';
            const parishName = PARISHES.find((p) => p.code === parishCode)?.name_kor || parishCode;

            serverGroups[sgId] = {
              parishCode,
              parishName,
              groupName: sg.name ?? sgId,
            };
          }
        }

        newSession.groupRoles = roles;
        newSession.serverGroups = serverGroups;
        newSession.groupRolesLoaded = true;

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
