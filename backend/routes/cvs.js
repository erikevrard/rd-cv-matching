// Backend routes/cvs.js - CV management endpoints
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const cvService = require('../services/cv-service');
const aiService = require('../services/ai-service');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const fileType = path.extname(file.originalname).toLowerCase().substring(1);
        const uploadDir = path.join(__dirname, '../data/uploads', fileType);
        
        try {
            await fs.access(uploadDir);
        } catch {
            await fs.mkdir(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueId}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${ext} not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
        }
    }
});

// POST /api/cvs/upload - Upload CV files
router.post('/upload', upload.array('cvs', 10), async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        const uploadResults = [];
        
        for (const file of req.files) {
            try {
                const cvData = await cvService.createCVRecord({
                    userId,
                    originalName: file.originalname,
                    filename: file.filename,
                    filePath: file.path,
                    fileSize: file.size,
                    fileType: path.extname(file.originalname).toLowerCase().substring(1)
                });
                
                uploadResults.push(cvData);
                
                // Queue for AI processing if enabled
                await cvService.queueForProcessing(cvData.id, userId);
                
            } catch (error) {
                console.error(`Error processing file ${file.originalname}:`, error);
                // Continue with other files
            }
        }

        res.json({
            success: true,
            data: {
                uploaded: uploadResults.length,
                cvs: uploadResults
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload CVs'
        });
    }
});

// GET /api/cvs/:userId - Get user's CVs
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, limit, offset } = req.query;
        
        const result = await cvService.getUserCVs(userId, {
            status,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined
        });

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Get CVs error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve CVs'
        });
    }
});

// GET /api/cvs/detail/:cvId - Get specific CV details
router.get('/detail/:cvId', async (req, res) => {
    try {
        const { cvId } = req.params;
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const cv = await cvService.getCVById(cvId, userId);
        
        if (!cv) {
            return res.status(404).json({
                success: false,
                error: 'CV not found'
            });
        }

        res.json({
            success: true,
            data: cv
        });

    } catch (error) {
        console.error('Get CV details error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve CV details'
        });
    }
});

// POST /api/cvs/process-all - Process all pending CVs
router.post('/process-all', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const result = await cvService.processAllPendingCVs(userId);

        res.json({
            success: true,
            data: {
                message: `Started processing ${result.queued} CVs`,
                queued: result.queued,
                alreadyProcessed: result.alreadyProcessed
            }
        });

    } catch (error) {
        console.error('Process all CVs error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start processing'
        });
    }
});

// POST /api/cvs/:cvId/reprocess - Reprocess a specific CV
router.post('/:cvId/reprocess', async (req, res) => {
    try {
        const { cvId } = req.params;
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const result = await cvService.reprocessCV(cvId, userId);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            data: {
                message: 'CV reprocessing started',
                cvId: cvId
            }
        });

    } catch (error) {
        console.error('Reprocess CV error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reprocess CV'
        });
    }
});

// DELETE /api/cvs/:cvId - Delete a CV
router.delete('/:cvId', async (req, res) => {
    try {
        const { cvId } = req.params;
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const result = await cvService.deleteCV(cvId, userId);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            data: {
                message: 'CV deleted successfully',
                cvId: cvId
            }
        });

    } catch (error) {
        console.error('Delete CV error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete CV'
        });
    }
});

// GET /api/cvs/download/:cvId - Download original CV file
router.get('/download/:cvId', async (req, res) => {
    try {
        const { cvId } = req.params;
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const cv = await cvService.getCVById(cvId, userId);
        
        if (!cv) {
            return res.status(404).json({
                success: false,
                error: 'CV not found'
            });
        }

        const filePath = path.resolve(cv.filePath);
        
        try {
            await fs.access(filePath);
            res.download(filePath, cv.filename);
        } catch {
            res.status(404).json({
                success: false,
                error: 'File not found on disk'
            });
        }

    } catch (error) {
        console.error('Download CV error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download CV'
        });
    }
});

// Error handler for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 10MB.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Too many files. Maximum is 10 files per upload.'
            });
        }
    }
    
    if (error.message.includes('File type') && error.message.includes('not allowed')) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
    
    next(error);
});

module.exports = router;