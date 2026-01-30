import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import dayjs from 'dayjs';
import { REGION_V1 } from '../config';

const db = admin.firestore();


// Migrated to Google Generative AI SDK (API Key based)
import { GoogleGenerativeAI } from '@google/generative-ai';

export const analyzeMonthlyAssignments = functions.region(REGION_V1).runWith({ secrets: ["GOOGLE_AI_API_KEY"] }).https.onCall(async (data: any, context: any) => {
  // 1. Auth Check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '인증되지 않은 사용자입니다.');
  }

  const { serverGroupId, yyyymm } = data;
  if (!serverGroupId || !yyyymm) {
    throw new functions.https.HttpsError('invalid-argument', '필수 인자가 누락되었습니다.');
  }

  // Check for API Key
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
      console.error('GOOGLE_AI_API_KEY environment variable is missing.');
      throw new functions.https.HttpsError('internal', 'AI API 키가 설정되지 않았습니다.');
  }

  // Initialize Google Generative AI
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // 2. Data Fetching
    // (1) Members (Active only)
    const membersSnap = await db.collection(`server_groups/${serverGroupId}/members`)
      .where('active', '==', true)
      .get();
    
    // Map memberId -> Name
    const memberMap: Record<string, string> = {};
    membersSnap.docs.forEach(doc => {
        const d = doc.data();
        memberMap[doc.id] = d.name_kor || 'Unknown';
    });

    // (2) This Month Events
    const currentMonthPrefix = dayjs(yyyymm, 'YYYY-MM').format('YYYYMM'); 
    const startStr = `${currentMonthPrefix}01`;
    const endStr = `${currentMonthPrefix}31`;

    const thisMonthEventsSnap = await db.collection(`server_groups/${serverGroupId}/mass_events`)
        .where('event_date', '>=', startStr)
        .where('event_date', '<=', endStr)
        .get();

    // (3) Previous Month Events
    const prevMonthDate = dayjs(yyyymm, 'YYYY-MM').subtract(1, 'month');
    const prevMonthPrefix = prevMonthDate.format('YYYYMM');
    const prevStartStr = `${prevMonthPrefix}01`;
    const prevEndStr = `${prevMonthPrefix}31`;

    const prevMonthEventsSnap = await db.collection(`server_groups/${serverGroupId}/mass_events`)
        .where('event_date', '>=', prevStartStr)
        .where('event_date', '<=', prevEndStr)
        .get();

    // (4) Availability Survey
    const surveySnap = await db.collection(`server_groups/${serverGroupId}/availability_surveys/${currentMonthPrefix}/responses`).get();
    
    const unavailableMap: Record<string, string[]> = {}; 
    surveySnap.docs.forEach(doc => {
        const d = doc.data();
        const responses = d.responses || {};
        const unavailEvents = Object.keys(responses).filter(eid => responses[eid] === false);
        if (unavailEvents.length > 0) {
            unavailableMap[doc.id] = unavailEvents;
        }
    });

    // 3. Data Processing
    const assignmentStats: Record<string, { thisMonth: number; prevMonth: number; violations: number }> = {};
    
    Object.keys(memberMap).forEach(mid => {
        assignmentStats[mid] = { thisMonth: 0, prevMonth: 0, violations: 0 };
    });

    // Count This Month
    thisMonthEventsSnap.docs.forEach(doc => {
        const d = doc.data();
        const memberIds: string[] = d.member_ids || [];
        const eventId = doc.id;

        memberIds.forEach(mid => {
            if (!assignmentStats[mid]) return; 
            
            assignmentStats[mid].thisMonth += 1;

            if (unavailableMap[mid] && unavailableMap[mid].includes(eventId)) {
                assignmentStats[mid].violations += 1;
            }
        });
    });

    // Count Prev Month
    prevMonthEventsSnap.docs.forEach(doc => {
        const d = doc.data();
        const memberIds: string[] = d.member_ids || [];
        memberIds.forEach(mid => {
            if (assignmentStats[mid]) {
                assignmentStats[mid].prevMonth += 1;
            }
        });
    });

    // Text Summary
    const dataList = Object.entries(assignmentStats).map(([mid, stat]) => {
        const name = memberMap[mid];
        let line = `${name}: ${stat.thisMonth}회 (전월 ${stat.prevMonth}회)`;
        if (stat.violations > 0) {
            line += ` [불참일배정: ${stat.violations}건]`;
        }
        return line;
    }).join('\n');

    const totalMembers = Object.keys(memberMap).length;
    const assignedCount = Object.values(assignmentStats).filter(s => s.thisMonth > 0).length;
    const zeroAssigned = totalMembers - assignedCount;

    // 4. Gemini Content Generation
    const modelName = 'gemini-2.5-flash';
    console.log(`[analyzeMonthlyAssignments] Using Model: ${modelName} (Google AI SDK)`);

    const model = genAI.getGenerativeModel({ model: modelName });
    
    // Calculate previous month stats
    const prevMonthAssignedCount = Object.values(assignmentStats).filter(s => s.prevMonth > 0).length;
    const prevMonthTotal = Object.values(assignmentStats).reduce((sum, s) => sum + s.prevMonth, 0);
    const thisMonthTotal = Object.values(assignmentStats).reduce((sum, s) => sum + s.thisMonth, 0);

    // Fetch Custom Prompt from DB
    const promptSettingsRef = db.doc('system_settings/ai_config');
    const promptSnap = await promptSettingsRef.get();
    let promptTemplate = '';

    if (promptSnap.exists) {
        const data = promptSnap.data();
        if (data?.prompt_analyze_monthly_assignments?.template) {
            promptTemplate = data.prompt_analyze_monthly_assignments.template;
        } else if (data?.prompt_template) {
             promptTemplate = data.prompt_template;
        }
    }
    
    if (!promptTemplate) {
        // Default Prompt (Concise & Bullet-point style)
        promptTemplate = `
당신은 성당 복사 스케줄 데이터 분석가입니다. 
다음 데이터를 분석하여 **핵심만 요약된 개조식 보고서**를 작성하세요. 불필요한 서술어는 생략합니다.

**[분석 데이터]**
- 대상 월: {{yyyymm}}
- 전체 인원: {{totalMembers}}명
- 당월 배정: {{assignedCount}}명 (총 {{thisMonthTotal}}회)
- 전월 배정: {{prevMonthAssignedCount}}명 (총 {{prevMonthTotal}}회)
- 미배정: {{zeroAssigned}}명

**[개별 상세 데이터]**
{{dataList}}

---
**[현황 분석 보고서 양식]**

## 1. 📊 배정 현황 요약
- **전체 배정**: 총 {{thisMonthTotal}}회 (전월 대비 증감 확인 후 서술)
- **평균 배정**: 1인당 약 N회
- **미배정 인원**: N명 (이름 나열, 없으면 "없음")

## 2. 🚨 주요 점검 사항
- **편중 배정(과다)**: 4회 이상 배정자 (이름: 횟수) - 없으면 "특이사항 없음"
- **편중 배정(과소)**: 1회 이하 배정자 (이름: 횟수) - 신입 등 사유 추정 불가하면 이름만 나열
- **전월 대비 급변**: 전월 대비 2회 이상 차이 나는 인원 (이름: 전월N회 -> 당월N회)
- **불참일 위반**: [불참일배정] 표시된 인원 (반드시 경고! 없으면 "위반 없음")

## 3. 💡 개선 제안
- (데이터에 기반한 구체적이고 실질적인 제안 1줄)
`;
    }

    // Replace Variables
    const prompt = promptTemplate
        .replace(/{{yyyymm}}/g, yyyymm)
        .replace(/{{totalMembers}}/g, String(totalMembers))
        .replace(/{{assignedCount}}/g, String(assignedCount))
        .replace(/{{thisMonthTotal}}/g, String(thisMonthTotal))
        .replace(/{{prevMonthAssignedCount}}/g, String(prevMonthAssignedCount))
        .replace(/{{prevMonthTotal}}/g, String(prevMonthTotal))
        .replace(/{{zeroAssigned}}/g, String(zeroAssigned))
        .replace(/{{dataList}}/g, dataList);

    console.log('[analyzeMonthlyAssignments] Prompt Length:', prompt.length);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
        throw new Error('AI 응답을 생성하지 못했습니다.');
    }

    // 5. Save Insight with History
    const insightRef = db.doc(`server_groups/${serverGroupId}/ai_insights/${currentMonthPrefix}`);

    await db.runTransaction(async (t) => {
        const doc = await t.get(insightRef);
        let count = 0;
        if (doc.exists) {
            count = doc.data()?.total_count || 0;
        }
        count += 1;

        const data = {
            content: text,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            model: modelName,
            sdk: 'google-generative-ai',
            version: 1,
            total_count: count
        };

        t.set(insightRef, data);
    });

    // Add to History Collection
    await insightRef.collection('history').add({
        content: text,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        model: modelName,
        sdk: 'google-generative-ai'
    });

    return { success: true, content: text };

  } catch (error: any) {
    console.error('AI Analysis Error Details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw new functions.https.HttpsError('internal', `AI 분석 중 오류가 발생했습니다: ${error.message}`, error);
  }
});
