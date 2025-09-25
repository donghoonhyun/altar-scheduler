// src/state/session.ts
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

export interface Session {
  user: User | null;
  loading: boolean;
  groupRoles: Record<string, "planner" | "server">; // serverGroupId → role
  currentServerGroupId?: string | null;             // 최근 접속한 복사단
}

const initialSession: Session = {
  user: null,
  loading: true,
  groupRoles: {},
  currentServerGroupId: null,
};

let cachedSession: Session = { ...initialSession };

// ✅ React hook으로 세션 상태 구독
export function useSession(): Session {
  const [session, setSession] = useState<Session>(cachedSession);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        cachedSession = { ...initialSession, loading: false };
        setSession(cachedSession);
        console.log("세션 초기화: 로그인 안 됨");
        return;
      }

      console.log("로그인 성공:", user.email);

      try {
        // ✅ memberships 체크 (Planner / Server 역할)
        const membershipSnap = await getDocs(
          query(collection(db, "memberships"), where("uid", "==", user.uid))
        );

        const roles: Record<string, "planner" | "server"> = {};
        membershipSnap.forEach((d) => {
          if (d.exists()) {
            const data = d.data() as {
              server_group_id?: string;
              role?: "planner" | "server";
            };
            if (data.server_group_id && data.role) {
              roles[data.server_group_id] = data.role;
            }
          }
        });

        const newSession: Session = {
          user,
          loading: false,
          groupRoles: roles,
          currentServerGroupId: Object.keys(roles)[0] || null,
        };

        cachedSession = newSession;
        setSession(newSession);

        console.log("세션 저장됨:", newSession);
      } catch (err) {
        console.error("세션 로딩 중 오류:", err);
        cachedSession = { ...initialSession, loading: false };
        setSession(cachedSession);
      }
    });

    return () => unsub();
  }, []);

  return session;
}
