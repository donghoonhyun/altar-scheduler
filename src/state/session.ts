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
  currentServerGroupId?: string | null;
  serverGroups: Record<string, { parishCode: string; parishName: string; groupName: string }>;
}

const initialSession: Session = {
  user: null,
  loading: true,
  groupRoles: {},
  currentServerGroupId: null,
  serverGroups: {},
};

let cachedSession: Session = { ...initialSession };

export function useSession(): Session {
  const [session, setSession] = useState<Session>(cachedSession);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        cachedSession = { ...initialSession, loading: false };
        setSession(cachedSession);
        console.log('세션 초기화: 로그인 안 됨');
        return;
      }

      console.log('로그인 성공:', user.email);

      const newSession: Session = {
        ...initialSession,
        user,
        loading: true,
      };

      try {
        const roles: Record<string, 'planner' | 'server'> = {};
        const serverGroups: Session['serverGroups'] = {};

        // ✅ (1) memberships 로드 → planner/manager 용
        const membershipSnap = await getDocs(
          query(collection(db, 'memberships'), where('uid', '==', user.uid))
        );

        for (const d of membershipSnap.docs) {
          const data = d.data();
          if (data.server_group_id && data.role) {
            roles[data.server_group_id] = data.role;

            // ✅ server_group 문서 가져오기
            const sgDoc = await getDoc(doc(db, 'server_groups', data.server_group_id));
            if (sgDoc.exists()) {
              const sgData = sgDoc.data();
              const parishCode = sgData.parish_code || '';
              const parishName =
                PARISHES.find((p) => p.code === parishCode)?.name_kor || parishCode;

              serverGroups[data.server_group_id] = {
                parishCode,
                parishName,
                groupName: sgData.name || data.server_group_id,
              };
            }
          }
        }

        // ✅ (2) members 로드 → server 계정 (승인된 active=true)
        const serverSnap = await getDocs(
          query(
            collectionGroup(db, 'members'),
            where('uid', '==', user.uid),
            where('active', '==', true)
          )
        );

        for (const d of serverSnap.docs) {
          const sgId = d.ref.parent.parent?.id;
          if (!sgId) continue;

          roles[sgId] = 'server';

          const sgDoc = await getDoc(doc(db, 'server_groups', sgId));
          if (sgDoc.exists()) {
            const sgData = sgDoc.data();
            const parishCode = sgData.parish_code || '';
            const parishName = PARISHES.find((p) => p.code === parishCode)?.name_kor || parishCode;

            serverGroups[sgId] = {
              parishCode,
              parishName,
              groupName: sgData.name || sgId,
            };
          }
        }

        newSession.groupRoles = roles;
        newSession.serverGroups = serverGroups;

        if (Object.keys(roles).length > 0) {
          newSession.currentServerGroupId = Object.keys(roles)[0];
        }

        newSession.loading = false;
        cachedSession = newSession;
        setSession(newSession);

        console.log('세션 저장됨:', newSession);
      } catch (err) {
        console.error('세션 로딩 중 오류:', err);
        cachedSession = { ...initialSession, loading: false };
        setSession(cachedSession);
      }
    });

    return () => unsub();
  }, []);

  return session;
}
