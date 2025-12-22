import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Parish } from '../types/parish';

export function useParishes() {
  return useQuery({
    queryKey: ['parishes'],
    queryFn: async (): Promise<Parish[]> => {
      const parishRef = collection(db, 'parishes');
      // active true 필터링은 선택사항이나, 운영상 필요할 수 있음. 일단은 전체 로드.
      // const q = query(parishRef, where('active', '==', true));
      // 정렬도 필요하면 추가.
      
      const snapshot = await getDocs(parishRef);
      const parishes = snapshot.docs.map((doc) => doc.data() as Parish);
      
      return parishes;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24시간 (변동이 거의 없는 데이터)
    gcTime: 1000 * 60 * 60 * 24, // 24시간
  });
}
