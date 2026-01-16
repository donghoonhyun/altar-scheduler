export interface Parish {
  code: string;
  name_kor: string;
  diocese: string;
  name_eng?: string;
  active?: boolean;
  sms_service_active?: boolean;
  timezone?: string;
  locale?: string;
  created_at?: any;
  updated_at?: any;
}
