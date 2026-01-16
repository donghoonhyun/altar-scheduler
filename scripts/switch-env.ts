/**
 * scripts/switch-env.ts
 * ----------------------------------------------------
 * CLI 예시:
 *   npx tsx scripts/switch-env.ts local
 *   npx tsx scripts/switch-env.ts dev
 *   npx tsx scripts/switch-env.ts prod
 *
 *   npm run env:local  (.env.local → .env 덮어씀)
 *   npm run env:dev    (.env.development → .env 덮어씀)
 *
 * 설명:
 *   지정한 모드에 따라 .env 파일을 자동으로 덮어씁니다.
 *   (ex) .env.local → .env
 * ----------------------------------------------------
 */
import fs from 'fs';
import path from 'path';

const mode = process.argv[2];
const validModes = ['local', 'dev', 'prod'];
if (!mode || !validModes.includes(mode)) {
  console.error(`❌ 잘못된 모드입니다. 사용법: npm run env:<local|dev|prod>`);
  process.exit(1);
}

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const targetFile = path.join(rootDir, `.env`);
const sourceFile = path.join(rootDir, `.env.${mode === 'dev' ? 'development' : mode}`);

if (!fs.existsSync(sourceFile)) {
  console.error(`❌ ${sourceFile} 파일이 없습니다.`);
  process.exit(1);
}

// 덮어쓰기 수행
fs.copyFileSync(sourceFile, targetFile);
console.log(`✅ ${path.basename(sourceFile)} → .env 로 전환 완료!`);
