export interface ScheduleImportData {
  date: string; // YYYYMMDD
  title: string; // e.g., '주일새벽', '월저녁'
  servers: string[]; // "Name BaptismalName"
}

export const DECEMBER_2025_SCHEDULE: ScheduleImportData[] = [
  // Week 1
  // 12/1 (Mon)
  { date: '20251201', title: '월새벽', servers: ['김지오 베네딕토', '신채민 소피아'] },
  // 12/1 Evening is empty in image

  // 12/2 (Tue)
  { date: '20251202', title: '화새벽', servers: ['이도현 마르코', '하서준 도미니코'] },
  { date: '20251202', title: '화저녁', servers: ['최진후 요한', '김주원 프란치스코'] },

  // 12/3 (Wed)
  { date: '20251203', title: '수새벽', servers: ['이지온 스테파노', '곽민찬 제노'] },
  { date: '20251203', title: '수저녁', servers: ['김범준 라파엘', '강지인 세실리아'] },

  // 12/4 (Thu)
  { date: '20251204', title: '목새벽', servers: ['권유나 율리아', '김규린 모니카'] },
  { date: '20251204', title: '성시간', servers: [] },

  // 12/5 (Fri)
  { date: '20251205', title: '금새벽', servers: ['김동윤 라파엘', '김하민 마리스텔라'] },
  { date: '20251205', title: '금저녁', servers: ['김태현 다미아노', '김규린 그라시아'] },

  // 12/6 (Sat)  
  { date: '20251206', title: '토어린이미사', servers: ['이연서 크리스티나', '이준웅 프란치스코'] },

  // Week 2
  // 12/7 (Sun)
  { date: '20251207', title: '주일새벽', servers: ['김주아 소피아', '천성재 루카'] },
  { date: '20251207', title: '주일저녁', servers: ['김도경 안드레아', '정수아 아셀라'] },

  // 12/8 (Mon)
  { date: '20251208', title: '월새벽', servers: ['윤주하 뽀리나', '박시형 베르다'] },

  // 12/9 (Tue)
  { date: '20251209', title: '화새벽', servers: ['임찬건 가브리엘', '석재이 엘리아'] },
  { date: '20251209', title: '화저녁', servers: ['서혜민 노엘라', '김재아 베네딕토'] },

  // 12/10 (Wed)
  { date: '20251210', title: '수새벽', servers: ['이하원 라파엘라', '손지우 가브리엘라'] },
  { date: '20251210', title: '수저녁', servers: ['김민지 스텔라', '박찬서 라파엘'] },

  // 12/11 (Thu)
  { date: '20251211', title: '목새벽', servers: ['장수민 크리스티나', '이다현 소화데레사'] },
  { date: '20251211', title: '목저녁', servers: ['김한희 임마누엘라', '박지훈 필립보'] },

  // 12/12 (Fri)
  { date: '20251212', title: '금새벽', servers: ['정수아 아셀라', '박찬서 라파엘'] },
  { date: '20251212', title: '금저녁', servers: ['손준우 미카엘', '최지호 미카엘라'] },

  // 12/13 (Sat)  
  { date: '20251213', title: '토어린이미사', servers: ['박범서 미카엘', '전도준 라파엘'] },

  // Week 3
  // 12/14 (Sun)
  { date: '20251214', title: '주일새벽', servers: ['최진후 요한', '이준웅 프란치스코'] },
  { date: '20251214', title: '주일저녁', servers: ['김지오 베네딕토', '원세연 엘리사벳'] },

  // 12/15 (Mon)
  { date: '20251215', title: '월새벽', servers: ['최리원 마리스텔라', '황지안 클라라'] },

  // 12/16 (Tue)
  { date: '20251216', title: '화새벽', servers: ['김범준 라파엘', '최요한 사도요한'] },
  { date: '20251216', title: '화저녁', servers: ['이유현 에밀리아', '석재원 베드로토마스'] },

  // 12/17 (Wed)
  { date: '20251217', title: '수새벽', servers: ['이연서 크리스티나', '최예라 리디아'] },
  { date: '20251217', title: '수저녁', servers: ['이윤서 비오', '김우현 레오'] },

  // 12/18 (Thu)
  { date: '20251218', title: '목새벽', servers: ['김민지 스텔라', '정태정 세례자요한'] },
  { date: '20251218', title: '합동판공성사', servers: [] },

  // 12/19 (Fri)
  { date: '20251219', title: '금새벽', servers: ['서혜민 노엘라', '장하윤 레오'] },
  { date: '20251219', title: '금저녁', servers: ['천성재 루카', '나연우 루피노'] },

  // 12/20 (Sat)
  { date: '20251220', title: '토어린이미사', servers: ['이도현 마르코', '이하원 라파엘라'] },

  // Week 4
  // 12/21 (Sun)
  { date: '20251221', title: '주일새벽', servers: ['박범서 미카엘', '김태현 다미아노'] },
  { date: '20251221', title: '주일저녁', servers: ['정도현 다니엘', '전도준 라파엘'] },

  // 12/22 (Mon)
  { date: '20251222', title: '월새벽', servers: ['이윤서 비오', '안서준 사도요한'] },

  // 12/23 (Tue)
  { date: '20251223', title: '화새벽', servers: ['이유현 에밀리아', '김규린 그라시아'] },
  { date: '20251223', title: '화저녁', servers: ['최리원 마리스텔라', '이동훈 암브로시오'] },

  // 12/24 (Wed)  
  { date: '20251224', title: '성탄 전야', servers: [] },

  // 12/25 (Thu)
  { date: '20251225', title: '교중미사', servers: ['서민호 발렌티노', '김동윤 라파엘'] }, // 교중미사(오전 10:30) place in Dawn slot
  { date: '20251225', title: '저녁미사', servers: ['하진우 안토니오', '권유나 율리아'] }, // 7시 30분 미사

  // 12/26 (Fri)
  { date: '20251226', title: '금새벽', servers: ['김한희 임마누엘라', '김주원 프란치스코'] },
  { date: '20251226', title: '금저녁', servers: ['박가영 스텔라', '곽민을 그레고리오'] },

  // 12/27 (Sat)
  { date: '20251227', title: '토어린이미사', servers: ['전도온 스테파노', '장수민 크리스티나'] },

  // Week 5
  // 12/28 (Sun)
  { date: '20251228', title: '주일새벽', servers: ['이서범 가브리엘', '강지인 세실리아'] }, 
  { date: '20251228', title: '주일저녁', servers: ['이지온 스테파노', '윤주하 뽀리나'] },

  // 12/29 (Mon)
  { date: '20251229', title: '월새벽', servers: ['김주아 소피아', '김재아 베네딕토'] },

  // 12/30 (Tue)
  { date: '20251230', title: '화새벽', servers: ['김도경 안드레아', '박지훈 필립보'] },
  { date: '20251230', title: '화저녁', servers: ['정도현 다니엘', '김예리 안젤라'] },

  // 12/31 (Wed)  
  { date: '20251231', title: '송년 감사 미사', servers: [] },
];
