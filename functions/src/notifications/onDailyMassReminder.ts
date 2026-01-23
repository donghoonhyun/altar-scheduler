/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { sendSolapiMessage } from '../services/solapi';
import { sendNotificationToUids } from './utils';

dayjs.extend((utc as any).default ?? utc);
dayjs.extend((timezone as any).default ?? timezone);

/**
 * Core Logic for Daily Mass Reminder
 * Can be called by Scheduled Function or Callable Function
 */
async function executeDailyMassReminder() {
  console.log('⏰ Starting Daily Mass Reminder (Core)...');
  const db = admin.firestore();
  
  // Ensure config is accessible
  const config = functions.config();
  console.log('🔧 Solapi Config Loaded:', { 
      hasApiKey: !!config.solapi?.api_key, 
      hasSecret: !!config.solapi?.api_secret, 
      sender: config.solapi?.sender 
  });

  // 0. Pre-fetch Parishes for Timezone/Locale/SMS Config
  const parishSnaps = await db.collection('parishes').get();
  const parishMap = new Map<string, any>();
  parishSnaps.forEach(p => parishMap.set(p.id, p.data()));
  
  // 2. Scan Server Groups
  // Optimization: In a large system, we might paginate or query active groups only.
  const groupSnaps = await db.collection('server_groups').where('active', '==', true).get();

  let totalProcessed = 0;

  for (const groupDoc of groupSnaps.docs) {
    const sgId = groupDoc.id;
    const groupData = groupDoc.data();
    const parishCode = groupData.parish_code;
    
    const parishData = parishCode ? parishMap.get(parishCode) : null;
    const timezone = parishData?.timezone || 'Asia/Seoul';
    const locale = parishData?.locale || 'ko-KR';

    // 1. Calculate Target Date (Tomorrow in Parish's Timezone)
    // Firestore stores event_date as 'YYYYMMDD' string.
    const tomorrow = dayjs().tz(timezone).add(1, 'day');
    const targetDateStr = tomorrow.format('YYYYMMDD');
    const prettyDate = tomorrow.locale(locale).format('M/D(ddd)');

    console.log(`[${sgId}] Parish: ${parishCode}, TZ: ${timezone}, Target: ${targetDateStr}`);

    // 3. Check SMS Settings
    // Hierarchy: Parish Config (Active) && ServerGroup Config (Active)
    let isSmsEnabled = false;
    let smsGroupId: string | undefined = undefined;

    try {
      const isGroupSmsActive = groupData.sms_service_active === true;
      if (isGroupSmsActive && parishData?.sms_service_active === true) {
           isSmsEnabled = true;
      } else {
           console.log(`[${sgId}] SMS Disabled: GroupActive=${isGroupSmsActive}, ParishActive=${parishData?.sms_service_active}`);
      }
    } catch (err) {
      console.error(`⚠️ Failed to check SMS settings for ${sgId}:`, err);
    }

    // 4. [NEW LOGIC] Check Month Status First!
    const targetMonth = tomorrow.format('YYYYMM');
    // Note: groupDoc.ref is a DocumentReference.
    // To access subcollection, we use `db.collection(...)` or `groupDoc.ref.collection(...)`
    const monthStatusRef = groupDoc.ref.collection('month_status').doc(targetMonth);
    const monthStatusSnap = await monthStatusRef.get();
    
    let isMonthConfirmed = false;
    if (monthStatusSnap.exists) {
        const mData = monthStatusSnap.data();
        if (mData?.status === 'FINAL-CONFIRMED') {
            isMonthConfirmed = true;
        }
    }

    if (!isMonthConfirmed) {
        console.log(`>> Group [${sgId}] Month ${targetMonth} is NOT Final Confirmed. Skipping reminders.`);
        continue; 
    }

    // 5. Find Tomorrow's Events (Without status check, relying on Month Status)
    const eventSnaps = await groupDoc.ref
      .collection('mass_events')
      .where('event_date', '==', targetDateStr)
      // .where('status', '==', 'FINAL-CONFIRMED') // ❌ Removed outdated status check
      .get();

    if (eventSnaps.empty) continue;

    console.log(`>> Group [${sgId}] has ${eventSnaps.size} events for tomorrow.`);

    for (const eventDoc of eventSnaps.docs) {
      const eventData = eventDoc.data();
      const memberIds = eventData.member_ids as string[];
      
      if (!memberIds || memberIds.length === 0) continue;

      const eventTitle = eventData.title || '미사';
      
      // Message Content Construction (Template Base)
      const defaultTemplate = '[알림] 내일({date}) {title} {name} 복사 배정이 있습니다. 늦지 않게 준비바랍니다.';
      const template = groupData.sms_reminder_template || defaultTemplate;
      
      // Generic Body for Push (Cannot personalize easily with multicast unless we loop)
      // For Push, let's use a standard format without name, or just "복사".
      const pushBody = `[알림] 내일(${prettyDate}) ${eventTitle} 복사 배정이 있습니다. 늦지 않게 준비바랍니다.`;
      const messageTitle = '미사 배정 알림';

      // 5. Gather Recipients
      const recipients: {
           memberId: string; 
           name: string; 
           parentUid?: string; 
           phone?: string;
           parentName?: string;
           pushResult: 'success'|'fail'|'skipped';
           smsResult: 'success'|'fail'|'skipped';
      }[] = [];

      // 5.1 Fetch Member details (to get Child Name & Parent UID)
      // Note: 'in' query limited to 30.
      const memberSnaps = await groupDoc.ref.collection('members')
        .where(admin.firestore.FieldPath.documentId(), 'in', memberIds)
        .get();

      const memberMap = new Map<string, any>(); // memberId -> MemberData
      const parentUidsToFetch = new Set<string>();

      for (const mDoc of memberSnaps.docs) {
          const mData = mDoc.data();
          memberMap.set(mDoc.id, mData);
          if (mData.parent_uid) {
              parentUidsToFetch.add(mData.parent_uid);
          }
      }

      // 5.2 Fetch Parent Users (to get Phone & Parent Name)
      // We STRICTLY use the parent's phone number as requested.
      const parentDataMap = new Map<string, { phone: string; name: string }>();
      
      if (parentUidsToFetch.size > 0) {
           const uniquePids = [...parentUidsToFetch];
           const chunks = [];
           for (let i = 0; i < uniquePids.length; i += 10) {
               chunks.push(uniquePids.slice(i, i + 10));
           }

           for (const chunk of chunks) {
               try {
                   const uSnaps = await db.collection('users')
                       .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
                       .get();
                   
                   uSnaps.forEach(uDoc => {
                       const uData = uDoc.data();
                       if (uData.phone) {
                           parentDataMap.set(uDoc.id, {
                               phone: uData.phone,
                               name: uData.user_name || uData.name || '보호자'
                           });
                       }
                   });
               } catch (e) {
                   console.error("⚠️ Failed to fetch parent users:", e);
               }
           }
      }

      // 5.3 Build Final Recipients List
      for (const mDoc of memberSnaps.docs) {
          const mData = mDoc.data();
          const pUid = mData.parent_uid;
          
          if (!pUid) {
              console.log(`>> Skipping member ${mData.name_kor}: No Linked Parent.`);
              continue;
          }

          const pData = parentDataMap.get(pUid);
          if (!pData) {
               console.log(`>> Skipping member ${mData.name_kor}: Parent User not found or no phone.`);
               continue;
          }

          recipients.push({
              memberId: mDoc.id,
              name: mData.name_kor || '복사',
              parentUid: pUid,
              phone: pData.phone,       // ✅ Strictly use Parent Phone
              parentName: pData.name,   // ✅ Strictly use Parent Name
              pushResult: 'skipped',
              smsResult: 'skipped'
          });
      }

      // 6. Send Notifications

      // 6.1 App Push (to Parent UIDs) -> Send Generic Message
      const pushTargets = recipients.filter(r => r.parentUid).map(r => r.parentUid!);
      if (pushTargets.length > 0) {
          try {
              await sendNotificationToUids(pushTargets, messageTitle, pushBody, `/server-groups/${sgId}/mass-events`);
              // Assume success for all for now (utils doesn't return detailed breakdown yet)
              recipients.forEach(r => { if(r.parentUid) r.pushResult = 'success'; });
          } catch (e) {
              console.error('Push failed:', e);
              recipients.forEach(r => { if(r.parentUid) r.pushResult = 'fail'; });
          }
      }

      // 6.2 SMS (if enabled) -> Send Personalized Message
      if (isSmsEnabled) {
          console.log(`>> SMS is ENABLED for Group [${sgId}]. Processing ${recipients.length} recipients...`);
          for (const r of recipients) {
              if (r.phone) {
                  // Personalize SMS
                  const smsBody = template
                      .replace('{date}', prettyDate)
                      .replace('{title}', eventTitle)
                      .replace('{name}', r.name);

                  try {
                      const res: any = await sendSolapiMessage(r.phone, smsBody);
                      r.smsResult = 'success';
                      
                      const gid = res?.groupInfo?._id || res?.groupId || res?._id; 
                      if (gid) smsGroupId = gid;

                      // ✅ WRITE TO GLOBAL LOGS (for Admin View)
                      await db.collection('system_sms_logs').add({
                          created_at: admin.firestore.Timestamp.now(),
                          sender: 'System (Reminder)',
                          sender_email: 'system@altar-scheduler',
                          receiver: r.phone,
                          receiver_name: r.parentName || `${r.name} 보호자`, // ✅ Use Parent Name (or fallback)
                          parent_uid: r.parentUid, // ✅ Added Parent UID for reference
                          message: smsBody,
                          status: 'success',
                          group_id: gid,
                          parish_code: parishCode,
                          server_group_id: sgId,
                          message_type: 'SMS',
                          // ✅ Simplified Result (Remove bulk bloat)
                          result: { 
                              groupId: gid, 
                              accountId: res?.groupInfo?.accountId,
                              apiVersion: res?.groupInfo?.apiVersion
                          }
                      });

                  } catch (e: any) {
                      console.error(`SMS failed for ${r.name}:`, e);
                      r.smsResult = 'fail';

                      // ✅ WRITE ERROR LOG
                      await db.collection('system_sms_logs').add({
                          created_at: admin.firestore.Timestamp.now(),
                          sender: 'System (Reminder)',
                          sender_email: 'system@altar-scheduler',
                          receiver: r.phone,
                          receiver_name: r.parentName || `${r.name} 보호자`, // ✅ Use Parent Name
                          parent_uid: r.parentUid, // ✅ Added Parent UID
                          message: smsBody,
                          status: 'failed',
                          parish_code: parishCode,
                          server_group_id: sgId,
                          error: e.message || JSON.stringify(e)
                      });
                  }
              } else {
                  console.log(`>> Skipping SMS for ${r.name} (${r.memberId}): No phone number.`);
              }
          }
      }



      const logs = [];

      // Push Log
      const pushRecipients = recipients.filter(r => r.pushResult === 'success');
      if (pushRecipients.length > 0) {
          logs.push({
              type: 'app_push',
              sent_at: admin.firestore.Timestamp.now(), // Use Timestamp for Firestore
              recipient_count: pushRecipients.length,
              status: 'success',
              message: pushBody,
              details: pushRecipients.map(r => ({
                  member_id: r.memberId,
                  name: r.name,
                  result: 'success'
              }))
          });
      }

      // SMS Log
      const smsRecipients = recipients.filter(r => r.smsResult === 'success' || r.smsResult === 'fail'); // Log attempts
      if (isSmsEnabled && smsRecipients.length > 0) {
           // Calculate overall status
           const successCount = smsRecipients.filter(r => r.smsResult === 'success').length;
           const status = successCount === smsRecipients.length ? 'success' : (successCount > 0 ? 'partial' : 'failure');

           logs.push({
              type: 'sms',
              sent_at: admin.firestore.Timestamp.now(),
              recipient_count: successCount,
              status: status,
              message: pushBody, // Use generic body for logs as individual messages vary
              group_id: smsGroupId,
              details: smsRecipients.map(r => ({
                  member_id: r.memberId,
                  name: r.parentName || r.name, // ✅ Use Parent Name for display in Drawer Detail
                  phone: r.phone,
                  result: r.smsResult
              }))
          });
      }
      
      if (logs.length > 0) {
          await eventDoc.ref.update({
              notifications: admin.firestore.FieldValue.arrayUnion(...logs)
          });
          console.log(`📝 Logged ${logs.length} notifications for event ${eventDoc.id}`);
      }
      totalProcessed++;
    }
  }
  return totalProcessed;
}

