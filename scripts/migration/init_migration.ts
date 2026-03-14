/**
 * init_migration.ts
 * Source: altar-scheduler-dev (구 프로젝트)
 * Target: ordo-eb11a (현재 Ordo 프로젝트)
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Service Account 경로
const SOURCE_SA_PATH = path.resolve(__dirname, '../service-account.json');         // altar-scheduler-dev
const TARGET_SA_PATH = path.resolve(__dirname, '../../../Ordo/service-account.json'); // ordo-eb11a

function loadServiceAccount(filePath: string, label: string) {
  try {
    const content = JSON.parse(readFileSync(filePath, 'utf-8'));
    console.log(`✅ [${label}] Service Account 로드 완료 (project: ${content.project_id})`);
    return content;
  } catch (e) {
    console.error(`❌ [${label}] Service Account 로드 실패: ${filePath}`);
    throw e;
  }
}

const sourceServiceAccount = loadServiceAccount(SOURCE_SA_PATH, 'Source(altar-scheduler-dev)');
const targetServiceAccount = loadServiceAccount(TARGET_SA_PATH, 'Target(ordo-eb11a)');

// Firebase App 초기화 (이미 초기화된 경우 재사용)
function getOrInitApp(name: string, credential: admin.credential.Credential) {
  try {
    return admin.app(name);
  } catch {
    return admin.initializeApp({ credential }, name);
  }
}

const sourceApp = getOrInitApp('sourceApp', admin.credential.cert(sourceServiceAccount));
const targetApp = getOrInitApp('targetApp', admin.credential.cert(targetServiceAccount));

export const sourceDB = sourceApp.firestore();
export const targetDB = targetApp.firestore();
export const sourceAuth = sourceApp.auth();
export const targetAuth = targetApp.auth();
