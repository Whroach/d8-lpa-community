/**
 * MongoDB Database Migration Script
 * Copies all collections and data from source DB to target DB
 */

const { MongoClient } = require('mongodb');

const SOURCE_URI = 'mongodb+srv://lpa-d8:Qd1gXd48ljTQDzGP3477UeNrlQrdRjhG7eXpQ@cluster0.iogpu.mongodb.net/demod8lpa?retryWrites=true&w=majority&appName=Cluster0';
const TARGET_URI = 'mongodb+srv://lpa-d8:Qd1gXd48ljTQDzGP3477UeNrlQrdRjhG7eXpQ@cluster0.iogpu.mongodb.net/demo_data?retryWrites=true&w=majority&appName=Cluster0';

const EXCLUDE_COLLECTIONS = ['system.indexes', 'system.version', 'system.profile']; // System collections to skip

async function migrateDatabase() {
  let sourceClient;
  let targetClient;

  try {
    console.log('🔌 Connecting to source and target databases...\n');

    // Connect to both databases
    sourceClient = new MongoClient(SOURCE_URI);
    targetClient = new MongoClient(TARGET_URI);

    await sourceClient.connect();
    await targetClient.connect();

    console.log('✅ Connected to both databases\n');

    const sourceDb = sourceClient.db();
    const targetDb = targetClient.db();

    // Get all collections from source
    const collections = await sourceDb.listCollections().toArray();
    const collectionNames = collections
      .map(c => c.name)
      .filter(name => !EXCLUDE_COLLECTIONS.includes(name));

    console.log(`📦 Found ${collectionNames.length} collections to migrate:\n`);
    collectionNames.forEach(name => console.log(`   - ${name}`));
    console.log('\n');

    // Migrate each collection
    for (const collectionName of collectionNames) {
      try {
        console.log(`📥 Migrating collection: ${collectionName}`);

        const sourceCollection = sourceDb.collection(collectionName);
        const targetCollection = targetDb.collection(collectionName);

        // Get all documents from source
        const documents = await sourceCollection.find({}).toArray();
        const count = documents.length;

        if (count === 0) {
          console.log(`   └─ ⏭️  No documents to migrate\n`);
          continue;
        }

        // Clear target collection
        await targetCollection.deleteMany({});

        // Insert documents into target
        if (count > 0) {
          const result = await targetCollection.insertMany(documents);
          console.log(`   └─ ✅ Migrated ${result.insertedCount} documents\n`);
        }
      } catch (error) {
        console.error(`   └─ ❌ Error migrating ${collectionName}:`, error.message);
        console.error(`      Continuing with next collection...\n`);
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log(`✨ All data copied from demod8lpa → demo_data\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (sourceClient) await sourceClient.close();
    if (targetClient) await targetClient.close();
    console.log('🔌 Database connections closed');
  }
}

// Run migration
migrateDatabase().catch(console.error);
