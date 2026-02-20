import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/collections';
import { Parish } from '../types/parish';

export function useParishes(onlyActive?: boolean) {
  return useQuery({
    queryKey: ['parishes', { onlyActive }],
    queryFn: async (): Promise<Parish[]> => {
      const parishRef = collection(db, COLLECTIONS.PARISHES);
      let q;
      
      if (onlyActive) {
        q = query(parishRef, where('active', '==', true));
      } else {
        q = query(parishRef);
      }
      
      const snapshot = await getDocs(q);
      const parishes = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          code: data.code || doc.id,
        } as Parish;
      });
      
      return parishes;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24시간 (변동이 거의 없는 데이터)
    gcTime: 1000 * 60 * 60 * 24, // 24시간
  });
}
