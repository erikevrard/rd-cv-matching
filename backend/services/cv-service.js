// Backend services/cv-service.js - CV management business logic
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const aiService = require('./ai-service');

class CVService {
    constructor() {
        this.cvsDataPath = path.join(__dirname, '../data/cvs');
    }

    getUserCVsFilePath(userId) {
        return path.join(this.cvsDataPath, `${userId}_cvs.json`);
    }

    async createCVRecord({ userId, originalName, filename, filePath, fileSize, fileType }) {
        const cvId = uuidv4();
        const now = new Date().toISOString();

        const cvRecord = {
            id: cvId,
            userId,
            filename: originalName,
            storedFilename: filename,
            filePath,
            fileSize,
            fileType,
            status: 'uploaded',
            uploadedAt: now,
            processedAt: null,
            processingAttempts: 0,
            extractionData: null,
            errorMessage: null,
            confidence: null
        };

        // Save to user's CV file
        await this.saveCVRecord(userId, cvRecord);
        
        return cvRecord;
    }

    async saveCVRecord(userId, cvRecord) {
        const filePath = this.getUserCVsFilePath(userId);
        let cvs = [];

        try {
            const data = await fs.readFile(filePath, 'utf8');
            cvs = JSON.parse(data);
        } catch {
            // File doesn't exist, start with empty array
        }

        // Update existing or add new
        const existingIndex = cvs.findIndex(cv => cv.id === cvRecord.id);
        if (existingIndex >= 0) {
            cvs[existingIndex] = cvRecord;
        } else {
            cvs.unshift(cvRecord); // Add to beginning
        }

        await fs.writeFile(filePath, JSON.stringify(cvs, null, 2));
    }

    async getUserCVs(userId, options = {}) {
        try {
            const filePath = this.getUserCVsFilePath(userId);
            const data = await fs.readFile(filePath, 'utf8');
            let cvs = JSON.parse(data);

            // Filter by status if specified
            if (options.status) {
                cvs = cvs.filter(cv => cv.status === options.status);
            }

            // Apply pagination
            const offset = options.offset || 0;
            const limit = options.limit || cvs.length;
            const paginatedCVs = cvs.slice(offset, offset + limit);

            // Generate summary
            const summary = {
                total: cvs.length,
                uploaded: cvs.filter(cv => cv.status === 'uploaded').length,
                processing: cvs.filter(cv => cv.status === 'processing').length,
                parsed: cvs.filter(cv => cv.status === 'parsed').length,
                failed: cvs.filter(cv => cv.status === 'failed').length
            };

            return {
                cvs: paginatedCVs,
                summary,
                pagination: {
                    total: cvs.length,
                    offset,
                    limit,
                    hasMore: (offset + limit) < cvs.length
                }
            };

        } catch {
            // No CVs file exists yet
            return {
                cvs: [],
                summary: {
                    total: 0,
                    uploaded: 0,
                    processing: 0,
                    parsed: 0,
                    failed: 0
                },
                pagination: {
                    total: 0,
                    offset: 0,
                    limit: 0,
                    hasMore: false
                }
            };
        }
    }

    async getCVById(cvId, userId) {
        try {
            const filePath = this.getUserCVsFilePath(userId);
            const data = await fs.readFile(filePath, 'utf8');
            const cvs = JSON.parse(data);
            
            return cvs.find(cv => cv.id === cvId) || null;
        } catch {
            return null;
        }
    }

    async queueForProcessing(cvId, userId) {
        try {
            const cv = await this.getCVById(cvId, userId);
            if (!cv) return false;

            // Check if AI processing is enabled for this user
            const settingsPath = path.join(__dirname, '../data/settings', `${userId}.json`);
            let aiEnabled = false;
            
            try {
                const settingsData = await fs.readFile(settingsPath, 'utf8');
                const settings = JSON.parse(settingsData);
                aiEnabled = settings.aiProvider?.enabled || false;
            } catch {
                // Settings don't exist or AI not enabled
            }

            if (aiEnabled) {
                // Start processing asynchronously
                this.processCV(cvId, userId).catch(error => {
                    console.error(`CV processing failed for ${cvId}:`, error);
                });
            }

            return true;
        } catch (error) {
            console.error('Queue for processing error:', error);
            return false;
        }
    }

