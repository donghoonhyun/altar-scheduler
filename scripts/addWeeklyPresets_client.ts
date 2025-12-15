
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { firebaseConfig } from "../src/config/firebaseConfig";
import { EXTRA_EVENTS } from "./data/massEvents_SG00001_202511";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const TEST_SERVER_GROUP_ID = 'SG00001';

async function addWeeklyPresets() {
  console.log("🔄 Logging in as planner@test.com...");
  try {
    await signInWithEmailAndPassword(auth, "planner@test.com", "123456");
    console.log("✅ Logged in successfully!");
  } catch (error) {
    console.error("❌ Login failed:", error);
    process.exit(1);
  }

  console.log("📌 Preparing weekly presets data from 2025-11-02 to 2025-11-08...");

  const presetWeekdays: Record<string, any[]> = {
    '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': []
  };

  const DATE_DOW_MAP: Record<string, string> = {
    '20251102': '0', // Sun
    '20251103': '1', // Mon
    '20251104': '2', // Tue
    '20251105': '3', // Wed
    '20251106': '4', // Thu
    '20251107': '5', // Fri
    '20251108': '6', // Sat
  };

  let count = 0;
  EXTRA_EVENTS.forEach((e) => {
    const dow = DATE_DOW_MAP[e.event_date];
    if (dow) {
      presetWeekdays[dow].push({
        title: e.title,
        required_servers: e.required_servers,
      });
      count++;
    }
  });

  console.log(`ℹ️ Found ${count} events for the reference week.`);

  try {
    await setDoc(doc(db, 'server_groups', TEST_SERVER_GROUP_ID, 'mass_presets', 'default'), {
      weekdays: presetWeekdays,
      updated_at: serverTimestamp(),
    });
    console.log(`✅ Successfully added 'mass_presets/default' for ${TEST_SERVER_GROUP_ID}`);
  } catch (error) {
    console.error("❌ Failed to write to Firestore:", error);
    process.exit(1);
  }

  console.log("🎉 Done!");
  process.exit(0);
}

addWeeklyPresets();
