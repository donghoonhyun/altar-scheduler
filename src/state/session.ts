// src/state/session.ts
import { useEffect, useState, useCallback } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  doc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import dayjs, { Dayjs } from 'dayjs';
import { COLLECTIONS } from '@/lib/collections';

export interface Session {
  user: User | null;
  loading: boolean;
  groupRoles: Record<string, string[]>;
  groupRolesLoaded: boolean;
  currentServerGroupId: string | null;
  serverGroups: Record<string, { parishCode: string; parishName: string; groupName: string }>;
  managerParishes: string[];
  hasPending: boolean;
  pendingRoles: Record<string, string[]>; // 승인 대기 중인 역할들
  userInfo: { userName: string; baptismalName: string; userCategory?: string; parishId?: string; photoUrl?: string } | null;
  isSuperAdmin: boolean;
  currentViewDate: Dayjs | null; 
  setCurrentServerGroupId?: (id: string | null) => void;
  setCurrentViewDate?: (date: Dayjs) => void; 
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
  hasPending: false,
  pendingRoles: {},
  userInfo: null,
  isSuperAdmin: false,
  currentViewDate: null, 
};

// --- Storage Key ---
const STORAGE_VIEW_DATE_KEY = 'altar_session_view_date';

// 초기 로드 시 스토리지 확인 (모듈 레벨 단 1회 실행)
let savedViewDate: Dayjs | null = null;
try {
  const stored = sessionStorage.getItem(STORAGE_VIEW_DATE_KEY);
  if (stored) {
    savedViewDate = dayjs(stored);
  }
} catch (e) {
  console.error('SessionStorage read error', e);
}

// 초기 캐시 상태
let cachedSession: Session = { 
  ...initialSession,
  pendingRoles: {},
  currentViewDate: savedViewDate // 여기서 넣어줘야 초기 마운트 시에도 적용됨
};

