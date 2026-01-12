import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue, DocumentData } from 'firebase-admin/firestore';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { REGION_V1 } from '../config';

// --------------------------------------------------------------------------
// [CRITICAL] Version Note
// This function MUST remain on Firebase Functions V1.
// Attempting to migrate to V2 caused persistent CORS/Auth errors in Production.
// See docs/PRD/PRD-3.4.3-Backend Guidelines.md for details.
// --------------------------------------------------------------------------

dayjs.extend(utc);
dayjs.extend(timezone);

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export interface AutoAssignRequest {
  serverGroupId: string;
  year: number;
  month: number;
}

export interface AutoAssignResponse {
  success: boolean;
  assignedCount?: number;
  error?: string;
  details?: string;
}

interface AssignedEvent extends DocumentData {
  id: string;
  member_ids?: string[];
  required_servers?: number;
  event_date?: string;
}

interface Member extends DocumentData {
  id: string;
  name_kor: string;
  active?: boolean;
  start_year?: string;
}

interface SurveyResp {
  uid: string;
  unavailable?: string[];
}

export const autoAssignMassEvents = functions.region(REGION_V1)
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data: AutoAssignRequest, context) => {
    // V1 Adaptation
    const auth = context.auth;
    
    if (!auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');

    const { serverGroupId, year, month } = data;
    if (!serverGroupId || !year || !month) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing parameters.');
    }

    try {
      console.log(`🤖 AutoAssign (v2-public-fix) started for Group: ${serverGroupId}, ${year}-${month}`);

      // 1. Get Target Month Range (YYYYMMDD)
      const targetMonthStr = `${year}${String(month).padStart(2, '0')}`;
      const startDate = dayjs(`${year}-${month}-01`).format('YYYYMMDD');
      const endDate = dayjs(`${year}-${month}-01`).endOf('month').format('YYYYMMDD');

      // 2. Fetch Target Events (SURVEY-CONFIRMED status, effectively)
      // Actually, user said loop 1st to end. We'll query by date range.
      const eventsRef = db.collection(`server_groups/${serverGroupId}/mass_events`);
      const eventsSnap = await eventsRef
        .where('event_date', '>=', startDate)
        .where('event_date', '<=', endDate)
        .orderBy('event_date', 'asc')
        .get();

      if (eventsSnap.empty) {
        return { success: true, assignedCount: 0, details: 'No events found.' };
      }

      const events = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssignedEvent));

      // 3. Fetch Active Members
      const membersRef = db.collection(`server_groups/${serverGroupId}/members`);
      const membersSnap = await membersRef.where('active', '==', true).get();
      const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      
      // Map for easy access and initialization of counts
      const memberMap: Record<string, Member> = {};
      members.forEach(m => memberMap[m.id] = m);

      // 4. Fetch Survey Responses
      const surveyDocRef = db.doc(`server_groups/${serverGroupId}/availability_surveys/${targetMonthStr}`);
      const surveySnap = await surveyDocRef.get();
      const surveyData = surveySnap.exists ? surveySnap.data() : null;
      const responses = surveyData?.responses || {};
      
      // Build Unavailable Map: MemberID -> [EventID, ...]
      const unavailableMap: Record<string, string[]> = {};
      Object.keys(memberMap).forEach(uid => unavailableMap[uid] = []);

      Object.values(responses).forEach((val) => {
        const resp = val as SurveyResp;
        if (resp.unavailable && Array.isArray(resp.unavailable)) {
          unavailableMap[resp.uid] = resp.unavailable; 
        }
      });

      // 5. Calculate Previous Month Performance
      // Prev Month date range
      const prevDate = dayjs(`${year}-${month}-01`).subtract(1, 'month');
      const prevStartStr = prevDate.format('YYYYMMDD');
      const prevEndStr = prevDate.endOf('month').format('YYYYMMDD');

      const prevEventsSnap = await eventsRef
        .where('event_date', '>=', prevStartStr)
        .where('event_date', '<=', prevEndStr)
        .get();

      // Count assignments per member for prev month
      // And initialize totalAssignmentCount with it. 
      // This respects "Start with those who had fewer assignments last month".
      const assignmentCountMap: Record<string, number> = {};
      members.forEach(m => assignmentCountMap[m.id] = 0);

      prevEventsSnap.forEach(doc => {
        const d = doc.data();
        if (d.member_ids && Array.isArray(d.member_ids)) {
          d.member_ids.forEach((uid: string) => {
            if (assignmentCountMap[uid] !== undefined) {
              assignmentCountMap[uid]++;
            }
          });
        }
      });

      // 6. Assignment Loop
      const batch = db.batch();
      let assignedEventCount = 0;

      for (const ev of events) {
        const eventId = ev.id;
        const required = ev.required_servers || 2; // Default to 2 if not set?

        // Filter Candidates
        // 1. Must be Active (already filtered in members list)
        // 2. Must NOT be unavailable for this event
        const candidates = members.filter(m => {
           const unavailList = unavailableMap[m.id] || [];
           return !unavailList.includes(eventId);
        });

        // Sort Candidates
        // Priority 1: Current Total Assignment Count (Prev + This Month) - Ascending
        // Priority 2: Name (Ascending)
        candidates.sort((a, b) => {
          const countA = assignmentCountMap[a.id];
          const countB = assignmentCountMap[b.id];

          if (countA !== countB) {
            return countA - countB;
          }
          return a.name_kor.localeCompare(b.name_kor); 
        });

        // Pick top N
        const selected = candidates.slice(0, required);
        const selectedIds = selected.map(m => m.id);

        // Update counts for selected members
        selectedIds.forEach(uid => {
          assignmentCountMap[uid]++;
        });

        // Determine Main Server (Juboksa)
        // Rule: 1 person -> they are main.
        // Rule: >= 2 people -> Earliest start_year (smallest string) > Name (ABC)
        let mainMemberId = null;
        if (selected.length > 0) {
           const sortedForMain = [...selected].sort((a, b) => {
               const yearA = a.start_year || '9999'; // Treat missing as very recent
               const yearB = b.start_year || '9999';
               
               if (yearA !== yearB) {
                   return yearA.localeCompare(yearB);
               }
               return a.name_kor.localeCompare(b.name_kor);
           });
           mainMemberId = sortedForMain[0].id;
        }

        // Add to Batch
        const evRef = db.doc(`server_groups/${serverGroupId}/mass_events/${eventId}`);
        batch.update(evRef, { 
          member_ids: selectedIds,
          main_member_id: mainMemberId || FieldValue.delete(),
          updated_at: FieldValue.serverTimestamp()
        });
        
        assignedEventCount++;
      }

      await batch.commit();

      console.log(`✅ AutoAssign completed. Processed ${assignedEventCount} events.`);
      return { success: true, assignedCount: assignedEventCount };

    } catch (err) {
      console.error('❌ AutoAssign Error:', err);
      // Return custom error object correctly
      if (err instanceof Error) {
           throw new functions.https.HttpsError('internal', err.message);
      }
      throw new functions.https.HttpsError('internal', 'Unknown error');
    }
  }
);
