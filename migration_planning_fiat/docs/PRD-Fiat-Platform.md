# PRD: Fiat Platform (Catholic Super App)

## 1. Project Overview
**Fiat** is a Catholic Super App Platform designed to unify various Catholic services (apps) under a single ecosystem. It provides a centralized dashboard, unified authentication (SSO), and a marketplace-like experience for installing and accessing independent modules (Apps) like Altar Scheduler, Bible Study, etc.

## 2. Architecture: Single Project, Multi-Tenant Logic
We utilize a **Single Firebase Project** strategy with strict separation of concerns via **Multi-Site Hosting** and **Multi-DB Firestore**.

### 2.1 Core Components
1.  **Root App (Fiat Platform)**
    *   **Role**: Identity Provider, App Launcher, User Profile Management.
    *   **Hosting**: Main Domain (e.g., `fiat.web.app` or custom domain).
    *   **Database**: `(default)` Firestore Database.
    *   **Data Scope**: Global Users, App Registry, Platform Settings.

2.  **Sub Apps (Altar Scheduler, Bible Study, etc.)**
    *   **Role**: Specialized functionality modules.
    *   **Hosting**: Subdomains (e.g., `altar.fiat.web.app`).
    *   **Database**: Named Firestore Database (e.g., `altar-scheduler-db`).
    *   **Data Scope**: App-specific business logic and data.
    *   **Permission**: Read-Only access to Root User Profile; Read-Write access to own DB.

## 3. Data Strategy

### 3.1 Authentication (Shared)
*   **Provider**: Firebase Authentication (Project Level).
*   **Mechanism**:
    *   Users log in once at the Root App (Fiat).
    *   Session cookies or Tokens are shared/accessible across subdomains (if configured correctly) or SSO is handled via redirect/token exchange.
    *   *Note: Firebase Auth persists on the domain level. Subdomains (`app.domain.com`) can share auth state with the root (`domain.com`) if configured properly, primarily via `onAuthStateChanged` and cookie policies.*

### 3.2 Database Separation (Multi-DB)
*   **Root DB (`(default)`)**:
    *   `users/{uid}`: core user profile (name, email, avatar, grade, global_settings). **[Source of Truth]**
    *   `installed_apps/{uid}`: list of apps the user has "installed" or enabled.
*   **App DB (`altar-scheduler-db`)**:
    *   `server_groups/...`
    *   `mass_events/...`
    *   `app_users/{uid}`: App-specific user settings (e.g., specific alarm settings for this app, roles within this app).

### 3.3 Data Access Rules
*   **Root App**:
    *   Read/Write: `(default)` DB.
    *   No access to App DBs (unless administrative tools are needed).
*   **Sub Apps**:
    *   Read-Only: `(default)` DB (via SDK or restrictive Security Rules). *Sub-apps need to read user profiles.*
    *   Read/Write: Own Named DB (e.g., `altar-scheduler-db`).

## 4. Technology Stack
*   **Frontend**: React + Vite + TypeScript.
*   **Styling**: Tailwind CSS + ShadCN UI (Consistent Design System across all apps).
*   **State Management**: Zustand or Recoil (Isolated per app).
*   **Backend**: Firebase (Auth, Hosting, Firestore, Functions).

## 5. Migration Strategy (Altar Scheduler)
1.  **Refactor**: Modify `firebase.ts` to accept a database ID argument.
2.  **Data Move**: Export data from the old `(default)` DB of the dev project -> Import to `altar-scheduler-db` of the Fiat project.
3.  **Auth Migration**: Export users from old project -> Import to Fiat project.
4.  **Hosting**: Deploy existing Altar Scheduler build to the new `altar` site target.

## 6. Development Phases
1.  **Phase 1: Fiat Skeleton**: Setup project, Multi-DB structure, and basic Auth/Dashboard.
2.  **Phase 2: App Integration**: Migrate Altar Scheduler as the first "Pilot App".
3.  **Phase 3: Expansion**: Add new apps (Bible Study, etc.).

## 7. Lessons Learned (from Altar Scheduler Dev)
*   **Hardcoding**: Avoid hardcoding document IDs (like `SG00001`) or API Keys. Use Environment Variables and logical lookups.
*   **Type Safety**: define specific types for Firestore documents early.
*   **Notification Logs**: Centralize logs (`system_notification_logs`) for better administration.
*   **UI/UX**: "Premium" feel is mandatory. Use Glassmorphism, smooth transitions, and polished components.
