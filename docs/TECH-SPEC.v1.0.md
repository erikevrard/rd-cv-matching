# Technical Specification - CV Matching Tool

**Project**: Randstad Digital Belgium - CV Matching Tool  
**Version**: 1.0  
**Date**: 08 September 2025  
**Author**: Development Team  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [User Roles and Personas](#3-user-roles-and-personas)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Technical Architecture](#6-technical-architecture)
7. [Data Model](#7-data-model)
8. [API Specification](#8-api-specification)
9. [User Interface Design](#9-user-interface-design)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Risk Assessment](#11-risk-assessment)
12. [Acceptance Criteria](#12-acceptance-criteria)

---

## 1. Executive Summary

### 1.1 Project Purpose
The CV Matching Tool is a web-based application designed for Randstad Digital Belgium to streamline the CV analysis, normalisation, and client matching process. The system ingests CVs in multiple formats and languages, normalises them into structured data, matches candidates against client requirements, and generates optimised CVs.

### 1.2 Key Objectives
- **Standardisation**: Convert diverse CV formats into normalised JSON structures
- **Multi-language Support**: Handle CVs in Dutch, French, English, German, Romanian, and Portuguese
- **Intelligent Matching**: Score candidates against search profiles with transparent algorithms
- **Content Optimisation**: Rewrite CVs to better match client requirements while maintaining accuracy
- **Human Oversight**: Ensure human approval for all AI-generated content

### 1.3 Technical Constraints
- **Capacity**: System designed for ≤1,000 CVs maximum
- **Storage**: Filesystem-only (no database) for simplicity
- **Deployment**: Must run on macOS, Replit, and cloud platforms
- **Language Standards**: All English output must use UK English spelling

---

## 2. System Overview

### 2.1 Core Components
The system consists of four main functional areas:

1. **CV Management**: Upload, parse, and store CVs
2. **Profile Management**: Define and manage search profiles
3. **Matching Engine**: Score and rank candidates
4. **Content Generation**: Rewrite and export CVs

### 2.2 Technology Stack

| Component | Technology | Justification |
|-----------|------------|---------------|
| Frontend | Next.js + TailwindCSS | Modern React framework with SSR capabilities |
| Backend | Node.js + Express + TypeScript | Type-safe JavaScript runtime |
| File Processing | pdf-parse, mammoth, docx4js | Reliable CV parsing libraries |
| AI Integration | Claude, ChatGPT, Gemini APIs | Multiple LLM providers for redundancy |
| Visualisation | Recharts | React-native charting library |
| PDF Generation | Puppeteer | Headless browser for PDF creation |
| Storage | JSON + Filesystem | Simple, portable data storage |

### 2.3 System Architecture Pattern
The application follows a **3-tier architecture**:
- **Presentation Layer**: Next.js frontend with 4 main tabs
- **Business Logic Layer**: Express.js API with modular services
- **Data Layer**: Filesystem-based JSON storage with indexing

---

## 3. User Roles and Personas

### 3.1 Primary Users

#### 3.1.1 Recruiter/Consultant
**Responsibilities**:
- Upload and manage CV collections
- Create and refine search profiles
- Review candidate matches and scores
- Approve rewritten CV content
- Export final deliverables

**Technical Proficiency**: Intermediate
**Primary Workflows**: CV upload → profile creation → matching → content approval

#### 3.1.2 Administrator
**Responsibilities**:
- Manage user accounts and permissions
- Configure AI provider settings
- Monitor system performance
- Handle GDPR compliance requests
- Manage backups and maintenance

**Technical Proficiency**: Advanced
**Primary Workflows**: System configuration → monitoring → maintenance

---

## 4. Functional Requirements

### 4.1 CV Management Module

#### 4.1.1 File Upload and Processing
- **REQ-001**: Accept PDF, DOCX, and TXT files up to 5MB
- **REQ-002**: Extract text content and identify document structure
- **REQ-003**: Detect source language automatically
- **REQ-004**: Store original files with unique identifiers
- **REQ-005**: Generate raw extraction JSON with metadata

#### 4.1.2 Content Normalisation
- **REQ-006**: Parse personal information (name, contact details)
- **REQ-007**: Extract work experience with dates and responsibilities
- **REQ-008**: Identify technical skills and competencies
- **REQ-009**: Extract education and certifications
- **REQ-010**: Map skills to canonical terminology (e.g., ReactJS → React)
- **REQ-011**: Apply implied skills (e.g., Laravel → PHP, Composer)

#### 4.1.3 Multi-language Processing
- **REQ-012**: Support input languages: nl, fr, en, de, ro, pt
- **REQ-013**: Translate content to target languages: nl, fr, en (UK)
- **REQ-014**: Maintain parallel language objects in JSON structure
- **REQ-015**: Flag translation uncertainties for human review

### 4.2 Profile Management Module

#### 4.2.1 Search Profile Creation
- **REQ-016**: Define required and optional skills
- **REQ-017**: Specify minimum experience requirements
- **REQ-018**: Set language proficiency requirements
- **REQ-019**: Configure certification requirements
- **REQ-020**: Set target language for output

#### 4.2.2 Profile Management
- **REQ-021**: Save, edit, and delete search profiles
- **REQ-022**: Clone existing profiles for variations
- **REQ-023**: Version control for profile changes
- **REQ-024**: Export profile definitions

### 4.3 Matching Engine Module

#### 4.3.1 Scoring Algorithm
- **REQ-025**: Calculate skills coverage percentage
- **REQ-026**: Assess experience relevance and duration
- **REQ-027**: Evaluate language proficiency match
- **REQ-028**: Generate composite score (0-100)
- **REQ-029**: Provide detailed score breakdown

#### 4.3.2 Results Presentation
- **REQ-030**: Rank candidates by overall score
- **REQ-031**: Apply colour coding (green ≥80, amber 60-79, red <60)
- **REQ-032**: Enable filtering and sorting options
- **REQ-033**: Show missing skills analysis
- **REQ-034**: Export results to CSV/Excel/PDF

### 4.4 Content Generation Module

#### 4.4.1 CV Rewriting
- **REQ-035**: Generate rewritten CV content in target language
- **REQ-036**: Apply Randstad branding template
- **REQ-037**: Optimise content for specific client requirements
- **REQ-038**: Maintain factual accuracy (no fabrication)
- **REQ-039**: Enforce UK English spelling for English output

#### 4.4.2 Quality Control
- **REQ-040**: Flag AI-generated content for human review
- **REQ-041**: Enable manual editing of generated content
- **REQ-042**: Require explicit approval before finalisation
- **REQ-043**: Track approval status and history

#### 4.4.3 File Management
- **REQ-044**: Generate PDFs with standard naming convention
- **REQ-045**: Store generated files with metadata
- **REQ-046**: Maintain version history of generated content

### 4.5 System Integration

#### 4.5.1 Contact Management
- **REQ-047**: Generate mailto: and tel: links from candidate data
- **REQ-048**: Store recruiter notes per candidate
- **REQ-049**: Export complete candidate packages

#### 4.5.2 Data Management
- **REQ-050**: Implement automated backups
- **REQ-051**: Provide GDPR compliance tools (export, deletion)
- **REQ-052**: Maintain audit trails for all operations

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements
- **NFR-001**: CV upload and parsing < 5 seconds for files ≤ 5MB
- **NFR-002**: Matching queries < 800ms (p95) for 1,000 CVs
- **NFR-003**: Index rebuilds < 2 seconds for full dataset
- **NFR-004**: PDF generation < 10 seconds per document

### 5.2 Scalability Requirements
- **NFR-005**: Support up to 1,000 CVs maximum
- **NFR-006**: Handle concurrent users (up to 10)
- **NFR-007**: Graceful degradation under load

### 5.3 Usability Requirements
- **NFR-008**: Clean 4-tab interface (CVs, Profiles, Matches, Rewriting)
- **NFR-009**: Responsive design for desktop and tablet
- **NFR-010**: Keyboard navigation support
- **NFR-011**: Progress indicators for long operations

### 5.4 Security Requirements
- **NFR-012**: At-rest encryption for sensitive data
- **NFR-013**: GDPR compliance for data handling
- **NFR-014**: Secure API endpoints with authentication
- **NFR-015**: Audit logging for all data operations

### 5.5 Reliability Requirements
- **NFR-016**: 99% uptime during business hours
- **NFR-017**: Automatic recovery from parsing failures
- **NFR-018**: Data consistency through atomic operations
- **NFR-019**: Backup and restore capabilities

### 5.6 Maintainability Requirements
- **NFR-020**: Modular architecture for easy updates
- **NFR-021**: Comprehensive error logging
- **NFR-022**: Automated testing coverage > 80%
- **NFR-023**: Clear documentation and code comments

---

## 6. Technical Architecture

### 6.1 System Architecture
The application follows a **modular monolith** pattern with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│              Frontend Layer             │
│         (Next.js + TailwindCSS)         │
└─────────────────┬───────────────────────┘
                  │ HTTP/REST
┌─────────────────▼───────────────────────┐
│              API Gateway                │
│           (Express Routes)              │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           Business Logic Layer          │
│  ┌─────────────────────────────────────┐ │
│  │  Parser  │ Normaliser │ Matcher     │ │
│  │ Service  │  Service   │ Service     │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │   i18n   │ Rewriter  │ Indexer     │ │
│  │ Service  │ Service   │ Service     │ │
│  └─────────────────────────────────────┘ │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│             Data Layer                  │
│         (Filesystem + JSON)             │
└─────────────────────────────────────────┘
```

### 6.2 Service Architecture
Each service follows the **single responsibility principle**:

- **Parser Service**: File upload and content extraction
- **Normaliser Service**: Data standardisation and skill mapping
- **i18n Service**: Language detection and translation
- **Matcher Service**: Candidate scoring and ranking
- **Rewriter Service**: Content generation and optimisation
- **Indexer Service**: Search index management

### 6.3 Data Flow Architecture
```
CV Upload → Parse → Normalise → Index → Match → Rewrite → Export
    ↓         ↓        ↓          ↓      ↓        ↓        ↓
 Raw JSON → Skills → Multi-lang → Fast → Scores → PDF → Package
```

---

## 7. Data Model

### 7.1 Core Entities

#### 7.1.1 Candidate Entity
```typescript
interface Candidate {
  id: string;                    // UUID
  contacts: ContactInfo;
  sourceLanguage: Language;
  targets: TargetBundle[];       // Parallel language versions
  uncertainties: UncertaintyFlag[];
  paths: AssetPaths;
  audit: AuditInfo;
}
```

#### 7.1.2 Target Bundle (Language-specific)
```typescript
interface TargetBundle {
  targetLanguage: Language;
  skills: SkillItem[];
  experiences: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  hobbies: string[];
  motivations: string;
}
```

#### 7.1.3 Skill Item
```typescript
interface SkillItem {
  canonical: string;             // Standardised name
  aliases: string[];             // Alternative names found
  level: SkillLevel;             // Beginner/Intermediate/Advanced
  implied: boolean;              // Inferred from other skills
  evidenceRefs: string[];        // References to supporting evidence
}
```

#### 7.1.4 Search Profile
```typescript
interface SearchProfile {
  id: string;
  name: string;
  targetLanguage: Language;
  requiredSkills: string[];
  optionalSkills: string[];
  minYears?: number;
  languagesRequired: LanguageRequirement[];
  certifications: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 7.2 Storage Structure
```
storage/
├── assets/
│   ├── originals/{uuid}/       # Uploaded CV files
│   └── generated/{uuid}/       # Generated PDFs
├── raw-extract/               # Raw parsing results
│   └── {uuid}.raw.json
├── candidates/                # Normalised candidate data
│   └── {uuid}.json
├── profiles/                  # Search profiles
│   └── {uuid}.json
├── results/                   # Match results
│   └── match-{profile}-{date}.json
├── indices/                   # Search indices
│   ├── skills.index.json
│   ├── text.index.json
│   └── meta.json
└── backups/                   # System backups
    └── snapshot-{date}.tar.gz
```

---

## 8. API Specification

### 8.1 RESTful Endpoints

#### 8.1.1 CV Management
```
POST   /api/cv/upload           # Upload CV file
GET    /api/cv/{id}            # Get CV details
PUT    /api/cv/{id}            # Update CV metadata
DELETE /api/cv/{id}            # Delete CV
POST   /api/cv/{id}/normalise  # Trigger normalisation
```

#### 8.1.2 Profile Management
```
GET    /api/profiles           # List all profiles
POST   /api/profiles           # Create new profile
GET    /api/profiles/{id}      # Get profile details
PUT    /api/profiles/{id}      # Update profile
DELETE /api/profiles/{id}      # Delete profile
```

#### 8.1.3 Matching
```
POST   /api/match             # Run matching query
GET    /api/match/{id}        # Get match results
POST   /api/match/export      # Export match results
```

#### 8.1.4 Rewriting
```
POST   /api/rewrite/{cvId}    # Generate rewritten CV
GET    /api/rewrite/{id}      # Get rewrite status
PUT    /api/rewrite/{id}/approve # Approve rewritten content
```

### 8.2 Request/Response Formats

#### 8.2.1 Upload Response
```json
{
  "id": "uuid-123",
  "filename": "cv.pdf",
  "status": "uploaded",
  "paths": {
    "original": "assets/originals/uuid-123/cv.pdf"
  }
}
```

#### 8.2.2 Match Results
```json
{
  "profileId": "profile-456",
  "results": [
    {
      "candidateId": "uuid-123",
      "scoreTotal": 85,
      "scoreBreakdown": {
        "skills": 90,
        "experience": 80,
        "languages": 85
      },
      "flags": ["missing-certification"]
    }
  ]
}
```

---

## 9. User Interface Design

### 9.1 Navigation Structure
The application uses a **tab-based navigation** with four main sections:

1. **CVs Tab**: Upload, view, and manage CV collection
2. **Profiles Tab**: Create and manage search profiles
3. **Matches Tab**: Run queries and view ranked results
4. **Rewriting Tab**: Review and approve generated content

### 9.2 Key Interface Components

#### 9.2.1 CV Upload Interface
- **Drag-and-drop zone** for file uploads
- **Progress indicators** for parsing operations
- **Preview panel** with original/JSON views
- **Metadata editing** for contact details

#### 9.2.2 Matching Interface
- **Profile selector** with target language
- **Results table** with sortable columns
- **Score visualisation** with colour coding
- **Export options** (CSV, Excel, PDF)

#### 9.2.3 Rewriting Interface
- **Side-by-side comparison** (original vs rewritten)
- **Approval workflow** with review status
- **Manual editing** capabilities
- **PDF preview** before finalisation

---

## 10. Implementation Roadmap

### 10.1 Phase 1: Core Infrastructure (Weeks 1-4)
**Deliverables**:
- [ ] Repository setup with documentation
- [ ] Basic Next.js frontend with 4 tabs
- [ ] Express.js backend with routing structure
- [ ] File upload and storage system
- [ ] Basic CV parsing (PDF/DOCX/TXT)

**Acceptance Criteria**:
- Can upload CV files and store them
- Basic text extraction working
- Navigation between tabs functional

### 10.2 Phase 2: Normalisation Engine (Weeks 5-8)
**Deliverables**:
- [ ] Skills canonicalisation system
- [ ] Experience parsing and structuring
- [ ] Language detection service
- [ ] Basic translation capabilities
- [ ] Search indexing system

**Acceptance Criteria**:
- Skills are mapped to canonical forms
- Multi-language content is structured correctly
- Basic search functionality works

### 10.3 Phase 3: Matching System (Weeks 9-12)
**Deliverables**:
- [ ] Profile creation interface
- [ ] Scoring algorithm implementation
- [ ] Results visualisation
- [ ] Export functionality
- [ ] Performance optimisation

**Acceptance Criteria**:
- Can create and save search profiles
- Matching produces ranked results with scores
- Results can be exported in multiple formats

### 10.4 Phase 4: Content Generation (Weeks 13-16)
**Deliverables**:
- [ ] AI integration (Claude/ChatGPT)
- [ ] CV rewriting templates
- [ ] Approval workflow
- [ ] PDF generation system
- [ ] Quality assurance tools

**Acceptance Criteria**:
- Can generate rewritten CVs
- Human approval workflow functional
- PDF output matches brand standards

### 10.5 Phase 5: Production Readiness (Weeks 17-20)
**Deliverables**:
- [ ] GDPR compliance tools
- [ ] Backup and restore system
- [ ] Performance monitoring
- [ ] User documentation
- [ ] Deployment automation

**Acceptance Criteria**:
- System meets all non-functional requirements
- Documentation is complete
- Deployment is automated and reliable

---

## 11. Risk Assessment

### 11.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CV parsing failures | Medium | High | Implement fallback manual tagging |
| AI hallucination | High | Medium | Mandatory human approval process |
| Performance degradation | Medium | Medium | Implement caching and indexing |
| Data corruption | Low | High | Atomic writes and regular backups |

### 11.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| GDPR compliance issues | Low | High | Built-in compliance tools |
| User adoption challenges | Medium | Medium | User training and documentation |
| Scope creep | High | Medium | Clear requirements documentation |
| Resource constraints | Medium | High | Phased implementation approach |

---

## 12. Acceptance Criteria

### 12.1 Functional Acceptance

#### 12.1.1 CV Processing
- [ ] Successfully parse 95% of uploaded CVs
- [ ] Extract personal information with 90% accuracy
- [ ] Identify technical skills with 85% accuracy
- [ ] Support all specified input languages

#### 12.1.2 Matching Performance
- [ ] Generate match scores within defined timeframes
- [ ] Provide transparent score breakdowns
- [ ] Handle edge cases gracefully
- [ ] Export results in required formats

#### 12.1.3 Content Quality
- [ ] Rewritten CVs maintain factual accuracy
- [ ] UK English spelling enforced consistently
- [ ] Generated content requires human approval
- [ ] PDF output meets brand standards

### 12.2 Non-Functional Acceptance

#### 12.2.1 Performance
- [ ] Upload processing < 5 seconds
- [ ] Matching queries < 800ms (p95)
- [ ] Support up to 1,000 CVs
- [ ] Handle 10 concurrent users

#### 12.2.2 Usability
- [ ] Interface is intuitive for target users
- [ ] All features accessible via keyboard
- [ ] Responsive design works on tablets
- [ ] Error messages are clear and actionable

#### 12.2.3 Security & Compliance
- [ ] Data encryption at rest
- [ ] GDPR export/deletion tools
- [ ] Audit trails for all operations
- [ ] Secure API authentication

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|---------|---------|
| 1.0 | 08 Sep 2025 | Development Team | Initial specification |

**Review Schedule**: Weekly during development  
**Approval Authority**: Project Stakeholders  
**Next Review Date**: 15 Sep 2025