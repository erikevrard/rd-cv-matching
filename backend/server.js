// Backend server.js - Main server file
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;

// Import routes
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const cvsRoutes = require('./routes/cvs');
const tenderSearchRoutes = require("./routes/tender-searches");
const llmRoutes = require('./routes/llms');
const usersRoutes = require('./routes/users');
const taxonomyRoutes = require("./routes/taxonomy");
const promptRoutes = require("./routes/prompts");

// Import services
const fileUtils = require('./utils/file-utils');

class CVManagerServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;
        this.init();
    }

    async init() {
        await this.setupDirectories();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
        this.start();
    }

    async setupDirectories() {
        // Create required directories if they don't exist
        const directories = [
            'data',
            'data/users',
            'data/settings',
            'data/cvs',
            'data/uploads',
            'data/uploads/pdf',
            'data/uploads/docx',
            'data/uploads/txt',
            'data/llms'
        ];

        for (const dir of directories) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        }
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            crossOriginEmbedderPolicy: false,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "blob:"],
                    connectSrc: ["'self'", "https://api.anthropic.com", "https://api.openai.com"]
                }
            }
        }));

        // CORS - Allow frontend to access backend
        this.app.use(cors({
            origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use(limiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        this.app.use(express.static(path.join(__dirname, '../frontend')));

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // API routes
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/settings', settingsRoutes);
        this.app.use('/api/cvs', cvsRoutes);
        this.app.use("/api/tender-searches", tenderSearchRoutes);
        this.app.use('/api/llms', llmRoutes);
        this.app.use('/api/users', usersRoutes);
        this.app.use("/api/taxonomy", taxonomyRoutes);
        this.app.use("/api/prompts", promptRoutes);

        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });

        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../frontend/index.html'));
        });

        // Serve uploaded files (with authentication check)
        this.app.get('/api/files/:userId/:filename', async (req, res) => {
            try {
                const { userId, filename } = req.params;
                // TODO: Add authentication check here

                const filePath = path.join(__dirname, 'data/uploads', filename);
                const stats = await fs.stat(filePath);

                if (stats.isFile()) {
                    res.sendFile(path.resolve(filePath));
                } else {
                    res.status(404).json({ error: 'File not found' });
                }
            } catch (error) {
                console.error('File serving error:', error);
                res.status(500).json({ error: 'Error serving file' });
            }
        });

        // Catch-all for undefined API routes
        this.app.all('/api/*', (req, res) => {
            res.status(404).json({
                error: 'API endpoint not found',
                path: req.path,
                method: req.method
            });
        });
    }

    setupErrorHandling() {
        // Global error handler
        this.app.use((error, req, res, next) => {
            console.error('Server error:', error);

            // Don't leak error details in production
            const isDevelopment = process.env.NODE_ENV !== 'production';

            res.status(error.status || 500).json({
                error: isDevelopment ? error.message : 'Internal server error',
                ...(isDevelopment && { stack: error.stack })
            });
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log('');
            console.log('======================================');
            console.log(`CV Manager Backend Server Started`);
            console.log(`Port: ${this.port}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Time: ${new Date().toISOString()}`);
            console.log('');
            console.log('API Endpoints:');
            console.log('  GET  /api/health');
            console.log('  POST /api/auth/login');
            console.log('  POST /api/auth/register');
            console.log('  GET  /api/settings/:userId');
            console.log('  POST /api/settings/ai-provider');
            console.log('  POST /api/cvs/upload');
            console.log('  GET  /api/cvs/:userId');
            console.log('');
            console.log('Frontend should run on: http://localhost:3000');
            console.log('Backend API available at: http://localhost:3001');
            console.log('======================================');
            console.log('');
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully');
            process.exit(0);
        });

        process.on('SIGINT', () => {
            console.log('\nSIGINT received, shutting down gracefully');
            process.exit(0);
        });
    }
}

// Start the server
new CVManagerServer();
