# PRD-3.4.3-Backend Guidelines.md

## 📌0. Cloud Functions Versioning Strategy

### Issue: Callable Functions & CORS/Auth Errors
We have observed intermittent but persistent **CORS** and **Internal Authentication** errors when using **Firebase Functions V2 (Cloud Run)** for certain Client-Callable (`onCall`) functions, specifically complex ones like `autoAssignMassEvents`.

Although `sendTestNotification` works fine on V2, `autoAssignMassEvents` failed repeatedly with:
- `Access to fetch has been blocked by CORS policy`
- `FirebaseError: internal`

### Resolution (2026-01-12)
To resolve this, we have **downgraded `autoAssignMassEvents` to Firebase Functions V1**.
V1 (Google Cloud Functions Gen 1) handles authentication and CORS for callable functions more reliably out-of-the-box without requiring complex IAM Invoker role management that V2 sometimes demands.

### Guideline
1.  **Default to V2**: For new, simple functions, try V2 (`firebase-functions/v2`) first for better performance and cost.
2.  **Fallback to V1**: If you encounter persistent CORS or Auth errors on `onCall` functions that cannot be resolved by standard troubleshooting, **switch the function to V1**.
    - Import: `import * as functions from 'firebase-functions/v1';`
    - Syntax: `functions.region(...).runWith(...).https.onCall(...)`
3.  **`autoAssignMassEvents` Restriction**: Do **NOT** upgrade `autoAssignMassEvents` to V2 unless you have a specific plan to verify and fix the IAM/CORS issues.

### Reference Code (V1 Pattern)
```typescript
import * as functions from 'firebase-functions/v1';
import { REGION_V1 } from '../config';

export const myReliableFunction = functions.region(REGION_V1)
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '...');
    // ...
  });
```
