import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/collections';

export interface Diocese {
  code: string;
  name_kor: string;
  order: number;
}

export function useDioceses() {
  return useQuery({
    queryKey: ['dioceses', 'v2'],
    queryFn: async (): Promise<Diocese[]> => {
      try {
        const diocesesRef = collection(db, COLLECTIONS.DIOCESES);
        
        const snapshot = await getDocs(diocesesRef);
        const dioceses = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                code: data.code || doc.id,
                name_kor: data.name_kor,
                order: data.order || 0,
            } as Diocese;
        });
        
        return dioceses.sort((a, b) => a.order - b.order);
      } catch (e) {
        console.error("useDioceses fetch error:", e);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 24, // 24시간
    gcTime: 1000 * 60 * 60 * 24,
  });
}
