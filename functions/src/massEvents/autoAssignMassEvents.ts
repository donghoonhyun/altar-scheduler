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
      console.log(`🤖 AutoAssign (v3-Smart) started for Group: ${serverGroupId}, ${year}-${month}`);

      // 1. Get Target Month Range (YYYYMMDD)
      const targetMonthStr = `${year}${String(month).padStart(2, '0')}`;
      const startDate = dayjs(`${year}-${month}-01`).format('YYYYMMDD');
      const endDate = dayjs(`${year}-${month}-01`).endOf('month').format('YYYYMMDD');

      // 2. Fetch Target Events (All events in range)
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
      
      const memberMap: Record<string, Member> = {};
      let maxStartYear = 0; // Integer
      const currentYearNum = dayjs().year();

      members.forEach(m => {
          memberMap[m.id] = m;
          const rawY = m.start_year;
          let yVal = 0;
          
          if (typeof rawY === 'number') yVal = rawY;
          else if (typeof rawY === 'string') yVal = parseInt(rawY.trim(), 10);
          
          if (!isNaN(yVal) && yVal > 0 && yVal <= currentYearNum) {
              if (yVal > maxStartYear) {
                  maxStartYear = yVal;
              }
          }
      });
      console.log(`🔎 [AutoAssign] Max Start Year (Int): ${maxStartYear} (Limit: ${currentYearNum})`);

      // 4. Fetch Survey Responses
      const surveyDocRef = db.doc(`server_groups/${serverGroupId}/availability_surveys/${targetMonthStr}`);
      const surveySnap = await surveyDocRef.get();
      const surveyData = surveySnap.exists ? surveySnap.data() : null;
      const responses = surveyData?.responses || {};
      
      // Unavailable Map: MemberID -> [EventID, ...]
      const unavailableMap: Record<string, string[]> = {};
      Object.keys(memberMap).forEach(uid => unavailableMap[uid] = []);

      Object.values(responses).forEach((val) => {
        const resp = val as SurveyResp;
        if (resp.unavailable && Array.isArray(resp.unavailable)) {
          unavailableMap[resp.uid] = resp.unavailable; 
        }
      });

      // 5. Initialize Counters & Assignment Logs
      const prevCountMap: Record<string, number> = {};
      const currCountMap: Record<string, number> = {};
      // Track ALL assigned dates (for gap check against past AND future fixed events)
      const memberAssignedDates: Record<string, string[]> = {}; 
      
      members.forEach(m => {
          prevCountMap[m.id] = 0;
          currCountMap[m.id] = 0;
          memberAssignedDates[m.id] = [];
      });

      // 5-1. Load Previous Month Stats
      const prevDate = dayjs(`${year}-${month}-01`).subtract(1, 'month');
      const prevStartStr = prevDate.format('YYYYMMDD');
      const prevEndStr = prevDate.endOf('month').format('YYYYMMDD');

      const prevEventsSnap = await eventsRef
        .where('event_date', '>=', prevStartStr)
        .where('event_date', '<=', prevEndStr)
        .get();

      prevEventsSnap.forEach(doc => {
        const d = doc.data();
        if (d.member_ids && Array.isArray(d.member_ids)) {
          d.member_ids.forEach((uid: string) => {
            if (prevCountMap[uid] !== undefined) {
              prevCountMap[uid]++;
            }
            if (d.event_date && memberAssignedDates[uid]) {
                memberAssignedDates[uid].push(d.event_date);
            }
          });
        }
      });

      // 5-2. Load LOCKED (Fixed) Events for THIS Month
      // This is crucial for Requirement 1 & 3: Count them and use them for gap checks.
      events.forEach(ev => {
          if (ev.anti_autoassign_locked && ev.member_ids && Array.isArray(ev.member_ids)) {
              ev.member_ids.forEach(uid => {
                  if (currCountMap[uid] !== undefined) {
                      currCountMap[uid]++;
                  }
                  if (ev.event_date && memberAssignedDates[uid]) {
                      memberAssignedDates[uid].push(ev.event_date);
                  }
              });
          }
      });

      // 5-3. Calculate Availability Scores (Heuristic for Pass 1)
      // Count how many events each member CAN attend. Lower score = Harder to fit = Priority.
      const availabilityScores: Record<string, number> = {};
      members.forEach(m => availabilityScores[m.id] = 0);

      events.forEach(ev => {
          // Only count assignable events
          if (ev.anti_autoassign_locked || !ev.event_date) return;
          
          members.forEach(m => {
              const unavailList = unavailableMap[m.id] || [];
              // If not unavailable, they have a 'slot' opportunity
              if (!unavailList.includes(ev.id)) {
                  availabilityScores[m.id]++;
              }
          });
      });
      // console.log('Availability Scores:', availabilityScores);

      // 6. Assignment Logic (2-Pass Algorithm)
      // Pass 1: Fill slots with 0-count members ONLY (Maximize 'At least 1')
      // Pass 2: Fill remaining slots with anyone (Weighted distribution)

      const assignedResults: Record<string, Member[]> = {}; // Map<EventID, SelectedMembers>
      events.forEach(ev => { assignedResults[ev.id] = []; });

      const runAssignmentPass = (isZeroCountPass: boolean) => {
          // Shuffle events slightly to avoid date-order bias? 
          // No, chronological order is better for gap check consistency.
          
          for (const ev of events) {
            const eventId = ev.id;
            const currentEventDateStr = ev.event_date;
            if (!currentEventDateStr || ev.anti_autoassign_locked) continue;

            const required = ev.required_servers ?? 2;
            const currentSelected = assignedResults[eventId];
            
            // If already full, skip
            if (currentSelected.length >= required) continue;
            
            // 1. Filter Base Candidates (Active & Not Unavailable)
            // Also exclude already selected for THIS event
            const pickedIds = new Set(currentSelected.map(m => m.id));
            
            const baseCandidates = members.filter(m => {
               if (pickedIds.has(m.id)) return false; // Already picked for this event
               const unavailList = unavailableMap[m.id] || [];
               return !unavailList.includes(eventId);
            });

            // 2. Filter for Zero Count (Pass 1 Only)
            let passCandidates = baseCandidates;
            if (isZeroCountPass) {
                passCandidates = baseCandidates.filter(m => (currCountMap[m.id] || 0) === 0);
            }

            // If no candidates in this pass, continue to next event
            if (passCandidates.length === 0) continue;

            // 3. Gap Check Function
            const checkGap = (gapCriteria: number) => {
                 return passCandidates.filter(m => {
                     const dates = memberAssignedDates[m.id] || [];
                     
                     // For 0-count pass, we force gap=1 (minimal) to maximize assignment
                     const effectiveGap = isZeroCountPass ? 1 : gapCriteria;
                     
                     const isTooClose = dates.some(d => {
                         const diff = Math.abs(dayjs(currentEventDateStr).diff(dayjs(d), 'day'));
                         return diff < effectiveGap;
                     });
                     return !isTooClose;
                 });
            };

            // 4. Try Fit (Gap Relaxation)
            let qualifiedCandidates: Member[] = [];
            
            if (isZeroCountPass) {
                // In Pass 1 (Zero Count), we are aggressive. Use Gap=1 immediately.
                qualifiedCandidates = checkGap(1);
            } else {
                // In Pass 2 (Standard), we try 3 -> 2 -> 1
                qualifiedCandidates = checkGap(3);
                if (qualifiedCandidates.length < (required - currentSelected.length)) {
                     // If purely qualified are not enough, try relaxing gap for ALL candidates?
                     // Or just mix them? 
                     // Let's just collect ALL valid candidates with relaxed gaps to fill the spots.
                     const gap2 = checkGap(2);
                     // Add new unique candidates found in gap2
                     const existingIds = new Set(qualifiedCandidates.map(m => m.id));
                     gap2.forEach(m => { if(!existingIds.has(m.id)) qualifiedCandidates.push(m); });
                }
                if (qualifiedCandidates.length < (required - currentSelected.length)) {
                     const gap1 = checkGap(1);
                     const existingIds = new Set(qualifiedCandidates.map(m => m.id));
                     gap1.forEach(m => { if(!existingIds.has(m.id)) qualifiedCandidates.push(m); });
                }
            }

            // 5. Sort Candidates
            qualifiedCandidates.sort((a, b) => {
              const currA = currCountMap[a.id];
              const currB = currCountMap[b.id];
              
              if (currA !== currB) return currA - currB; // Less filled first

              // ✅ [New Rule] If both are UNASSIGNED (0 count), ignore Prev Month Count.
              // Give everyone a fair chance for their first assignment, regardless of last month's activity.
              // This prevents active members from being penalized and left with 0 assignments.
              if (currA === 0 && currB === 0) {
                  // Sub-Priority: Availability Score (ASC) - Rescue those with few options
                  const scoreA = availabilityScores[a.id];
                  const scoreB = availabilityScores[b.id];
                  if (scoreA !== scoreB) return scoreA - scoreB;

                  return 0; // Skip to Random Sort (Priority 5)
              }

              const prevA = prevCountMap[a.id];
              const prevB = prevCountMap[b.id];
              // Priority 2: Prev Month Count (Ascending)
              if (prevA !== prevB) return prevA - prevB;

              return Math.random() - 0.5; 
            });

            // 6. Picking Loop
            // We need to pick enough people to fill the gap, BUT respecting Novice Protection is tricky in 2-Pass.
            // In Pass 1, we might pick only Novices (if all 0-count are novices).
            // That's fine. Pass 2 can add a Senior.
            // But what if Pass 1 fills ALL spots with Novices?
            // -> That's a risk. "Novice Protection" vs "Fair Distribution".
            // User prioritized "Every server must be assigned at least once".
            // So we allow All-Novice in Pass 1 if necessary. 
            // However, we should try to balance if possible.
            
            // Let's just pick from top.
            while (currentSelected.length < required && qualifiedCandidates.length > 0) {
                 const best = qualifiedCandidates.shift()!;
                 
                 // Add to selection
                 currentSelected.push(best);
                 
                 // Update Stats immediately so next event knows
                 currCountMap[best.id]++;
                 if (!memberAssignedDates[best.id]) memberAssignedDates[best.id] = [];
                 memberAssignedDates[best.id].push(currentEventDateStr);
            }
          }
      };

      console.log('🚀 Running Pass 1: Zero-Count Priority...');
      runAssignmentPass(true); // Pass 1: 0-count only

      console.log('🚀 Running Pass 2: Filling Remaining Slots...');
      runAssignmentPass(false); // Pass 2: Fill rest
      
      
      // 7. Commit Batch
      const batch = db.batch();
      let assignedEventCount = 0;

      for (const ev of events) {
          if (ev.anti_autoassign_locked) continue;
          
          const selected = assignedResults[ev.id];
          const selectedIds = selected.map(m => m.id);
          
          // Determine Main Member
          let mainMemberId = null;
          if (selected.length > 0) {
            const sortedForMain = [...selected].sort((a, b) => {
                const yearA = a.start_year || '9999'; 
                const yearB = b.start_year || '9999';
                if (yearA !== yearB) return yearA.localeCompare(yearB);
                return a.name_kor.localeCompare(b.name_kor);
            });
            mainMemberId = sortedForMain[0].id;
          }

          const evRef = db.doc(`server_groups/${serverGroupId}/mass_events/${ev.id}`);
          batch.update(evRef, { 
            member_ids: selectedIds,
            main_member_id: mainMemberId || FieldValue.delete(),
            updated_at: FieldValue.serverTimestamp()
          });
          assignedEventCount++;
      }

      await batch.commit();

      console.log(`✅ AutoAssign completed. Processed ${assignedEventCount} events. MaxStartYear detected: ${maxStartYear}`);
      return { 
          success: true, 
          assignedCount: assignedEventCount,
          maxStartYear: maxStartYear 
      };

    } catch (err) {
      console.error('❌ AutoAssign Error:', err);
      if (err instanceof Error) {
           throw new functions.https.HttpsError('internal', err.message);
      }
      throw new functions.https.HttpsError('internal', 'Unknown error');
    }
  }
);
