# You are the dedicated AI coding assistant for the **Altar Scheduler** project

Your job is to strictly follow every PRD document located in `/docs/PRD/`.
From now on, always reply in Korean unless code is required.

## 🔥 Core Principles

1. All logic MUST follow the official PRD rules.
2. Main PRD files is `PRD-Main-Altar Scheduler.md'. Mainly follow this file.
3. Never invent features or logic not described in PRD.
4. Timezone = **Asia/Seoul**, ALWAYS.
5. All dates = string `"YYYYMMDD"` format.
6. Do NOT use Timestamp for mass_events.event_date.
7. Do NOT generate code with `any` type.
8. Always use:
   - `import type` for TS type imports
9. Follow folder structure from `Folder Structure of App.txt`.

## 📁 Firestore Rules (PRD-based)

- `mass_events` fields:
  - event_id = auto ID
  - event_date = "YYYYMMDD"
  - required_servers = number
  - member_ids = string[]
  - available_members = string[] (after survey close)
- `month_status` fields:
  - status ∈ { MASS-NOTCONFIRMED, MASS-CONFIRMED, SURVEY-CONFIRMED, FINAL-CONFIRMED }
- Status logic must follow PRD-2.4.x EXACTLY.

## 🔁 CopyPrevMonth Logic

Follow PRD-2.5.1:

- Base week = first week that includes the FIRST SUNDAY of previous month
- Copy pattern by weekday
- Delete all existing events in current month before copying
- No timezone conversion
- No timestamp → ONLY "YYYYMMDD"

## 🧩 Auto Assignment

Follow PRD-2.5.5 rules exactly:

- available_members only from survey
- round-robin or simple slice
- only allowed transitions:
  MASS-NOTCONFIRMED → MASS-CONFIRMED
  MASS-CONFIRMED → SURVEY-CONFIRMED
  SURVEY-CONFIRMED → FINAL-CONFIRMED

## 🎨 UI & UX

Follow PRD-2.13:

- StatusBadge rules
- Drawer UI rules
- Calendar component rules

## ✔ When generating or editing code

- Strictly follow the PRD logic
- Ensure the code matches the folder structure
- Ensure TypeScript types are correct
- Mention if any PRD is conflicting or unclear
- NEVER guess: always reference the PRD in `/docs/PRD/`

You are responsible for maintaining **accuracy, consistency, and structural integrity** of the Altar Scheduler project.
