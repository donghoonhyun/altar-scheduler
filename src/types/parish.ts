export interface Parish {
  code: string;
  name_kor: string;
  diocese: string;
  name_eng?: string;
  active?: boolean;
  sms_service_active?: boolean;
  ai_service_active?: boolean;
  timezone?: string;
  locale?: string;
  created_at?: any;
  updated_at?: any;
}

export const DIOCESE_NAMES: Record<string, string> = {
  SEOUL: '서울교구',
  DAEGU: '대구대교구',
  GWANGJU: '광주대교구',
  DAEJEON: '대전교구',
  INCHEON: '인천교구',
  BUSAN: '부산교구',
  SUWON: '수원교구',
  UIJEONGBU: '의정부교구',
  JEJU: '제주교구',
  JEONJU: '전주교구',
  CHUNCHEON: '춘천교구',
  WONJU: '원주교구',
  ANDONG: '안동교구',
  MASAN: '마산교구',
  CHEONGJU: '청주교구',
};

export const getDioceseName = (code: string) => DIOCESE_NAMES[code] || code;
