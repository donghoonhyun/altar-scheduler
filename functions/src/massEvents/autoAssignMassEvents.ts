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
  anti_autoassign_locked?: boolean;
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

      // 5. Calculate Previous Month Performance & Last Assignment Date
      // Prev Month date range
      const prevDate = dayjs(`${year}-${month}-01`).subtract(1, 'month');
      const prevStartStr = prevDate.format('YYYYMMDD');
      const prevEndStr = prevDate.endOf('month').format('YYYYMMDD');

      const prevEventsSnap = await eventsRef
        .where('event_date', '>=', prevStartStr)
        .where('event_date', '<=', prevEndStr)
        .get();

      // Count assignments per member for prev month & Track Last Date
      const prevCountMap: Record<string, number> = {};
      const currCountMap: Record<string, number> = {};
      const memberLastDateMap: Record<string, string> = {}; // YYYYMMDD
      
      members.forEach(m => {
          prevCountMap[m.id] = 0;
          currCountMap[m.id] = 0;
          memberLastDateMap[m.id] = '00000000'; // Very old date
      });

      prevEventsSnap.forEach(doc => {
        const d = doc.data();
        if (d.member_ids && Array.isArray(d.member_ids)) {
          d.member_ids.forEach((uid: string) => {
            if (prevCountMap[uid] !== undefined) {
              prevCountMap[uid]++;
            }
            // Update last date if this event is later
            if (d.event_date && d.event_date > memberLastDateMap[uid]) {
                memberLastDateMap[uid] = d.event_date;
            }
          });
        }
      });

      // 6. Assignment Loop
      const batch = db.batch();
      let assignedEventCount = 0;

      for (const ev of events) {
        const eventId = ev.id;
        const currentEventDateStr = ev.event_date; // YYYYMMDD (Required)

        if (!currentEventDateStr) {
            console.warn(`Skipping event ${eventId} due to missing date.`);
            continue;
        }

        // 🔒 Check Lock (Automatic Assignment Exclusion)
        if (ev.anti_autoassign_locked === true) {
            console.log(`🔒 Skipped Locked Event: ${ev.title} (${ev.event_date})`);
            
            // Critical: Count existing members to maintain load balancing fairness
            // Also update LastDate map
            if (ev.member_ids && Array.isArray(ev.member_ids)) {
                ev.member_ids.forEach(uid => {
                    if (currCountMap[uid] !== undefined) {
                        currCountMap[uid]++; // Update THIS month count
                        if (currentEventDateStr > memberLastDateMap[uid]) {
                             memberLastDateMap[uid] = currentEventDateStr;
                        }
                    }
                });
            }
            continue; // Skip assignment logic
        }

        const required = ev.required_servers || 2; 

        // Filter Candidates
        // 1. Must be Active
        // 2. Must NOT be unavailable
        const baseCandidates = members.filter(m => {
           const unavailList = unavailableMap[m.id] || [];
           return !unavailList.includes(eventId);
        });

        // Loop to find candidates with Relaxing Gap constraints
        // Gap Priority: >= 2 days (Best), >= 1 day, >= 0 days
        let qualifiedCandidates: Member[] = [];

        // Strategy: Filter by gap, if count < required, reduce gap.
        const checkGap = (gapCriteria: number) => {
             return baseCandidates.filter(m => {
                 const lastDate = memberLastDateMap[m.id];
                 // Calculate diff in days
                 // Note: event_date is YYYYMMDD string.
                 const diff = dayjs(currentEventDateStr).diff(dayjs(lastDate), 'day');
                 return diff >= gapCriteria;
             });
        };

        // Try fit
        let filtered = checkGap(3); // 3일 이상 간격 (이상적: 이틀 쉬기)
        if (filtered.length < required) {
             filtered = checkGap(2); // 2일 이상 간격 (하루 쉬기)
        }
        if (filtered.length < required) {
             filtered = checkGap(1); // 1일 이상 간격
        }
        if (filtered.length < required) {
             filtered = baseCandidates; // 0일 간격 (같은 날 중복 배정) -> 최후의 수단
        }

        qualifiedCandidates = filtered;

        // Sort Candidates
        // Priority 1: Current Month Count (Ascending) - Round Robin
        // Priority 2: Prev Month Count (Ascending) - Tie Breaker
        // Priority 3: Name (Ascending)
        qualifiedCandidates.sort((a, b) => {
          const currA = currCountMap[a.id];
          const currB = currCountMap[b.id];
          if (currA !== currB) return currA - currB;

          const prevA = prevCountMap[a.id];
          const prevB = prevCountMap[b.id];
          if (prevA !== prevB) return prevA - prevB;

          return a.name_kor.localeCompare(b.name_kor); 
        });

        // Pick top N
        const selected = qualifiedCandidates.slice(0, required);
        const selectedIds = selected.map(m => m.id);

        // Update counts & Dates for selected members
        selectedIds.forEach(uid => {
          currCountMap[uid]++;
          // Update Last Date
          if (currentEventDateStr > memberLastDateMap[uid]) {
               memberLastDateMap[uid] = currentEventDateStr;
          }
        });

        // Determine Main Server (Juboksa)
        // Rule: Earliest start_year (smallest string) > Name (ABC)
        let mainMemberId = null;
        if (selected.length > 0) {
           const sortedForMain = [...selected].sort((a, b) => {
               const yearA = a.start_year || '9999'; 
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
