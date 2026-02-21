/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { COL_NOTIFICATIONS, COL_SERVER_GROUPS } from '../firestorePaths';

dayjs.extend((utc as any).default ?? utc);
dayjs.extend((timezone as any).default ?? timezone);

const db = admin.firestore();

async function enqueueDailyMassReminderCore(): Promise<{ groups: number; events: number; queued: number }> {
  const groupSnap = await db.collection(COL_SERVER_GROUPS).where('active', '==', true).get();

  let groupCount = 0;
  let eventCount = 0;
  let queuedCount = 0;

  for (const groupDoc of groupSnap.docs) {
    groupCount += 1;
    const sgId = groupDoc.id;
    const tomorrow = dayjs().tz('Asia/Seoul').add(1, 'day');
    const targetDateStr = tomorrow.format('YYYYMMDD');
    const targetMonth = tomorrow.format('YYYYMM');
    const monthLabel = tomorrow.format('M월 D일');

    const monthStatusRef = groupDoc.ref.collection('month_status').doc(targetMonth);
    const monthStatusSnap = await monthStatusRef.get();
    const monthStatus = monthStatusSnap.exists ? monthStatusSnap.data()?.status : null;
    if (monthStatus !== 'FINAL-CONFIRMED') continue;

    const eventSnap = await groupDoc.ref
      .collection('mass_events')
      .where('event_date', '==', targetDateStr)
      .get();

    if (eventSnap.empty) continue;

    for (const eventDoc of eventSnap.docs) {
      eventCount += 1;
      const eventData = eventDoc.data();
      const memberIds: string[] = Array.isArray(eventData.member_ids) ? eventData.member_ids : [];
      if (memberIds.length === 0) continue;

      const memberSnap = await groupDoc.ref
        .collection('members')
        .where(admin.firestore.FieldPath.documentId(), 'in', memberIds)
        .get();

      const parentUids = new Set<string>();
      memberSnap.forEach((m) => {
        const d = m.data();
        if (d?.parent_uid) parentUids.add(d.parent_uid);
      });

      if (parentUids.size === 0) continue;

      const title = '미사 배정 리마인더';
      const body = `[알림] ${monthLabel} ${eventData.title || '미사'} 복사 배정이 있습니다.`;

      await db.collection(COL_NOTIFICATIONS).add({
        title,
        body,
        click_action: `/server-groups/${sgId}/mass-events`,
        target_uids: Array.from(parentUids),
        app_id: 'ordo-altar',
        feature: 'MASS_REMINDER',
        server_group_id: sgId,
        event_id: eventDoc.id,
        trigger_status: 'scheduled',
        fcm_status: 'pending',
        retry_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      queuedCount += 1;
    }
  }

  return { groups: groupCount, events: eventCount, queued: queuedCount };
}

export const enqueueDailyMassReminder = functions
  .region('asia-northeast3')
  .pubsub.schedule('every day 20:00')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    const result = await enqueueDailyMassReminderCore();
    console.log(
      `[enqueueDailyMassReminder] groups=${result.groups}, events=${result.events}, queued=${result.queued}`
    );
    return null;
  });

