// src/state/session.ts
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeAuthState } from "../lib/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";

// import type { SystemRole, ParishRole, Membership } from "../types/auth";

const db = getFirestore();

export interface SessionState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  managerParishes: string[];
  groupRoles: Record<string, "planner" | "server">;
  currentServerGroupId?: string;
}

/** useSession 훅 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    user: null,
    loading: true,
    isAdmin: false,
    managerParishes: [],
    groupRoles: {},
  });

  useEffect(() => {
    const unsubscribe = subscribeAuthState(async (user) => {
      if (!user) {
        setState({
          user: null,
          loading: false,
          isAdmin: false,
          managerParishes: [],
          groupRoles: {},
        });
        return;
      }

      // Firestore 권한 로드
      const systemRoleSnap = await getDoc(doc(db, "system_roles", user.uid));
      const isAdmin = systemRoleSnap.exists();

      // TODO: parish_roles, memberships 는 query 필요
      // 지금은 간단히 빈 값으로 둠
      const managerParishes: string[] = [];
      const groupRoles: Record<string, "planner" | "server"> = {};

      setState({
        user,
        loading: false,
        isAdmin,
        managerParishes,
        groupRoles,
        currentServerGroupId: undefined,
      });
    });

    return () => unsubscribe();
  }, []);

  return state;
}
