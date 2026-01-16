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
    console.log('⏰ Starting Daily Mass Reminder...');
    const db = admin.firestore();

    // 0. Pre-fetch Parishes for Timezone/Locale/SMS Config
    const parishSnaps = await db.collection('parishes').get();
    const parishMap = new Map<string, any>();
    parishSnaps.forEach(p => parishMap.set(p.id, p.data()));
    
    // 2. Scan Server Groups
    // Optimization: In a large system, we might paginate or query active groups only.
    const groupSnaps = await db.collection('server_groups').where('active', '==', true).get();

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
        }
      } catch (err) {
        console.error(`⚠️ Failed to check SMS settings for ${sgId}:`, err);
      }

      // 4. Find Tomorrow's Events
      const eventSnaps = await groupDoc.ref
        .collection('mass_events')
        .where('event_date', '==', targetDateStr)
        .where('status', '==', 'FINAL-CONFIRMED')
        // Logic: Usually we notify for assigned masses. Status might be MASS-CONFIRMED or FINAL-CONFIRMED.
        // Let's include both or just check if members are assigned.
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
             pushResult: 'success'|'fail'|'skipped';
             smsResult: 'success'|'fail'|'skipped';
        }[] = [];

        // Fetch member details
        // Note: 'in' query limited to 10. If >10 members, need batching. usually < 6.
        const memberSnaps = await groupDoc.ref.collection('members')
          .where(admin.firestore.FieldPath.documentId(), 'in', memberIds)
          .get();

        for (const mDoc of memberSnaps.docs) {
            const mData = mDoc.data();
            recipients.push({
                memberId: mDoc.id,
                name: mData.name_kor || '복사',
                parentUid: mData.parent_uid,
                phone: mData.phone_guardian, // Priority: Guardian Phone
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
            for (const r of recipients) {
                if (r.phone) {
                    try {
                        // Personalize SMS
                        const smsBody = template
                            .replace('{date}', prettyDate)
                            .replace('{title}', eventTitle)
                            .replace('{name}', r.name);

                        const res: any = await sendSolapiMessage(r.phone, smsBody);
                        r.smsResult = 'success';
                        
                        const gid = res?.groupInfo?._id || res?.groupId || res?._id; 
                        if (gid) smsGroupId = gid;
                    } catch (e) {
                        console.error(`SMS failed for ${r.name}:`, e);
                        r.smsResult = 'fail';
                    }
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
                    name: r.name,
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
      }
    }
  });
