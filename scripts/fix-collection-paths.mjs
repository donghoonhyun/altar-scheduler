import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const files = glob.sync('src/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**'],
    absolute: true
});

const COLLECTION_KEYS = [
    'SERVER_GROUPS',
    'MEMBERSHIPS',
    'COUNTERS',
    'NOTIFICATIONS',
    'SETTINGS',
    'SMS_LOGS'
];

const COLLECTION_MAP = {
    'server_groups': 'SERVER_GROUPS',
    'memberships': 'MEMBERSHIPS',
    'counters': 'COUNTERS',
    'notifications': 'NOTIFICATIONS',
    'settings': 'SETTINGS',
    'sms_logs': 'SMS_LOGS'
};

let totalReplacements = 0;

files.forEach(file => {
    let content = readFileSync(file, 'utf-8');
    const original = content;

    // 1. Handle template literals and simple strings
    Object.entries(COLLECTION_MAP).forEach(([oldPath, key]) => {
        // Replace `oldPath/` with `${COLLECTIONS.KEY}/`
        const templateRegex = new RegExp('(`)\'?' + oldPath + '/', 'g');
        content = content.replace(templateRegex, '`\${COLLECTIONS.' + key + '}/');

        // Replace 'oldPath', or "oldPath", (as function arguments)
        // Match: ('oldPath', or ("oldPath", or ('oldPath')
        const argRegex = new RegExp('([\'"])' + oldPath + '\\1(\\s*[\\),\\}])', 'g');
        content = content.replace(argRegex, 'COLLECTIONS.' + key + '$2');
    });

    if (content !== original) {
        // Add import if missing
        const hasCollectionsImport = content.includes("from '@/lib/collections'");
        const needsCollectionsImport = /COLLECTIONS\.[A-Z_]+/.test(content);

        if (needsCollectionsImport && !hasCollectionsImport) {
            const lines = content.split('\n');
            let lastImportIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith('import ')) {
                    lastImportIndex = i;
                }
            }
            if (lastImportIndex >= 0) {
                lines.splice(lastImportIndex + 1, 0, "import { COLLECTIONS } from '@/lib/collections';");
                content = lines.join('\n');
            } else {
                // If no imports found, put it at the top (unlikely for TSX)
                content = "import { COLLECTIONS } from '@/lib/collections';\n" + content;
            }
        }

        writeFileSync(file, content, 'utf-8');
        console.log(`✅ Fixed: ${file}`);
        totalReplacements++;
    }
});

console.log(`\n🎉 Total files fixed: ${totalReplacements}`);