/**
 * [Scheduled Function] Daily Mass Reminder
 * - Logic: Runs every day at 20:00 (KST).
 * - Target: MassEvents scheduled for "Tomorrow".
 * - Recipient: Parents of assigned servers.
 * - Channels: App Push (default), SMS (if enabled in settings).
 */
export const onDailyMassReminder = functions
  .region('asia-northeast3') // Seoul Region
  .pubsub.schedule('every day 20:00')
  .timeZone('Asia/Seoul')
  .onRun(async (_context) => {
    await executeDailyMassReminder();
  });


/**
 * [Manual Callable Function] Manual Daily Mass Reminder
 * - Logic: Same as scheduled, but triggerable manually via HTTPS.
 */
export const manualDailyMassReminder = functions
  .region('asia-northeast3')
  .https.onCall(async (data, context) => {
     // Basic Auth Check
     if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '인증된 사용자만 실행할 수 있습니다.');
     }

     console.log(`⚡ Manual Reminder triggered by ${context.auth.uid}`);
     
     try {
       const count = await executeDailyMassReminder();
       return { success: true, message: `Manual execution completed. Processed ${count} events.` };
     } catch (err: any) {
       console.error("Manual execution failed:", err);
       throw new functions.https.HttpsError('internal', err.message || 'Error occurred');
     }
  });
