# System Architecture - CV Matching Tool

**Project**: Randstad Digital Belgium - CV Matching Tool  
**Version**: 1.0  
**Date**: 08 September 2025  
**Related Documents**: [Technical Specification](./TECH-SPEC.md), [Data Model](./DATA-MODEL.md), [Storage Design](./STORAGE.md)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [System Components](#2-system-components)
3. [Data Flow Architecture](#3-data-flow-architecture)
4. [Service Architecture](#4-service-architecture)
5. [Integration Architecture](#5-integration-architecture)
6. [Deployment Architecture](#6-deployment-architecture)
7. [Security Architecture](#7-security-architecture)

---

## 1. Architecture Overview

### 1.1 Architectural Style
The CV Matching Tool follows a **Modular Monolith** architecture pattern, providing:
- Clear separation of concerns between modules
- Simplified deployment and development
- Easier testing and debugging
- Path to microservices if needed

### 1.2 High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Next.js Frontend]
        WEB[Web Browser]
    end
    
    subgraph "Application Layer"
        API[Express.js API Gateway]
        AUTH[Authentication Service]
    end
    
    subgraph "Business Logic Layer"
        PARSE[Parser Service]
        NORM[Normaliser Service]
        I18N[Translation Service]
        MATCH[Matcher Service]
        REWRITE[Rewriter Service]
        INDEX[Indexer Service]
    end
    
    subgraph "Data Layer"
        FS[Filesystem Storage]
        CACHE[In-Memory Cache]
        INDICES[JSON Indices]
    end
    
    subgraph "External Services"
        CLAUDE[Claude API]
        GPT[ChatGPT API]
        GEMINI[Gemini API]
    end
    
    WEB --> UI
    UI --> API
    API --> AUTH
    API --> PARSE
    API --> NORM
    API --> MATCH
    API --> REWRITE
    
    PARSE --> FS
    NORM --> I18N
    NORM --> INDEX
    I18N --> CLAUDE
    I18N --> GPT
    I18N --> GEMINI
    MATCH --> INDICES
    REWRITE --> CLAUDE
    INDEX --> INDICES
    
    NORM --> FS
    MATCH --> CACHE
    REWRITE --> FS
```

### 1.3 Architecture Principles

1. **Single Responsibility**: Each service has one clear purpose
2. **Dependency Inversion**: Services depend on abstractions, not implementations
3. **Fail Fast**: Validate inputs early and provide clear error messages
4. **Idempotency**: Operations can be safely repeated
5. **Observability**: All operations are logged and traceable

---

## 2. System Components

### 2.1 Frontend Components

```mermaid
graph TD
    subgraph "Next.js Application"
        APP[App Router]
        LAYOUT[Shared Layout]
        
        subgraph "Page Components"
            CVS[CVs Tab]
            PROFILES[Profiles Tab] 
            MATCHES[Matches Tab]
            REWRITE[Rewriting Tab]
        end
        
        subgraph "Shared Components"
            UPLOAD[File Upload]
            TABLE[Data Table]
            CHARTS[Score Charts]
            FORMS[Profile Forms]
            MODAL[Modal Dialogs]
        end
        
        subgraph "Services"
            API_CLIENT[API Client]
            STATE[State Management]
            UTILS[Utilities]
        end
    end
    
    APP --> LAYOUT
    LAYOUT --> CVS
    LAYOUT --> PROFILES
    LAYOUT --> MATCHES
    LAYOUT --> REWRITE
    
    CVS --> UPLOAD
    CVS --> TABLE
    PROFILES --> FORMS
    MATCHES --> CHARTS
    MATCHES --> TABLE
    REWRITE --> MODAL
    
    CVS --> API_CLIENT
    PROFILES --> API_CLIENT
    MATCHES --> API_CLIENT
    REWRITE --> API_CLIENT
    
    API_CLIENT --> STATE
    STATE --> UTILS
```

### 2.2 Backend Services Architecture

```mermaid
graph TB
    subgraph "API Gateway Layer"
        ROUTES[Express Routes]
        MIDDLEWARE[Middleware Stack]
        VALIDATION[Request Validation]
    end
    
    subgraph "Service Layer"
        subgraph "Core Services"
            PARSER[Parser Service]
            NORMALISER[Normaliser Service]
            MATCHER[Matcher Service]
            REWRITER[Rewriter Service]
        end
        
        subgraph "Supporting Services"
            I18N[Translation Service]
            INDEXER[Indexer Service]
            EXPORT[Export Service]
            CONTACT[Contact Service]
        end
        
        subgraph "Infrastructure Services"
            STORAGE[Storage Service]
            CACHE[Cache Service]
            LOGGER[Logging Service]
            CONFIG[Config Service]
        end
    end
    
    subgraph "External Integration"
        AI_CONNECTOR[AI Connector]
        PDF_GENERATOR[PDF Generator]
        EMAIL[Email Service]
    end
    
    ROUTES --> MIDDLEWARE
    MIDDLEWARE --> VALIDATION
    VALIDATION --> PARSER
    VALIDATION --> NORMALISER
    VALIDATION --> MATCHER
    VALIDATION --> REWRITER
    
    PARSER --> STORAGE
    NORMALISER --> I18N
    NORMALISER --> INDEXER
    MATCHER --> CACHE
    REWRITER --> AI_CONNECTOR
    
    I18N --> AI_CONNECTOR
    EXPORT --> PDF_GENERATOR
    CONTACT --> EMAIL
    
    AI_CONNECTOR --> LOGGER
    STORAGE --> LOGGER
    CACHE --> LOGGER
```

---

## 3. Data Flow Architecture

### 3.1 CV Processing Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as API Gateway
    participant PS as Parser Service
    participant NS as Normaliser Service
    participant TS as Translation Service
    participant IS as Indexer Service
    participant ST as Storage Service
    participant AI as AI Service
    
    U->>FE: Upload CV file
    FE->>API: POST /api/cv/upload
    API->>PS: Parse file content
    PS->>ST: Store original file
    PS->>API: Return raw sections
    
    API->>NS: Normalise content
    NS->>TS: Detect language
    TS->>AI: Translate to target
    AI-->>TS: Translated content
    TS-->>NS: Target bundle
    NS->>ST: Save candidate JSON
    
    NS->>IS: Update indices
    IS->>ST: Save updated indices
    
    API-->>FE: Processing complete
    FE-->>U: Show parsed CV
```

### 3.2 Matching Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as API Gateway
    participant MS as Matcher Service
    participant CS as Cache Service
    participant ST as Storage Service
    
    U->>FE: Run matching query
    FE->>API: POST /api/match
    API->>MS: Execute matching
    
    MS->>CS: Check cache
    alt Cache Hit
        CS-->>MS: Return cached results
    else Cache Miss
        MS->>ST: Load indices
        MS->>ST: Load candidates
        MS->>MS: Calculate scores
        MS->>CS: Cache results
    end
    
    MS-->>API: Ranked results
    API-->>FE: Match results
    FE-->>U: Display rankings
```

### 3.3 Rewriting Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as API Gateway
    participant RS as Rewriter Service
    participant AI as AI Service
    participant PDF as PDF Generator
    participant ST as Storage Service
    
    U->>FE: Request CV rewrite
    FE->>API: POST /api/rewrite
    API->>RS: Generate rewritten content
    
    RS->>ST: Load candidate data
    RS->>AI: Generate improved text
    AI-->>RS: Rewritten sections
    
    RS->>PDF: Create PDF template
    PDF-->>RS: Generated PDF
    
    RS->>ST: Save draft PDF
    RS-->>API: Draft ready for review
    API-->>FE: Show preview
    FE-->>U: Display for approval
    
    U->>FE: Approve content
    FE->>API: PUT /api/rewrite/approve
    API->>RS: Finalise content
    RS->>ST: Mark as approved
```

---

## 4. Service Architecture

### 4.1 Service Dependencies

```mermaid
graph TD
    subgraph "Presentation Layer"
        UI[Next.js UI]
    end
    
    subgraph "API Layer"
        API[Express API]
    end
    
    subgraph "Business Services"
        PARSE[Parser Service]
        NORM[Normaliser Service]
        MATCH[Matcher Service]
        REWRITE[Rewriter Service]
    end
    
    subgraph "Supporting Services"
        I18N[Translation Service]
        INDEX[Indexer Service]
        EXPORT[Export Service]
    end
    
    subgraph "Infrastructure Services"
        STORAGE[Storage Service]
        CACHE[Cache Service]
        LOG[Logging Service]
    end
    
    subgraph "External Services"
        AI[AI Connectors]
        PDF[PDF Generator]
    end
    
    UI --> API
    API --> PARSE
    API --> NORM
    API --> MATCH
    API --> REWRITE
    
    PARSE --> STORAGE
    NORM --> I18N
    NORM --> INDEX
    MATCH --> CACHE
    REWRITE --> AI
    
    I18N --> AI
    INDEX --> STORAGE
    EXPORT --> PDF
    
    STORAGE --> LOG
    CACHE --> LOG
    AI --> LOG
```

### 4.2 Service Interfaces

#### 4.2.1 Parser Service Interface
```typescript
interface IParserService {
  parseFile(file: Buffer, filename: string): Promise<RawExtraction>;
  detectFileType(buffer: Buffer): FileType;
  extractText(file: Buffer, type: FileType): Promise<string>;
  parseStructure(text: string): Promise<DocumentStructure>;
}
```

#### 4.2.2 Normaliser Service Interface
```typescript
interface INormaliserService {
  normaliseCandidate(rawData: RawExtraction): Promise<Candidate>;
  mapSkills(skills: string[]): Promise<SkillItem[]>;
  applyImpliedSkills(skills: SkillItem[]): Promise<SkillItem[]>;
  extractExperience(text: string): Promise<ExperienceItem[]>;
}
```

#### 4.2.3 Matcher Service Interface
```typescript
interface IMatcherService {
  matchCandidates(profileId: string): Promise<MatchResult[]>;
  calculateScore(candidate: Candidate, profile: SearchProfile): Promise<ScoreBreakdown>;
  rankResults(results: MatchResult[]): Promise<MatchResult[]>;
  exportResults(results: MatchResult[], format: ExportFormat): Promise<Buffer>;
}
```

### 4.3 Service Communication Patterns

```mermaid
graph LR
    subgraph "Synchronous Calls"
        A[Service A] -->|Direct Call| B[Service B]
        B -->|Response| A
    end
    
    subgraph "Event-Driven"
        C[Service C] -->|Event| E[Event Bus]
        E -->|Event| D[Service D]
    end
    
    subgraph "Request-Response"
        F[Client] -->|HTTP Request| G[API Gateway]
        G -->|HTTP Response| F
    end
```

---

## 5. Integration Architecture

### 5.1 AI Integration Layer

```mermaid
graph TB
    subgraph "AI Abstraction Layer"
        STRATEGY[AI Strategy Pattern]
        FACTORY[AI Provider Factory]
        CIRCUIT[Circuit Breaker]
    end
    
    subgraph "Provider Implementations"
        CLAUDE_IMPL[Claude Implementation]
        GPT_IMPL[ChatGPT Implementation]
        GEMINI_IMPL[Gemini Implementation]
    end
    
    subgraph "External APIs"
        CLAUDE_API[Claude API]
        GPT_API[ChatGPT API]
        GEMINI_API[Gemini API]
    end
    
    STRATEGY --> FACTORY
    FACTORY --> CIRCUIT
    
    CIRCUIT --> CLAUDE_IMPL
    CIRCUIT --> GPT_IMPL
    CIRCUIT --> GEMINI_IMPL
    
    CLAUDE_IMPL --> CLAUDE_API
    GPT_IMPL --> GPT_API
    GEMINI_IMPL --> GEMINI_API
```

### 5.2 AI Provider Strategy

```typescript
interface IAIProvider {
  name: string;
  translate(text: string, targetLang: Language): Promise<TranslationResult>;
  rewrite(content: string, instructions: string): Promise<RewriteResult>;
  detectLanguage(text: string): Promise<LanguageDetection>;
  isAvailable(): Promise<boolean>;
}

class AIProviderFactory {
  static create(providerName: string): IAIProvider {
    switch (providerName) {
      case 'claude': return new ClaudeProvider();
      case 'chatgpt': return new ChatGPTProvider();
      case 'gemini': return new GeminiProvider();
      default: throw new Error(`Unknown provider: ${providerName}`);
    }
  }
}
```

### 5.3 Fallback and Resilience

```mermaid
graph TD
    REQUEST[AI Request] --> PRIMARY[Primary Provider]
    PRIMARY -->|Success| RETURN[Return Result]
    PRIMARY -->|Failure| SECONDARY[Secondary Provider]
    SECONDARY -->|Success| RETURN
    SECONDARY -->|Failure| TERTIARY[Tertiary Provider]
    TERTIARY -->|Success| RETURN
    TERTIARY -->|Failure| MANUAL[Manual Review Queue]
```

---

## 6. Deployment Architecture

### 6.1 Development Environment

```mermaid
graph TB
    subgraph "Local Development"
        DEV_FE[Next.js Dev Server]
        DEV_BE[Express Dev Server]
        DEV_FS[Local Filesystem]
    end
    
    subgraph "Replit Environment"
        REPL_FE[Next.js on Replit]
        REPL_BE[Express on Replit]
        REPL_FS[Replit Filesystem]
    end
    
    subgraph "External Services"
        AI_APIS[AI APIs]
        GIT[GitHub Repository]
    end
    
    DEV_FE --> DEV_BE
    DEV_BE --> DEV_FS
    
    REPL_FE --> REPL_BE
    REPL_BE --> REPL_FS
    
    DEV_BE --> AI_APIS
    REPL_BE --> AI_APIS
    
    DEV_FE --> GIT
    REPL_FE --> GIT
```

### 6.2 Production Deployment Options

#### 6.2.1 Vercel Deployment
```mermaid
graph TB
    subgraph "Vercel Platform"
        VERCEL_FE[Next.js Frontend]
        VERCEL_API[API Routes]
        VERCEL_EDGE[Edge Functions]
    end
    
    subgraph "External Storage"
        CLOUD_FS[Cloud Filesystem]
        BACKUP[Cloud Backup]
    end
    
    USERS[Users] --> VERCEL_FE
    VERCEL_FE --> VERCEL_API
    VERCEL_API --> VERCEL_EDGE
    VERCEL_API --> CLOUD_FS
    CLOUD_FS --> BACKUP
```

#### 6.2.2 Containerised Deployment
```mermaid
graph TB
    subgraph "Container Platform"
        CONTAINER[Docker Container]
        VOLUME[Persistent Volume]
        LB[Load Balancer]
    end
    
    subgraph "Application"
        NEXT[Next.js App]
        EXPRESS[Express API]
    end
    
    USERS[Users] --> LB
    LB --> CONTAINER
    CONTAINER --> NEXT
    CONTAINER --> EXPRESS
    CONTAINER --> VOLUME
```

### 6.3 Scaling Considerations

```mermaid
graph LR
    subgraph "Current Architecture (≤1K CVs)"
        SINGLE[Single Instance]
        LOCAL_FS[Local Filesystem]
        MEMORY[In-Memory Cache]
    end
    
    subgraph "Future Scaling (>1K CVs)"
        MULTI[Multiple Instances]
        SHARED_FS[Shared Filesystem]
        REDIS[Redis Cache]
        DB[Database Layer]
    end
    
    SINGLE -.->|Upgrade Path| MULTI
    LOCAL_FS -.->|Migrate| SHARED_FS
    MEMORY -.->|Replace| REDIS
    LOCAL_FS -.->|Migrate| DB
```

---

## 7. Security Architecture

### 7.1 Security Layers

```mermaid
graph TB
    subgraph "Application Security"
        AUTH[Authentication]
        AUTHZ[Authorisation]
        VALIDATE[Input Validation]
        SANITISE[Data Sanitisation]
    end
    
    subgraph "Data Security"
        ENCRYPT[At-Rest Encryption]
        TRANSIT[In-Transit Encryption]
        AUDIT[Audit Logging]
        BACKUP[Secure Backups]
    end
    
    subgraph "Infrastructure Security"
        FIREWALL[Network Firewall]
        SECRETS[Secret Management]
        MONITORING[Security Monitoring]
        UPDATES[Security Updates]
    end
    
    AUTH --> AUTHZ
    AUTHZ --> VALIDATE
    VALIDATE --> SANITISE
    
    ENCRYPT --> AUDIT
    TRANSIT --> BACKUP
    
    FIREWALL --> SECRETS
    SECRETS --> MONITORING
    MONITORING --> UPDATES
```

### 7.2 Data Protection Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as API Gateway
    participant AUTH as Auth Service
    participant ENC as Encryption Service
    participant FS as Filesystem
    participant AUDIT as Audit Service
    
    U->>FE: Upload CV
    FE->>API: Send encrypted request
    API->>AUTH: Validate token
    AUTH-->>API: User authorised
    
    API->>ENC: Encrypt CV data
    ENC-->>API: Encrypted data
    API->>FS: Store encrypted file
    
    API->>AUDIT: Log operation
    AUDIT->>FS: Store audit trail
    
    API-->>FE: Confirm upload
    FE-->>U: Show success
```

### 7.3 GDPR Compliance Architecture

```mermaid
graph TB
    subgraph "Data Subject Rights"
        ACCESS[Data Access]
        EXPORT[Data Export]
        DELETE[Data Deletion]
        RECTIFY[Data Rectification]
    end
    
    subgraph "Privacy Controls"
        CONSENT[Consent Management]
        PURPOSE[Purpose Limitation]
        RETENTION[Data Retention]
        MINIMAL[Data Minimisation]
    end
    
    subgraph "Technical Measures"
        ENCRYPTION[Encryption]
        PSEUDONYM[Pseudonymisation]
        BACKUP_SEC[Secure Backups]
        MONITORING[Privacy Monitoring]
    end
    
    ACCESS --> CONSENT
    EXPORT --> PURPOSE
    DELETE --> RETENTION
    RECTIFY --> MINIMAL
    
    CONSENT --> ENCRYPTION
    PURPOSE --> PSEUDONYM
    RETENTION --> BACKUP_SEC
    MINIMAL --> MONITORING
```

---

## Appendices

### A. Technology Decision Matrix

| Component | Options Considered | Selected | Justification |
|-----------|-------------------|----------|---------------|
| Frontend Framework | React, Vue, Angular | Next.js (React) | SSR capabilities, TypeScript support, Vercel integration |
| Backend Framework | Express, Fastify, NestJS | Express | Simplicity, ecosystem, team familiarity |
| Language | JavaScript, TypeScript | TypeScript | Type safety, better tooling, maintainability |
| Storage | PostgreSQL, MongoDB, Filesystem | Filesystem + JSON | Simplicity, no DB overhead, portable |
| AI Integration | Direct APIs, LangChain | Direct APIs | Control, simplicity, cost effectiveness |

### B. Performance Benchmarks

| Operation | Target | Measurement Method |
|-----------|--------|-------------------|
| CV Upload | < 5s | Time from upload to parsed JSON |
| Matching Query | < 800ms | Time from request to ranked results |
| Index Rebuild | < 2s | Time to rebuild all indices |
| PDF Generation | < 10s | Time from request to downloadable PDF |

### C. Monitoring and Observability

```mermaid
graph TB
    subgraph "Application Metrics"
        PERF[Performance Metrics]
        ERROR[Error Rates]
        USAGE[Usage Analytics]
    end
    
    subgraph "Infrastructure Metrics"
        CPU[CPU Usage]
        MEMORY[Memory Usage]
        DISK[Disk Usage]
        NETWORK[Network I/O]
    end
    
    subgraph "Business Metrics"
        UPLOAD[Upload Success Rate]
        MATCH[Match Accuracy]
        APPROVAL[Approval Rates]
    end
    
    PERF --> DASHBOARD[Monitoring Dashboard]
    ERROR --> DASHBOARD
    USAGE --> DASHBOARD
    
    CPU --> ALERTS[Alert System]
    MEMORY --> ALERTS
    DISK --> ALERTS
    
    UPLOAD --> REPORTS[Business Reports]
    MATCH --> REPORTS
    APPROVAL --> REPORTS
```

---

**Document Version**: 1.0  
**Last Updated**: 08 September 2025  
**Next Review**: 15 September 2025