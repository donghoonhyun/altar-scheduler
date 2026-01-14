/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { sendSolapiMessage } from '../services/solapi';
import { CallableContext } from 'firebase-functions/v1/https';

export const sendSms = functions
  .region('asia-northeast3')
  .runWith({ enforceAppCheck: false }) // Disable AppCheck for testing if needed
  .https.onCall(async (data: any, context: CallableContext) => {
    // 1. Authentication Check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated', 
        'The function must be called while authenticated.'
      );
    }

    // 2. Validate Data
    const { receiver, msg } = data;
    if (!receiver || !msg) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        'The function must be called with one argument "receiver" and "msg" containing the message text.'
      );
    }

    // 3. Send Message via Solapi
    let result: any;
    try {
      result = await sendSolapiMessage(receiver, msg);

      // Log Success
      await admin.firestore().collection('sms_logs').add({
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        sender_uid: context.auth.uid,
        sender_email: context.auth.token.email || null,
        receiver,
        message: msg,
        status: 'success',
        result,
        group_id: result?.groupInfo?._id || null,
        parish_code: data.parish_code || data.parish_id || null, // Updated to use parish_code
        server_group_id: data.server_group_id || null,
      });

      return {
        success: true,
        data: result
      };

    } catch (error: any) {
      console.error('sendSms Error:', error);

      // Log Failure
      try {
        await admin.firestore().collection('sms_logs').add({
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          sender_uid: context.auth.uid,
          sender_email: context.auth.token.email || null,
          receiver,
          message: msg,
          status: 'failed',
          error: error.message || JSON.stringify(error),
          parish_code: data.parish_code || data.parish_id || null, // Updated to use parish_code
          server_group_id: data.server_group_id || null,
        });
      } catch (logError) {
        console.error('Failed to log SMS error:', logError);
      }

      // If it's already an HttpsError, re-throw it
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      // Otherwise make it internal
      throw new functions.https.HttpsError('internal', error.message || 'Unknown internal error');
    }
  });
