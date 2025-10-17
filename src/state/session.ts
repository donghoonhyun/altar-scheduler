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
  currentServerGroupId?: string | null;
  serverGroups: Record<string, { parishCode: string; parishName: string; groupName: string }>;
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

export function useSession(): Session {
  const [session, setSession] = useState<Session>(cachedSession);

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

        // memberships (planner)
        const membershipSnap = await getDocs(
          query(collection(db, 'memberships'), where('uid', '==', user.uid))
        );

        for (const d of membershipSnap.docs) {
          const data = d.data();
          if (data.server_group_id && data.role) {
            roles[data.server_group_id] = data.role;
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

        // members (server, active=true)
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
        newSession.groupRolesLoaded = true;

        if (Object.keys(roles).length > 0) {
          newSession.currentServerGroupId = Object.keys(roles)[0];
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

  return session;
}
