// backend/scripts/migrate-cv-storage.js
const fs = require('fs').promises;
const path = require('path');

async function migrateUserCVs(userId) {
    console.log(`\n=== Migrating CVs for user: ${userId} ===`);
    
    const oldFile = path.join(__dirname, '../data/cvs', `${userId}_cvs.json`);
    const newDir = path.join(__dirname, '../data/cvs', userId);
    
    try {
        const data = await fs.readFile(oldFile, 'utf8');
        const cvs = JSON.parse(data || '[]');
        
        console.log(`Found ${cvs.length} CVs to migrate`);
        
        // Create user directory
        await fs.mkdir(newDir, { recursive: true });
        
        // Write each CV to individual file
        for (const cv of cvs) {
            const cvFile = path.join(newDir, `${cv.id}.json`);
            await fs.writeFile(cvFile, JSON.stringify(cv, null, 2), 'utf8');
        }
        
        // Create index file
        const index = {
            userId,
            total: cvs.length,
            lastUpdated: new Date().toISOString(),
            cvs: cvs.map(cv => ({
                id: cv.id,
                filename: cv.originalName || cv.filename,
                status: cv.status,
                parsingState: cv.parsingState,
                uploadedAt: cv.uploadedAt,
                processedAt: cv.processedAt,
                candidateName: cv.detailedParsingData?.extractedData?.fullName || 
                              cv.initialParsingData?.extractedData?.candidate_full_name || null,
                profile: cv.detailedParsingData?.extractedData?.profile ||
                        cv.initialParsingData?.extractedData?.candidate_main_profile || null
            }))
        };
        
        const indexFile = path.join(newDir, 'index.json');
        await fs.writeFile(indexFile, JSON.stringify(index, null, 2), 'utf8');
        
        console.log(`✅ Migrated ${cvs.length} CVs`);
        console.log(`✅ Created index file`);
        
        // DELETE old file immediately (we're moving fast)
        await fs.unlink(oldFile);
        console.log(`🗑️  Deleted old monolithic file`);
        
        return { success: true, migrated: cvs.length };
        
    } catch (error) {
        console.error(`❌ Migration failed:`, error);
        throw error;
    }
}

async function migrateAll() {
    console.log('🔄 Starting FAST CV Storage Migration');
    console.log('====================================\n');
    
    const cvsDir = path.join(__dirname, '../data/cvs');
    const files = await fs.readdir(cvsDir);
    
    const userFiles = files.filter(f => f.endsWith('_cvs.json'));
    
    console.log(`Found ${userFiles.length} user(s) to migrate\n`);
    
    let totalMigrated = 0;
    
    for (const file of userFiles) {
        const userId = file.replace('_cvs.json', '');
        const result = await migrateUserCVs(userId);
        totalMigrated += result.migrated;
    }
    
    console.log('\n====================================');
    console.log(`✅ Migration complete! Migrated ${totalMigrated} CVs`);
    console.log('====================================\n');
}

if (require.main === module) {
    migrateAll().catch(console.error);
}

module.exports = { migrateAll };