export function useSession() {
  const [session, setSession] = useState<Session>(cachedSession);
  const mergeUniqueDocs = (
    first: QueryDocumentSnapshot<DocumentData>[],
    second: QueryDocumentSnapshot<DocumentData>[]
  ) => {
    const merged = [...first];
    const seen = new Set(first.map((d) => d.ref.path));
    second.forEach((d) => {
      if (!seen.has(d.ref.path)) merged.push(d);
    });
    return merged;
  };

  // 세션 데이터 로드 함수
  const fetchSessionData = useCallback(async (user: User) => {
    // 세션 빌드 시점의 최신 상태 유지 (캐시 혹은 스토리지)
    const currentViewDate = cachedSession.currentViewDate || savedViewDate;

    // 기본 뼈대
    const newSession: Session = {
      ...initialSession,
      user,
      loading: false,
      groupRolesLoaded: false,
      currentViewDate, // 덮어씌워지지 않도록 명시
    };

    try {
      const roles: Record<string, string[]> = {};
      const pendingRoles: Record<string, string[]> = {};
      const serverGroups: Session['serverGroups'] = {};
      const userUid = user.uid;

      /** 0) users/{uid} 사용자 프로필 로드 */
      let userInfoData = null;
      try {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userUid));
        if (userDoc.exists()) {
          const ud = userDoc.data();
          userInfoData = {
            userName: ud.user_name || ud.display_name || ud.displayName || '',
            baptismalName: ud.baptismal_name || ud.catholic_info?.baptismal_name || '',
            userCategory: ud.user_category || 'Layman',
            parishId: ud.catholic_info?.parish_id || '',
            photoUrl: ud.photo_url || ud.photoURL || user.photoURL || '',
          };
        }
      } catch (e) {
        console.error('사용자 프로필 로드 실패', e);
      }
      newSession.userInfo = userInfoData;

      /** 1) memberships로 planner/server 역할 로드 */
      const membershipSnap = await getDocs(
        query(collection(db, COLLECTIONS.MEMBERSHIPS), where('uid', '==', userUid))
      );

      const targetSgIds = new Set<string>();

      for (const d of membershipSnap.docs) {
        const data = d.data();
        const sgId = data.server_group_id;
        if (!sgId || !data.role) continue;

        const rolesInDoc = Array.isArray(data.role) ? data.role : [data.role];

        if (data.active !== true) {
          newSession.hasPending = true;
          if (!pendingRoles[sgId]) pendingRoles[sgId] = [];
          rolesInDoc.forEach(r => {
            if (r && !pendingRoles[sgId].includes(r)) pendingRoles[sgId].push(r);
          });
          // 승인 대기 중이라도 성당 정보는 필요하므로 targetSgIds에 추가
          targetSgIds.add(sgId);
          continue;
        }
        
        if (sgId === 'global' || data.role.includes('superadmin')) {
          if (rolesInDoc.includes('superadmin')) {
            newSession.isSuperAdmin = true;
          }
          continue; 
        }
        
        if (!roles[sgId]) roles[sgId] = [];
        rolesInDoc.forEach(r => {
          if (r && !roles[sgId].includes(r)) {
            roles[sgId].push(r);
          }
        });
        targetSgIds.add(sgId);
      }

      /** 2) server_groups/{sg}/members 에서 복사 취득 (가입 내역 확인용) */
      // memberships에서 확보한 그룹 범위 내에서 members를 조회한다.
      const memberByParentDocs: QueryDocumentSnapshot<DocumentData>[] = [];
      const memberByUidDocs: QueryDocumentSnapshot<DocumentData>[] = [];
      const sgIdsForUidLookup = Array.from(targetSgIds);
      for (const sgId of sgIdsForUidLookup) {
        try {
          const membersSnap = await getDocs(
            collection(db, COLLECTIONS.SERVER_GROUPS, sgId, 'members')
          );
          membersSnap.docs.forEach((mDoc) => {
            const m = mDoc.data() as any;
            if (m?.parent_uid === userUid) memberByParentDocs.push(mDoc);
            if (m?.uid === userUid) memberByUidDocs.push(mDoc);
          });
        } catch (memberQueryErr) {
          console.warn(`[session] member lookup failed for ${sgId}:`, memberQueryErr);
        }
      }

      const memberDocs = mergeUniqueDocs(memberByParentDocs, memberByUidDocs);

      for (const d of memberDocs) {
        const data = d.data();
        const path = d.ref.path.split('/');
        const sgId = path[3]; 
        if (!sgId) continue;

        if (data.active !== true) {
          newSession.hasPending = true;
          if (!pendingRoles[sgId]) pendingRoles[sgId] = [];
          if (!pendingRoles[sgId].includes('server')) pendingRoles[sgId].push('server');
          targetSgIds.add(sgId);
          continue;
        }

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
            const sgDoc = await getDoc(doc(db, COLLECTIONS.SERVER_GROUPS, id));
            if (!sgDoc.exists()) return null;
            
            const sg = sgDoc.data();
            const parishCode = sg.parish_code || '';
            let parishName = parishCode;

            if (parishCode) {
              const parishDoc = await getDoc(doc(db, COLLECTIONS.PARISHES, parishCode));
              if (parishDoc.exists()) {
                const parishData = parishDoc.data();
                // 성당이 비활성 상태면 해당 복사단은 제외
                if (parishData.active === false) return null;
                parishName = parishData.name_kor || parishCode;
              } else {
                // 성당 정보가 없으면 필터링
                return null;
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
      newSession.pendingRoles = pendingRoles;
      newSession.serverGroups = serverGroups;
      newSession.groupRolesLoaded = true;

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
      // 에러 시에도 날짜는 유지
      return {
        ...initialSession,
        user,
        loading: false,
        groupRolesLoaded: true,
        currentViewDate
      };
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (!auth.currentUser) return;
    const updatedSession = await fetchSessionData(auth.currentUser);
    
    // 🔥 업데이트 시점에 캐시 or 스토리지에서 날짜 복구 (fetch 내에서 이미 처리했지만 안전장치)
    const restoreDate = cachedSession.currentViewDate || savedViewDate;
    updatedSession.currentViewDate = restoreDate;

    cachedSession = updatedSession;
    setSession(updatedSession);
  }, [fetchSessionData]);

  const setCurrentServerGroupId = (id: string | null) => {
    cachedSession = { ...cachedSession, currentServerGroupId: id };
    setSession((prev) => ({ ...prev, currentServerGroupId: id }));
  };

  const setCurrentViewDate = (date: Dayjs) => {
    // ✅ 1. 스토리지 저장
    try {
      sessionStorage.setItem(STORAGE_VIEW_DATE_KEY, date.toISOString());
      savedViewDate = date; // 모듈 변수도 업데이트
    } catch (e) {
      console.error('SessionStorage set error', e);
    }
    
    // ✅ 2. 메모리(캐시) 저장
    cachedSession = { ...cachedSession, currentViewDate: date };
    
    // ✅ 3. 상태 업데이트
    setSession((prev) => ({ ...prev, currentViewDate: date }));
  };

  // Auth Observer
  useEffect(() => {
    let roleUnsubs: Array<() => void> = [];
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRoleUnsubs = () => {
      roleUnsubs.forEach((u) => {
        try { u(); } catch { /* noop */ }
      });
      roleUnsubs = [];
    };

    const clearRefreshTimer = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
    };

    const scheduleSessionRefresh = (user: User) => {
      clearRefreshTimer();
      refreshTimer = setTimeout(async () => {
        const updatedSession = await fetchSessionData(user);
        const restoreDate = cachedSession.currentViewDate || savedViewDate;
        updatedSession.currentViewDate = restoreDate;
        cachedSession = updatedSession;
        setSession(updatedSession);
      }, 200);
    };


    const unsub = onAuthStateChanged(auth, async (user) => {
      clearRoleUnsubs();
      clearRefreshTimer();

      if (!user) {
        // 로그아웃 시 스토리지도 클리어? -> 선택사항 (일단 유지)
        cachedSession = { ...initialSession, loading: false, groupRolesLoaded: true };
        setSession(cachedSession);
        return;
      }

      const updatedSession = await fetchSessionData(user);
      
      // 날짜 복구
      const restoreDate = cachedSession.currentViewDate || savedViewDate;
      updatedSession.currentViewDate = restoreDate;
      
      cachedSession = updatedSession;
      setSession(updatedSession);

      // memberships / members 변경을 실시간 감시하여 승인/권한 상태를 즉시 반영
      const membershipQuery = query(
        collection(db, COLLECTIONS.MEMBERSHIPS),
        where('uid', '==', user.uid)
      );
      const unsubMembership = onSnapshot(membershipQuery, () => {
        scheduleSessionRefresh(user);
      });
      roleUnsubs.push(unsubMembership);
    });

    return () => {
      clearRoleUnsubs();
      clearRefreshTimer();
      unsub();
    };
  }, [fetchSessionData]);

  return {
    ...session,
    setCurrentServerGroupId,
    setCurrentViewDate, 
    refreshSession, 
  };
}
