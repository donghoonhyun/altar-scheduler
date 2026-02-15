# Architecture Strategy: Fiat Platform & Multi-DB Implementation

## 1. Firebase Configuration Strategy

To support the "Root + Multi-App" structure, our Firebase initialization logic needs to be smarter. We cannot just use `getFirestore(app)`.

### 1.1 Multi-DB Initialization Helper
We will create a centralized `firebase.ts` (or `lib/firebase/index.ts`) in the Root App that exports connection factories.

```typescript
// src/lib/firebase/index.ts (Conceptual)
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  // ... Standard Config
};

// Singleton App Instance
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// default DB (Root Platform Data)
export const dbRoot = getFirestore(app); // uses (default)

// Factory for App DBs
const dbInstances: Record<string, Firestore> = {};

export const getAppDB = (dbName: string): Firestore => {
  if (!dbInstances[dbName]) {
    // ⚠️ IMPORTANT: Second argument is the Database ID
    dbInstances[dbName] = getFirestore(app, dbName);
  }
  return dbInstances[dbName];
};
```

### 1.2 Usage in Sub-Apps
When migrating **Altar Scheduler**, we will replace all `db` imports:

**Before:**
```typescript
import { db } from '@/lib/firebase';
// ...
const snap = await getDoc(doc(db, 'users', uid));
```

**After:**
```typescript
import { getAppDB } from '@/lib/firebase'; // Or a local wrapper
const db = getAppDB('altar-scheduler-db');

// ...
const snap = await getDoc(doc(db, 'server_groups', id));
```

*Note: For accessing shared User Profiles from the Sub-App, it will still need to import `dbRoot` or use a specific service that queries the root DB.*

## 2. Shared Authentication (SSO)

Since we are using subdomains (different sites on the same project), Firebase Auth state persistence defaults to `localStorage` (indexedDB) which **does not** share across subdomains automatically in many browsers due to partitioning.

**Solution: `firebase.auth().useDeviceLanguage();` isn't enough.**

We need to ensure **Cookie-based Session Management** or **Token Passing** if we strictly separate domains.
HOWEVER, if we are just "logically" separating apps via Routes (Single Page App, distinct paths) but same Domain, Auth is automatic.

**Scenario A: Distinct Subdomains (`altar.fiat.web.app`)**
- Users might need to re-login if local storage isn't shared.
- Strategy: Use a **Custom Domain** (`fiat.com` and `altar.fiat.com`) and configure Cookies? Or simpler:
- **Simple Start:** Just use paths! 
  - `fiat.web.app/` -> Root Dashboard
  - `fiat.web.app/apps/altar` -> Altar Scheduler
  - `fiat.web.app/apps/bible` -> Bible App
  - -> **This solves ALL Auth sharing issues instantly.**
  - -> **Hosting:** We can still Multi-Site deploy to subdomains if we really want, but Path-based routing is easier for the "Super App" feel.
  
  **Re-evaluating User Request:** User asked for "Hosting separation".
  If we stick to `altar.fiat.web.app`, we rely on Firebase Auth's ability to share sessions.
  *Actually, Firebase Auth shares state across subdomains of the same top-level domain if using cookies, but default SDK uses IndexedDB.*
  
  **Recommended Decision:** 
  Initially, use **Path-based separation** (`/apps/altar`) on the MAIN hosting site for the smoothest "Super App" SSO experience.
  Later, if an app grows huge, extract it to a subdomain and handle the auth bridge.
  
  **Alternative:** The user specifically asked for "Hosting separated by app".
  If so, when launch `altar.fiat.web.app`, the user might see "Not Logged In".
  We will need to implement a redirect flow:
  1. User goes to `altar...`.
  2. If no user, redirect to `auth.fiat...` (Root).
  3. Login at Root.
  4. Redirect back with Token? No, Firebase handles this with `signInWithRedirect` usually, but across domains it's tricky.
  
  **Verdict for Phase 1:** Strong recommendation to strictly stick to **Single Domain, Multi-Path** (`yoursite.com/apps/altar`) first. It mimics the "Platform" feel perfectly (like Notion workspace) and removes Auth headaches. We can still use Multi-DB.

## 3. Directory Structure (Monorepo-ish)

```text
/fiat-project
  /src
    /apps
      /altar-scheduler  <-- Moved here
      /bible-study
    /components
      /ui               <-- Shared ShadCN UI
    /lib
      /firebase         <-- Shared Config
    /pages              <-- Root Dashboard Pages
```

## 5. Emulator & Dev Environment Setup

To fully replicate the production environment locally, the **Firebase Emulator Suite** must be configured to support our Single Project / Multi-DB structure.

### 5.1 `firebase.json` Configuration
When moving to `fiat`, the `hosting` section in `firebase.json` will change from a single object to an array to support Multi-Site Hosting.

**Example for Fiat (future state):**
```json
{
  "hosting": [
    {
      "target": "fiat-platform",
      "public": "dist", // or dist/platform
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [ { "source": "**", "destination": "/index.html" } ]
    },
    {
      "target": "altar-scheduler",
      "public": "dist", // or dist/apps/altar if built separately
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [ { "source": "**", "destination": "/index.html" } ]
    }
  ],
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true }
  }
}
```

### 5.2 Accessing Multi-DB in Emulator
The Firestore Emulator automatically supports multiple databases. You do **not** need specialized startup flags.
However, you must ensure your client code connects to the named DB.

- **Standard DB**: `http://localhost:8080/emulator/v1/projects/fiat-project/databases/(default)/documents`
- **Altar DB**: `http://localhost:8080/emulator/v1/projects/fiat-project/databases/altar-scheduler-db/documents`

**Authentication in Emulator:**
The Auth Emulator (`localhost:9099`) is shared across all "sites" running on `localhost`.

### 5.3 Migration Checklist
The following files have been backed up to `migration_planning_fiat/resources/` for reference:
- `firebase.json` (Base ports and settings)
- `firestore.rules` & `firestore.indexes.json` (Critical for DB logic)
- `storage.rules`
- `functions/package.json`, `tsconfig.json`, `.eslintrc.js` (Backend environment)

Use these to quickly bootstrap the `fiat` local environment via `firebase init`.
```
