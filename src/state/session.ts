import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

export interface Session {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  managerParishes: string[]; // manager 권한이 있는 parishCode 리스트
  groupRoles: Record<string, "planner" | "server">; // serverGroupId → role
  currentServerGroupId?: string | null; // 최근 접속한 복사단
}

const initialSession: Session = {
  user: null,
  loading: true,
  isAdmin: false,
  managerParishes: [],
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

      // 기본 세션 정보
      const newSession: Session = {
        ...initialSession,
        user,
        loading: true,
      };

      try {
        // ✅ system_roles 체크 (Admin 여부)
        const sysRoleDoc = await getDoc(doc(db, "system_roles", user.uid));
        if (sysRoleDoc.exists()) {
          const data = sysRoleDoc.data();
          if (data.role === "admin") {
            newSession.isAdmin = true;
          }
        }

        // ✅ parish_roles 체크 (Manager 여부)
        const parishQuery = query(
          collection(db, "parish_roles"),
          where("uid", "==", user.uid), // 🔑 uid 매칭
          where("role", "==", "manager")
        );
        const parishSnap = await getDocs(parishQuery);
        const parishes: string[] = [];
        parishSnap.forEach((d) => {
          if (d.exists()) {
            const data = d.data();
            if (data.parish_code) {
              parishes.push(data.parish_code);
            }
          }
        });
        newSession.managerParishes = parishes;

        // ✅ memberships 체크 (Planner/Server 역할)
        const membershipSnap = await getDocs(
          query(collection(db, "memberships"), where("uid", "==", user.uid))
        );
        const roles: Record<string, "planner" | "server"> = {};
        membershipSnap.forEach((d) => {
          if (d.exists()) {
            const data = d.data();
            if (data.server_group_id && data.role) {
              roles[data.server_group_id] = data.role;
            }
          }
        });

        // ✅ Manager → 자동 Planner 권한 부여
        if (parishes.length > 0) {
          const sgSnap = await getDocs(collection(db, "server_groups"));
          sgSnap.forEach((d) => {
            const data = d.data();
            if (data.parish_code && parishes.includes(data.parish_code)) {
              // 아직 역할이 안 들어간 그룹이면 자동 planner 부여
              if (!roles[d.id]) {
                roles[d.id] = "planner";
              }
            }
          });
        }

        newSession.groupRoles = roles;

        // ✅ 기본 currentServerGroupId 설정
        if (Object.keys(roles).length > 0) {
          newSession.currentServerGroupId = Object.keys(roles)[0];
        }

        newSession.loading = false;
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
