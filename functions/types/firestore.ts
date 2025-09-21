// functions/types/firestore.ts
export interface CreateServerGroupRequest {
  parishCode: string;
  name: string;
  timezone: string;
  locale: string;
  description?: string;
}

export interface CreateServerGroupResponse {
  serverGroupId: string;
}