    async processCV(cvId, userId) {
        try {
            const cv = await this.getCVById(cvId, userId);
            if (!cv) throw new Error('CV not found');

            // Update status to processing
            cv.status = 'processing';
            cv.processingAttempts += 1;
            await this.saveCVRecord(userId, cv);

            // Extract text from file
            const extractedText = await this.extractTextFromFile(cv.filePath, cv.fileType);
            
            // Process with AI
            const aiResult = await aiService.processCVText(extractedText, userId);
            
            if (aiResult.success) {
                cv.status = 'parsed';
                cv.processedAt = new Date().toISOString();
                cv.extractionData = aiResult.data;
                cv.confidence = aiResult.data.confidence;
                cv.errorMessage = null;
            } else {
                cv.status = 'failed';
                cv.errorMessage = aiResult.error;
                cv.extractionData = null;
            }

            await this.saveCVRecord(userId, cv);
            return cv;

        } catch (error) {
            // Update CV with error status
            try {
                const cv = await this.getCVById(cvId, userId);
                if (cv) {
                    cv.status = 'failed';
                    cv.errorMessage = error.message;
                    await this.saveCVRecord(userId, cv);
                }
            } catch (saveError) {
                console.error('Error saving failed CV status:', saveError);
            }
            
            throw error;
        }
    }

    async extractTextFromFile(filePath, fileType) {
        try {
            if (fileType === 'txt') {
                return await fs.readFile(filePath, 'utf8');
            }
            
            // For PDF and DOCX, return placeholder text for now
            // In production, you'd use libraries like pdf-parse or mammoth
            const placeholder = `[${fileType.toUpperCase()} CONTENT PLACEHOLDER]
            
This is a placeholder for ${fileType} content extraction.
In production, implement proper text extraction using:
- pdf-parse for PDF files
- mammoth for DOCX files
- textract for DOC files

File path: ${filePath}
File type: ${fileType}

Sample CV content for testing:
Name: John Doe
Email: john.doe@example.com
Phone: +1-555-0123
Address: 123 Main St, City, State 12345

Experience:
- Software Developer at TechCorp (2020-2023)
- Junior Developer at StartupXYZ (2018-2020)

Skills: JavaScript, Python, React, Node.js`;

            return placeholder;
            
        } catch (error) {
            throw new Error(`Failed to extract text from ${fileType} file: ${error.message}`);
        }
    }

    async processAllPendingCVs(userId) {
        try {
            const { cvs } = await this.getUserCVs(userId);
            const pendingCVs = cvs.filter(cv => cv.status === 'uploaded');
            
            let queued = 0;
            
            for (const cv of pendingCVs) {
                try {
                    await this.queueForProcessing(cv.id, userId);
                    queued++;
                } catch (error) {
                    console.error(`Failed to queue CV ${cv.id}:`, error);
                }
            }

            return {
                queued,
                alreadyProcessed: cvs.length - pendingCVs.length
            };

        } catch (error) {
            console.error('Process all pending CVs error:', error);
            throw error;
        }
    }

    async reprocessCV(cvId, userId) {
        try {
            const cv = await this.getCVById(cvId, userId);
            if (!cv) {
                return { success: false, error: 'CV not found' };
            }

            // Reset CV status
            cv.status = 'uploaded';
            cv.processedAt = null;
            cv.extractionData = null;
            cv.errorMessage = null;
            cv.confidence = null;
            
            await this.saveCVRecord(userId, cv);
            await this.queueForProcessing(cvId, userId);

            return { success: true };

        } catch (error) {
            console.error('Reprocess CV error:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteCV(cvId, userId) {
        try {
            const filePath = this.getUserCVsFilePath(userId);
            const data = await fs.readFile(filePath, 'utf8');
            const cvs = JSON.parse(data);
            
            const cvIndex = cvs.findIndex(cv => cv.id === cvId);
            if (cvIndex === -1) {
                return { success: false, error: 'CV not found' };
            }

            const cv = cvs[cvIndex];
            
            // Delete physical file
            try {
                await fs.unlink(cv.filePath);
            } catch (error) {
                console.error('Warning: Could not delete physical file:', error);
                // Continue with deletion from database
            }

            // Remove from array
            cvs.splice(cvIndex, 1);
            
            // Save updated array
            await fs.writeFile(filePath, JSON.stringify(cvs, null, 2));

            return { success: true };

        } catch (error) {
            console.error('Delete CV error:', error);
            return { success: false, error: error.message };
        }
    }

    async getUserStorageStats(userId) {
        try {
            const { cvs } = await this.getUserCVs(userId);
            
            const totalSize = cvs.reduce((sum, cv) => sum + (cv.fileSize || 0), 0);
            const totalFiles = cvs.length;
            
            const byFileType = cvs.reduce((acc, cv) => {
                acc[cv.fileType] = (acc[cv.fileType] || 0) + 1;
                return acc;
            }, {});

            const byStatus = cvs.reduce((acc, cv) => {
                acc[cv.status] = (acc[cv.status] || 0) + 1;
                return acc;
            }, {});

            return {
                totalSize,
                totalFiles,
                byFileType,
                byStatus,
                averageFileSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0
            };

        } catch (error) {
            console.error('Get storage stats error:', error);
            return {
                totalSize: 0,
                totalFiles: 0,
                byFileType: {},
                byStatus: {},
                averageFileSize: 0
            };
        }
    }
}

module.exports = new CVService();