# Implementation Guide - CV Matching Tool

**Project**: Randstad Digital Belgium - CV Matching Tool  
**Version**: 1.0  
**Date**: 08 September 2025  
**Related Documents**: [Technical Specification](./TECH-SPEC.md), [System Architecture](./ARCHITECTURE.md), [Data Model](./DATA-MODEL.md), [Storage Design](./STORAGE.md)

---

## Table of Contents

1. [Development Environment Setup](#1-development-environment-setup)
2. [Project Structure](#2-project-structure)
3. [Implementation Checklist](#3-implementation-checklist)
4. [Code Standards](#4-code-standards)
5. [Testing Strategy](#5-testing-strategy)
6. [Deployment Guidelines](#6-deployment-guidelines)
7. [Monitoring and Maintenance](#7-monitoring-and-maintenance)

---

## 1. Development Environment Setup

### 1.1 Prerequisites

```bash
# Required software versions
Node.js: >= 18.0.0
npm: >= 9.0.0
TypeScript: >= 5.0.0
Git: >= 2.30.0

# Operating Systems
- macOS 12+ (primary development)
- Replit (cloud development)
- Linux/Windows (deployment targets)
```

### 1.2 Repository Setup

```bash
# 1. Create repository structure
mkdir cv-matching-tool
cd cv-matching-tool

# 2. Initialize Git
git init
git remote add origin https://github.com/your-username/cv-matching-tool.git

# 3. Create directory structure
mkdir -p {docs,frontend,backend,storage,tests}
mkdir -p storage/{assets/{originals,generated},candidates,profiles,results,indices,backups,system}

# 4. Create .gitkeep files for empty directories
find storage -type d -empty -exec touch {}/.gitkeep \;

# 5. Copy documentation files
# Place all .md files from this specification into docs/
```

### 1.3 Package Configuration

#### Root package.json
```json
{
  "name": "cv-matching-tool",
  "version": "1.0.0",
  "description": "CV Matching Tool for Randstad Digital Belgium",
  "private": true,
  "workspaces": ["frontend", "backend"],
  "scripts": {
    "dev": "npm-run-all --parallel dev:*",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "build": "npm-run-all build:*",
    "build:backend": "npm run build --workspace=backend",
    "build:frontend": "npm run build --workspace=frontend",
    "test": "npm-run-all test:*",
    "test:backend": "npm run test --workspace=backend",
    "test:frontend": "npm run test --workspace=frontend",
    "lint": "npm-run-all lint:*",
    "lint:backend": "npm run lint --workspace=backend",
    "lint:frontend": "npm run lint --workspace=frontend",
    "setup": "npm install && npm run build",
    "seed": "node backend/scripts/seed-fixtures.js",
    "index:rebuild": "node backend/scripts/rebuild-indices.js",
    "backup": "node backend/scripts/create-backup.js"
  },
  "devDependencies": {
    "npm-run-all": "^4.1.5",
    "@types/node": "^20.5.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

#### Backend package.json
```json
{
  "name": "backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.0",
    "helmet": "^7.0.0",
    "compression": "^1.7.0",
    "multer": "^1.4.0",
    "pdf-parse": "^1.1.0",
    "mammoth": "^1.6.0",
    "docx4js": "^4.0.0",
    "puppeteer": "^21.0.0",
    "archiver": "^6.0.0",
    "uuid": "^9.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "@types/multer": "^1.4.0",
    "@types/uuid": "^9.0.0",
    "@types/archiver": "^6.0.0",
    "tsx": "^4.7.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "eslint": "^8.50.0",
    "@typescript-eslint/eslint-plugin": "^6.7.0",
    "@typescript-eslint/parser": "^6.7.0"
  }
}
```

#### Frontend package.json
```json
{
  "name": "frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "recharts": "^2.8.0",
    "lucide-react": "^0.263.0",
    "react-dropzone": "^14.2.0",
    "swr": "^2.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "eslint": "^8.50.0",
    "eslint-config-next": "^14.0.0"
  }
}
```

---

## 2. Project Structure

### 2.1 Complete Directory Layout

```
cv-matching-tool/
├── docs/                           # Documentation
│   ├── TECH-SPEC.md               # Technical specification
│   ├── ARCHITECTURE.md            # System architecture
│   ├── DATA-MODEL.md              # Data model specification
│   ├── STORAGE.md                 # Storage design
│   ├── IMPLEMENTATION.md          # This file
│   └── README.md                  # Project overview
├── frontend/                       # Next.js application
│   ├── src/
│   │   ├── app/                   # App Router pages
│   │   │   ├── layout.tsx         # Root layout
│   │   │   ├── page.tsx           # Home page
│   │   │   ├── cvs/               # CVs tab
│   │   │   ├── profiles/          # Profiles tab
│   │   │   ├── matches/           # Matches tab
│   │   │   └── rewriting/         # Rewriting tab
│   │   ├── components/            # Reusable components
│   │   │   ├── ui/                # Basic UI components
│   │   │   ├── forms/             # Form components
│   │   │   ├── tables/            # Table components
│   │   │   └── charts/            # Chart components
│   │   ├── lib/                   # Utilities and helpers
│   │   │   ├── api.ts             # API client
│   │   │   ├── types.ts           # TypeScript types
│   │   │   └── utils.ts           # Utility functions
│   │   └── styles/                # Global styles
│   ├── public/                    # Static assets
│   ├── next.config.js             # Next.js configuration
│   ├── tailwind.config.js         # Tailwind configuration
│   └── tsconfig.json              # TypeScript configuration
├── backend/                        # Express.js API
│   ├── src/
│   │   ├── index.ts               # Application entry point
│   │   ├── routes/                # API routes
│   │   │   ├── cv.ts              # CV management routes
│   │   │   ├── profiles.ts        # Profile management routes
│   │   │   ├── match.ts           # Matching routes
│   │   │   └── rewrite.ts         # Rewriting routes
│   │   ├── services/              # Business logic services
│   │   │   ├── parser/            # CV parsing services
│   │   │   ├── normaliser/        # Data normalisation
│   │   │   ├── matcher/           # Matching engine
│   │   │   ├── rewriter/          # Content rewriting
│   │   │   ├── i18n/              # Translation services
│   │   │   ├── indexer/           # Search indexing
│   │   │   └── storage/           # Storage services
│   │   ├── middleware/            # Express middleware
│   │   ├── types/                 # TypeScript type definitions
│   │   ├── config/                # Configuration files
│   │   └── utils/                 # Utility functions
│   ├── scripts/                   # Utility scripts
│   │   ├── seed-fixtures.js       # Load test fixtures
│   │   ├── rebuild-indices.js     # Rebuild search indices
│   │   └── create-backup.js       # Create system backup
│   ├── __tests__/                 # Test files
│   ├── jest.config.js             # Jest configuration
│   └── tsconfig.json              # TypeScript configuration
├── storage/                        # Data storage (gitignored)
│   ├── assets/                    # Binary files
│   ├── candidates/                # Candidate data
│   ├── profiles/                  # Search profiles
│   ├── results/                   # Match results
│   ├── indices/                   # Search indices
│   ├── backups/                   # System backups
│   └── system/                    # System files
├── tests/                         # Shared test utilities
│   ├── fixtures/                  # Test data (committed)
│   │   ├── cv-fixture-nl.txt     # Dutch CV sample
│   │   ├── cv-fixture-fr.txt     # French CV sample
│   │   └── candidates-expected/   # Expected JSON outputs
│   └── utils/                     # Test utilities
├── .gitignore                     # Git ignore rules
├── .editorconfig                  # Editor configuration
├── .eslintrc.js                   # ESLint configuration
├── .prettierrc                    # Prettier configuration
├── package.json                   # Root package.json
└── README.md                      # Project README
```

### 2.2 Key Configuration Files

#### .gitignore
```gitignore
# Dependencies
node_modules/
npm-debug.log*
.npm

# Runtime data
storage/assets/originals/
storage/assets/generated/
storage/candidates/
storage/results/
storage/backups/
storage/raw-extract/
storage/indices/

# Keep directory structure
!storage/**/.gitkeep

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
dist/
.next/
out/

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Temporary files
*.tmp
*.temp
```

#### .editorconfig
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.{ts,tsx,js,jsx}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[*.json]
indent_size = 2
```

---

## 3. Implementation Checklist

### 3.1 Phase 1: Foundation (Weeks 1-4)

#### Backend Infrastructure
- [ ] **Express.js Server Setup**
  - [ ] Basic Express server with TypeScript
  - [ ] CORS and security middleware
  - [ ] Error handling middleware
  - [ ] Health check endpoint
  - [ ] Request logging

- [ ] **Storage Layer**
  - [ ] Filesystem storage service
  - [ ] Atomic write operations
  - [ ] Directory management
  - [ ] Basic file operations

- [ ] **CV Upload & Parsing**
  - [ ] Multer file upload middleware
  - [ ] PDF parsing with pdf-parse
  - [ ] DOCX parsing with mammoth
  - [ ] TXT file handling
  - [ ] Raw extraction JSON storage

#### Frontend Foundation
- [ ] **Next.js Setup**
  - [ ] App Router configuration
  - [ ] TailwindCSS setup
  - [ ] Basic layout component
  - [ ] Navigation between tabs

- [ ] **Core Components**
  - [ ] File upload component with drag-and-drop
  - [ ] Basic table component
  - [ ] Loading states
  - [ ] Error boundaries

#### Testing Infrastructure
- [ ] **Test Setup**
  - [ ] Jest configuration for backend
  - [ ] Test fixtures creation
  - [ ] Basic integration tests
  - [ ] CI/CD pipeline (GitHub Actions)

### 3.2 Phase 2: Core Services (Weeks 5-8)

#### Data Processing
- [ ] **Normalisation Service**
  - [ ] Skills canonicalisation
  - [ ] Experience parsing
  - [ ] Contact information extraction
  - [ ] Implied skills mapping

- [ ] **Translation Service**
  - [ ] Language detection
  - [ ] AI provider integration (Claude/ChatGPT)
  - [ ] UK English enforcement
  - [ ] Parallel language storage

- [ ] **Search Indexing**
  - [ ] Skills index implementation
  - [ ] Text search index
  - [ ] Index update strategies
  - [ ] Index validation

#### API Development
- [ ] **CV Management API**
  - [ ] Upload endpoint
  - [ ] List/retrieve endpoints
  - [ ] Update metadata
  - [ ] Delete operations

- [ ] **Profile Management API**
  - [ ] CRUD operations for profiles
  - [ ] Profile validation
  - [ ] Profile templates

### 3.3 Phase 3: Matching Engine (Weeks 9-12)

#### Scoring Algorithm
- [ ] **Match Service**
  - [ ] Skills matching algorithm
  - [ ] Experience relevance scoring
  - [ ] Language proficiency matching
  - [ ] Composite score calculation

- [ ] **Results Processing**
  - [ ] Result ranking
  - [ ] Score breakdown generation
  - [ ] Missing skills analysis
  - [ ] Export functionality

#### Frontend Integration
- [ ] **Matching Interface**
  - [ ] Profile creation forms
  - [ ] Match execution interface
  - [ ] Results visualization
  - [ ] Filtering and sorting

- [ ] **Data Visualization**
  - [ ] Score charts with Recharts
  - [ ] Progress indicators
  - [ ] Statistical summaries

### 3.4 Phase 4: Content Generation (Weeks 13-16)

#### Rewriting Engine
- [ ] **AI Integration**
  - [ ] Provider abstraction layer
  - [ ] Content generation prompts
  - [ ] Quality validation
  - [ ] Fallback mechanisms

- [ ] **PDF Generation**
  - [ ] Puppeteer setup
  - [ ] CV templates (Randstad branding)
  - [ ] Multi-language templates
  - [ ] File naming conventions

- [ ] **Approval Workflow**
  - [ ] Draft/approved status tracking
  - [ ] Manual editing interface
  - [ ] Version control
  - [ ] Approval audit trail

### 3.5 Phase 5: Production Features (Weeks 17-20)

#### Security & Compliance
- [ ] **GDPR Implementation**
  - [ ] Data export functionality
  - [ ] Right to be forgotten
  - [ ] Audit logging
  - [ ] Consent management

- [ ] **Security Hardening**
  - [ ] Input validation with Zod
  - [ ] Rate limiting
  - [ ] File type validation
  - [ ] XSS protection

#### Operations
- [ ] **Monitoring & Logging**
  - [ ] Application metrics
  - [ ] Error tracking
  - [ ] Performance monitoring
  - [ ] Health checks

- [ ] **Backup & Recovery**
  - [ ] Automated backups
  - [ ] Recovery procedures
  - [ ] Data retention policies
  - [ ] Disaster recovery plan

---

## 4. Code Standards

### 4.1 TypeScript Standards

#### Type Definitions
```typescript
// Use explicit interface definitions
interface CandidateCreateRequest {
  file: Express.Multer.File;
  intermediaryCompany?: string;
  targetLanguage: Language;
}

// Use strict typing for API responses
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

// Use discriminated unions for different states
type ProcessingStatus = 
  | { status: 'pending' }
  | { status: 'processing'; progress: number }
  | { status: 'completed'; result: ProcessedCV }
  | { status: 'failed'; error: string };
```

#### Error Handling Pattern
```typescript
// Custom error classes
class CVProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'CVProcessingError';
  }
}

// Result pattern for operations that can fail
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Usage example
async function parseCV(file: Buffer): Promise<Result<RawExtraction, CVProcessingError>> {
  try {
    const extraction = await performParsing(file);
    return { success: true, data: extraction };
  } catch (error) {
    return { 
      success: false, 
      error: new CVProcessingError('Failed to parse CV', 'PARSE_ERROR', error)
    };
  }
}
```

### 4.2 React Component Standards

#### Component Structure
```typescript
// Use explicit prop interfaces
interface CVUploadProps {
  onUpload: (file: File) => Promise<void>;
  maxFileSize?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
}

// Use proper component typing
const CVUpload: React.FC<CVUploadProps> = ({ 
  onUpload, 
  maxFileSize = 5 * 1024 * 1024, // 5MB default
  acceptedTypes = ['.pdf', '.docx', '.txt'],
  disabled = false 
}) => {
  // Component implementation
};

// Export with proper TypeScript
export { CVUpload };
export type { CVUploadProps };
```

#### State Management Pattern
```typescript
// Use custom hooks for complex state
function useCVUpload() {
  const [state, setState] = useState<{
    files: File[];
    uploading: boolean;
    progress: number;
    error: string | null;
  }>({
    files: [],
    uploading: false,
    progress: 0,
    error: null
  });

  const uploadFile = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, uploading: true, error: null }));
    
    try {
      await apiClient.uploadCV(file, {
        onProgress: (progress) => setState(prev => ({ ...prev, progress }))
      });
      
      setState(prev => ({ 
        ...prev, 
        files: [...prev.files, file],
        uploading: false,
        progress: 0 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        uploading: false, 
        error: error.message,
        progress: 0 
      }));
    }
  }, []);

  return { ...state, uploadFile };
}
```

### 4.3 API Design Standards

#### Route Structure
```typescript
// Use consistent route organization
const router = express.Router();

// CV routes
router.post('/cv/upload', validateUpload, uploadCV);
router.get('/cv/:id', validateCVId, getCV);
router.put('/cv/:id', validateCVId, validateCVUpdate, updateCV);
router.delete('/cv/:id', validateCVId, deleteCV);
router.post('/cv/:id/normalise', validateCVId, normaliseCV);

// Profile routes
router.get('/profiles', listProfiles);
router.post('/profiles', validateProfile, createProfile);
router.get('/profiles/:id', validateProfileId, getProfile);
router.put('/profiles/:id', validateProfileId, validateProfileUpdate, updateProfile);
router.delete('/profiles/:id', validateProfileId, deleteProfile);

export { router as cvRouter };
```

#### Validation with Zod
```typescript
import { z } from 'zod';

// Schema definitions
const CreateProfileSchema = z.object({
  name: z.string().min(1).max(200),
  targetLanguage: z.enum(['nl', 'fr', 'en']),
  requiredSkills: z.array(z.string().min(1)).min(1),
  optionalSkills: z.array(z.string().min(1)).default([]),
  minYears: z.number().int().min(0).max(50).optional(),
  languagesRequired: z.array(z.object({
    language: z.enum(['nl', 'fr', 'en', 'de', 'es', 'pt']),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Native'])
  })).default([])
});

// Validation middleware
const validateProfile = (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = CreateProfileSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors
        }
      });
    }
    next(error);
  }
};
```

---

## 5. Testing Strategy

### 5.1 Test Structure

```typescript
// Unit test example for normaliser service
describe('SkillNormaliser', () => {
  let normaliser: SkillNormaliser;

  beforeEach(() => {
    normaliser = new SkillNormaliser();
  });

  describe('normaliseSkills', () => {
    it('should map ReactJS to React', () => {
      const input = ['ReactJS', 'Node.js'];
      const result = normaliser.normaliseSkills(input);
      
      expect(result).toContainEqual({
        canonical: 'React',
        aliases: ['ReactJS'],
        implied: false,
        confidence: expect.any(Number)
      });
    });

    it('should add implied skills for Laravel', () => {
      const input = ['Laravel'];
      const result = normaliser.normaliseSkills(input);
      
      const impliedSkills = result.filter(skill => skill.implied);
      expect(impliedSkills).toContainEqual(
        expect.objectContaining({ canonical: 'PHP' })
      );
      expect(impliedSkills).toContainEqual(
        expect.objectContaining({ canonical: 'Composer' })
      );
    });
  });
});
```

### 5.2 Integration Tests

```typescript
// Integration test for CV upload flow
describe('CV Upload Integration', () => {
  let app: Express;
  let storage: StorageService;

  beforeAll(async () => {
    app = createTestApp();
    storage = new FilesystemStorageService('./test-storage');
    await storage.initialize();
  });

  afterAll(async () => {
    await storage.cleanup();
  });

  it('should upload and parse a PDF CV', async () => {
    const testPDF = await fs.readFile('./tests/fixtures/cv-fixture-nl.pdf');
    
    const response = await request(app)
      .post('/api/cv/upload')
      .attach('file', testPDF, 'test-cv.pdf')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: expect.any(String),
        filename: 'test-cv.pdf',
        status: 'uploaded'
      }
    });

    // Verify file was stored
    const candidate = await storage.loadCandidate(response.body.data.id);
    expect(candidate).toBeDefined();
    expect(candidate.contacts.name).toBeTruthy();
  });
});
```

### 5.3 End-to-End Tests

```typescript
// E2E test with Playwright (future implementation)
import { test, expect } from '@playwright/test';

test('complete CV matching workflow', async ({ page }) => {
  // 1. Upload CV
  await page.goto('/cvs');
  await page.setInputFiles('[data-testid=file-upload]', './tests/fixtures/cv-fixture-nl.pdf');
  await expect(page.getByText('CV uploaded successfully')).toBeVisible();

  // 2. Create profile
  await page.goto('/profiles');
  await page.fill('[data-testid=profile-name]', 'Frontend Developer');
  await page.selectOption('[data-testid=target-language]', 'en');
  await page.fill('[data-testid=required-skills]', 'React,JavaScript');
  await page.click('[data-testid=save-profile]');

  // 3. Run matching
  await page.goto('/matches');
  await page.selectOption('[data-testid=profile-select]', 'Frontend Developer');
  await page.click('[data-testid=run-match]');
  
  // 4. Verify results
  await expect(page.getByTestId('match-results')).toBeVisible();
  await expect(page.getByText(/\d+% match/)).toBeVisible();
});
```

---

## 6. Deployment Guidelines

### 6.1 Environment Configuration

#### Environment Variables
```bash
# .env.production
NODE_ENV=production
PORT=3000
STORAGE_PATH=/app/storage

# AI Provider Configuration
CLAUDE_API_KEY=your_claude_api_key
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key

# Security
SESSION_SECRET=your_session_secret
ENCRYPTION_KEY=your_encryption_key

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
```

### 6.2 Docker Deployment

#### Dockerfile
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM node:18-alpine AS runtime

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip installing Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Create storage directory
RUN mkdir -p storage/{assets/{originals,generated},candidates,profiles,results,indices,backups,system}

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app/storage
USER nextjs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  cv-tool:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - STORAGE_PATH=/app/storage
    volumes:
      - cv_storage:/app/storage
      - cv_backups:/app/backups
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - cv-tool
    restart: unless-stopped

volumes:
  cv_storage:
  cv_backups:
```

### 6.3 Vercel Deployment

#### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/next"
    },
    {
      "src": "backend/src/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "backend/src/index.ts"
    },
    {
      "src": "/(.*)",
      "dest": "frontend/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "backend/src/index.ts": {
      "maxDuration": 30
    }
  }
}
```

---

## 7. Monitoring and Maintenance

### 7.1 Application Monitoring

#### Health Check Implementation
```typescript
// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    checks: {
      storage: 'OK',
      memory: process.memoryUsage(),
      indices: 'OK'
    }
  };

  // Check storage accessibility
  try {
    fs.accessSync('./storage');
  } catch {
    health.checks.storage = 'ERROR';
    health.message = 'DEGRADED';
  }

  // Check index health
  try {
    const indexMeta = require('./storage/indices/meta.json');
    const ageHours = (Date.now() - new Date(indexMeta.lastFullRebuild).getTime()) / (1000 * 60 * 60);
    if (ageHours > 48) {
      health.checks.indices = 'STALE';
    }
  } catch {
    health.checks.indices = 'ERROR';
  }

  const status = health.message === 'OK' ? 200 : 503;
  res.status(status).json(health);
});
```

#### Metrics Collection
```typescript
interface Metrics {
  cvUploads: number;
  matchQueries: number;
  errorRate: number;
  avgProcessingTime: number;
}

class MetricsCollector {
  private metrics: Metrics = {
    cvUploads: 0,
    matchQueries: 0,
    errorRate: 0,
    avgProcessingTime: 0
  };

  incrementCVUploads() {
    this.metrics.cvUploads++;
  }

  incrementMatchQueries() {
    this.metrics.matchQueries++;
  }

  recordProcessingTime(timeMs: number) {
    // Calculate running average
    this.metrics.avgProcessingTime = 
      (this.metrics.avgProcessingTime + timeMs) / 2;
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }
}

// Usage in middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metricsCollector.recordProcessingTime(duration);
    
    if (req.path === '/api/cv/upload') {
      metricsCollector.incrementCVUploads();
    }
    if (req.path === '/api/match') {
      metricsCollector.incrementMatchQueries();
    }
  });
  
  next();
});
```

### 7.2 Maintenance Tasks

#### Automated Maintenance Script
```typescript
// scripts/maintenance.ts
interface MaintenanceTask {
  name: string;
  schedule: string; // cron format
  execute: () => Promise<void>;
}

const maintenanceTasks: MaintenanceTask[] = [
  {
    name: 'rebuild_indices',
    schedule: '0 2 * * *', // Daily at 2 AM
    execute: async () => {
      console.log('Starting index rebuild...');
      const indexer = new SearchIndexer();
      await indexer.rebuildAllIndices();
      console.log('Index rebuild completed');
    }
  },
  {
    name: 'cleanup_temp_files',
    schedule: '0 1 * * *', // Daily at 1 AM
    execute: async () => {
      console.log('Cleaning up temporary files...');
      const storage = new FilesystemStorageService();
      await storage.cleanupTempFiles();
      console.log('Cleanup completed');
    }
  },
  {
    name: 'create_backup',
    schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
    execute: async () => {
      console.log('Creating system backup...');
      const backup = new BackupManager();
      await backup.createFullBackup();
      console.log('Backup completed');
    }
  }
];

// Run maintenance tasks
if (require.main === module) {
  const taskName = process.argv[2];
  const task = maintenanceTasks.find(t => t.name === taskName);
  
  if (task) {
    task.execute().catch(console.error);
  } else {
    console.log('Available tasks:', maintenanceTasks.map(t => t.name).join(', '));
  }
}
```

### 7.3 Performance Optimization

#### Caching Strategy
```typescript
// Redis-like in-memory cache for production scaling
class PerformanceCache {
  private cache = new Map<string, { value: any; expires: number }>();
  
  set(key: string, value: any, ttlSeconds = 3600): void {
    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expires });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry || Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }
  
  // Cache match results
  async getCachedMatchResults(profileId: string): Promise<MatchResult[] | null> {
    return this.get(`match:${profileId}`);
  }
  
  async setCachedMatchResults(profileId: string, results: MatchResult[]): Promise<void> {
    this.set(`match:${profileId}`, results, 1800); // 30 minutes
  }
}
```

---

## Development Checklist Summary

### Pre-Development
- [ ] Repository structure created
- [ ] Documentation reviewed and understood
- [ ] Development environment set up
- [ ] Test fixtures prepared

### Phase 1 (Foundation)
- [ ] Backend server running
- [ ] Frontend application accessible
- [ ] File upload working
- [ ] Basic CV parsing functional

### Phase 2 (Core Services)
- [ ] Skills normalisation working
- [ ] Multi-language support implemented
- [ ] Search indices building
- [ ] API endpoints complete

### Phase 3 (Matching)
- [ ] Profile management functional
- [ ] Matching algorithm implemented
- [ ] Results visualization working
- [ ] Export functionality complete

### Phase 4 (Content Generation)
- [ ] AI integration working
- [ ] PDF generation functional
- [ ] Approval workflow implemented
- [ ] File naming correct

### Phase 5 (Production)
- [ ] Security measures implemented
- [ ] GDPR compliance verified
- [ ] Monitoring in place
- [ ] Backup system working
- [ ] Performance optimized
- [ ] Documentation complete

---

**Implementation Notes:**
- Always test with fixture data before using real CVs
- Implement one feature completely before moving to the next
- Keep security considerations in mind from the start
- Document decisions and changes as you go
- Use TypeScript strictly - avoid `any` types
- Follow the established patterns consistently

**Success Criteria:**
- All tests passing
- Performance targets met
- Security requirements satisfied
- GDPR compliance verified
- Documentation complete and accurate