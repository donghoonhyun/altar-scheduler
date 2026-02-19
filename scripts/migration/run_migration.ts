import { migrateUsers } from './migrate_users';
import { migrateFirestoreData } from './migrate_firestore';

async function main() {
  console.log('🏁 Starting Full Migration Task...');
  
  try {
    // 1. Migrate Users
    await migrateUsers();
    
    // 2. Migrate Firestore
    await migrateFirestoreData();
    
    console.log('✅ All Migration Tasks Completed Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Failed:', error);
    process.exit(1);
  }
}

main();
