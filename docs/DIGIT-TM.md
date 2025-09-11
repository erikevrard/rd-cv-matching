# DIGIT-TM Integration Specification

**Project**: Randstad Digital Belgium - CV Matching Tool  
**Version**: 1.1  
**Date**: 11 September 2025  
**Related Documents**: [Technical Specification](./TECH-SPEC.md), [Data Model](./DATA-MODEL.md)

---

## Table of Contents

1. [DIGIT-TM Export Overview](#1-digit-tm-export-overview)
2. [Master Keyword System](#2-master-keyword-system)
3. [Cross-Reference Mapping](#3-cross-reference-mapping)
4. [Export Implementation](#4-export-implementation)
5. [Data Structure Extensions](#5-data-structure-extensions)
6. [API Endpoints](#6-api-endpoints)
7. [Validation Rules](#7-validation-rules)

---

## 1. DIGIT-TM Export Overview

### 1.1 Purpose
The DG DIGIT Time & Means (TM) format is a standardised CV format used by the European Commission for contractor evaluation. It requires:

- **Structured skill cataloguing** with cross-references to project experiences
- **Competence ratings** (1-5 scale) for each technology
- **Duration tracking** in months for each skill per project
- **Canonical keyword mapping** to standardised terminology
- **Project cross-referencing** between skills and evidence

### 1.2 Export Formats
- **PDF Format**: Human-readable CV in DIGIT-TM layout
- **Word Format**: Editable template for final adjustments
- **JSON Format**: Structured data for system integration

### 1.3 Key Requirements
- All skills must map to canonical DIGIT-TM keywords
- Experience duration must be calculated in months
- Competence levels must be justified by project evidence
- Cross-references must be validated for consistency

---

## 2. Master Keyword System

### 2.1 Keyword Structure

```typescript
interface DIGITKeywordEntry {
  // From your provided data structure
  keyword: string;                    // "Spring Boot", "Java 17", "English C1"
  category: string;                   // "Framework/Library", "Programming Language"
  baseTechnology: string;             // "Spring Boot", "Java", "English"
  version: string | null;             // "3.x", "17", "C1"
  versionGroup: string;               // "Spring Ecosystem", "Java (All Versions)"
  
  // Additional fields for CV processing
  implies: string[];                  // ["Spring Framework", "Java", "Maven"]
  requires: string[];                 // Prerequisites for this skill
  aliases: string[];                  // ["SpringBoot", "Spring-Boot"]
  competenceMapping: {
    beginner: string;                 // Description for level 1-2
    intermediate: string;             // Description for level 3
    advanced: string;                 // Description for level 4-5
  };
}
```

### 2.2 Master Data Files

#### storage/master-data/digit-keywords.json
```json
{
  "version": "DIGIT-TM-II-2025",
  "lastUpdated": "2025-09-08T10:00:00Z",
  "source": "DG DIGIT Time & Means II",
  "keywords": [
    {
      "keyword": "Spring Boot",
      "category": "Framework/Library",
      "baseTechnology": "Spring Boot",
      "version": null,
      "versionGroup": "Spring Ecosystem",
      "implies": ["Spring Framework", "Java", "Maven"],
      "requires": ["Java"],
      "aliases": ["SpringBoot", "Spring-Boot"],
      "competenceMapping": {
        "beginner": "Basic configuration and simple applications",
        "intermediate": "Custom configurations, REST APIs, database integration",
        "advanced": "Microservices architecture, custom starters, production optimization"
      }
    },
    {
      "keyword": "Java 17",
      "category": "Programming Language",
      "baseTechnology": "Java",
      "version": "17",
      "versionGroup": "Java (All Versions)",
      "implies": ["Java"],
      "requires": [],
      "aliases": ["Java17"],
      "competenceMapping": {
        "beginner": "Basic syntax and object-oriented concepts",
        "intermediate": "Collections, streams, exception handling",
        "advanced": "Concurrency, performance tuning, advanced language features"
      }
    }
  ],
  "stats": {
    "totalKeywords": 847,
    "categoriesCount": 12,
    "baseTechnologiesCount": 234,
    "versionGroupsCount": 187
  }
}
```

### 2.3 Skill Canonicalisation Service

```typescript
class DIGITSkillCanonicaliser {
  private keywords: Map<string, DIGITKeywordEntry>;
  
  async loadMasterKeywords(): Promise<void> {
    const data = await this.storage.read<DIGITKeywordMaster>('master-data/digit-keywords.json');
    this.keywords = new Map();
    
    data.keywords.forEach(keyword => {
      // Map exact matches
      this.keywords.set(keyword.keyword.toLowerCase(), keyword);
      
      // Map aliases
      keyword.aliases.forEach(alias => {
        this.keywords.set(alias.toLowerCase(), keyword);
      });
    });
  }
  
  canonicaliseSkill(inputSkill: string): DIGITSkillMatch | null {
    const normalised = inputSkill.toLowerCase().trim();
    
    // Direct match
    const direct = this.keywords.get(normalised);
    if (direct) {
      return {
        canonical: direct.keyword,
        baseTechnology: direct.baseTechnology,
        category: direct.category,
        versionGroup: direct.versionGroup,
        confidence: 1.0
      };
    }
    
    // Fuzzy matching for close variants
    return this.fuzzyMatch(inputSkill);
  }
  
  getImpliedSkills(canonicalSkill: string): string[] {
    const entry = this.findByCanonical(canonicalSkill);
    return entry?.implies || [];
  }
}
```

---

## 3. Cross-Reference Mapping

### 3.1 Enhanced Experience Data Structure

```typescript
interface DIGITExperienceItem extends ExperienceItem {
  /** Unique reference ID for DIGIT-TM cross-referencing */
  digitReferenceId: string;           // "1", "2", "3" etc.
  
  /** Skill evidences with competence levels */
  skillEvidences: DIGITSkillEvidence[];
  
  /** Calculated total duration for this project */
  effectiveDurationMonths: number;
}

interface DIGITSkillEvidence {
  /** Canonical DIGIT-TM skill name */
  canonicalSkill: string;
  
  /** Competence level (1-5) */
  competenceLevel: number;
  
  /** Duration in months for this skill in this project */
  durationMonths: number;
  
  /** Specific evidence bullets */
  evidenceText: string[];
  
  /** Auto-generated or manually verified */
  source: 'extracted' | 'inferred' | 'manual';
}
```

### 3.2 Cross-Reference Generator

```typescript
class DIGITCrossReferenceMapper {
  generateProjectReferences(candidate: Candidate): DIGITProjectReference[] {
    const references: DIGITProjectReference[] = [];
    
    candidate.targets.forEach(target => {
      target.experiences.forEach((exp, index) => {
        const refId = (index + 1).toString();
        
        references.push({
          referenceId: refId,
          projectName: this.extractProjectName(exp),
          company: exp.company,
          role: exp.role,
          startDate: exp.startDate,
          endDate: exp.endDate,
          duration: this.calculateDuration(exp.startDate, exp.endDate),
          skillsUsed: exp.skillEvidences.map(se => se.canonicalSkill),
          description: exp.bullets.join(' ')
        });
      });
    });
    
    return references;
  }
  
  mapSkillsToProjects(candidate: Candidate): DIGITSkillProjectMapping[] {
    const mappings: DIGITSkillProjectMapping[] = [];
    const skillDurations = new Map<string, number>();
    
    candidate.targets.forEach(target => {
      target.experiences.forEach((exp, projectIndex) => {
        exp.skillEvidences.forEach(evidence => {
          const existing = mappings.find(m => m.canonicalSkill === evidence.canonicalSkill);
          
          if (existing) {
            existing.projectReferences.push((projectIndex + 1).toString());
            existing.totalDurationMonths += evidence.durationMonths;
            existing.maxCompetenceLevel = Math.max(existing.maxCompetenceLevel, evidence.competenceLevel);
          } else {
            mappings.push({
              canonicalSkill: evidence.canonicalSkill,
              totalDurationMonths: evidence.durationMonths,
              maxCompetenceLevel: evidence.competenceLevel,
              projectReferences: [(projectIndex + 1).toString()],
              evidencePoints: evidence.evidenceText
            });
          }
        });
      });
    });
    
    return mappings;
  }
}
```

---

## 4. Export Implementation

### 4.1 DIGIT-TM Export Service

```typescript
class DIGITExportService {
  async exportToDIGITFormat(
    candidateId: string, 
    format: 'pdf' | 'docx' | 'json'
  ): Promise<DIGITExportResult> {
    
    // Load candidate data
    const candidate = await this.storage.loadCandidate(candidateId);
    
    // Generate cross-references
    const projectRefs = this.crossRefMapper.generateProjectReferences(candidate);
    const skillMappings = this.crossRefMapper.mapSkillsToProjects(candidate);
    
    // Build DIGIT-TM structure
    const digitData: DIGITExportData = {
      candidateInfo: this.buildCandidateInfo(candidate),
      professionalExperience: this.buildProfessionalExperience(candidate, skillMappings),
      projectExperiences: this.buildProjectExperiences(projectRefs),
      softwareExpertise: this.buildSoftwareExpertise(skillMappings),
      trainingPage: this.buildTrainingPage(candidate),
      languageProficiency: this.buildLanguageProficiency(candidate)
    };
    
    // Generate output
    switch (format) {
      case 'pdf':
        return this.generatePDF(digitData);
      case 'docx':
        return this.generateWord(digitData);
      case 'json':
        return { format: 'json', data: digitData, filePath: null };
    }
  }
  
  private buildSoftwareExpertise(skillMappings: DIGITSkillProjectMapping[]): DIGITSoftwareExpertiseItem[] {
    return skillMappings.map((mapping, index) => ({
      id: index + 1,
      tool: mapping.canonicalSkill,
      competence: mapping.maxCompetenceLevel,
      duration: mapping.totalDurationMonths,
      description: mapping.projectReferences.join(', '),
      projectReferences: mapping.projectReferences
    }));
  }
  
  private async generatePDF(data: DIGITExportData): Promise<DIGITExportResult> {
    const template = await this.loadTemplate('digit-tm-template.html');
    const html = this.renderTemplate(template, data);
    
    const pdf = await this.puppeteer.createPDF(html, {
      format: 'A4',
      margin: { top: '2cm', right: '1.5cm', bottom: '2cm', left: '1.5cm' }
    });
    
    const filename = this.generateFilename(data.candidateInfo, 'pdf');
    const filePath = await this.storage.saveAsset(filename, pdf);
    
    return {
      format: 'pdf',
      data,
      filePath,
      filename
    };
  }
}
```

### 4.2 Template Structure

#### DIGIT-TM HTML Template (templates/digit-tm-template.html)
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>DIGIT-TM CV - {{candidateInfo.firstName}} {{candidateInfo.surname}}</title>
    <style>
        /* DIGIT-TM specific styling */
        body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.2; }
        .header { border: 2px solid #000; padding: 10px; margin-bottom: 10px; }
        .section-title { font-weight: bold; text-transform: uppercase; margin-top: 15px; }
        .project-ref { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 5px 0; }
        td, th { border: 1px solid #000; padding: 5px; vertical-align: top; }
        .page-break { page-break-before: always; }
    </style>
</head>
<body>
    <!-- CV Front Page -->
    <div class="header">
        <h1>DIGIT-TM II – CV Form for Time & Means services</h1>
        <h2>CV FRONT PAGE</h2>
    </div>
    
    <table>
        <tr>
            <td><strong>Surname, first name:</strong></td>
            <td>{{candidateInfo.surname}}, {{candidateInfo.firstName}}</td>
        </tr>
        <tr>
            <td><strong>Date of last update:</strong></td>
            <td>{{candidateInfo.dateOfLastUpdate}}</td>
        </tr>
        <!-- Continue with all DIGIT-TM fields... -->
    </table>
    
    <!-- Professional Experience Section -->
    <div class="section-title">Professional Experience</div>
    <table>
        <tr>
            <td><strong>Date IT career started:</strong></td>
            <td>{{professionalExperience.dateITCareerStarted}}</td>
        </tr>
        <tr>
            <td><strong>Number of years/months of experience:</strong></td>
            <td>{{professionalExperience.totalExperienceFormatted}}</td>
        </tr>
        <tr>
            <td><strong>Specific expertise(s) (with number of months experience for each):</strong></td>
            <td>
                {{#each professionalExperience.specificExpertise}}
                {{skill}} ({{durationMonths}} months){{#unless @last}}, {{/unless}}
                {{/each}}
            </td>
        </tr>
    </table>
    
    <!-- Software Expertise Page -->
    <div class="page-break"></div>
    <h2>CV software expertise page</h2>
    <p>CV software expertise page number for this CV: 1</p>
    
    <table>
        <thead>
            <tr>
                <th>Tool (when possible precise manufacturer, product name and version(s))</th>
                <th>Competence (rating: 1-5)</th>
                <th>Duration (in months)</th>
                <th>Description (reference to relevant entries under "professional experience" is mandatory)</th>
            </tr>
        </thead>
        <tbody>
            {{#each softwareExpertise}}
            <tr>
                <td>{{id}}</td>
                <td>{{tool}}</td>
                <td>{{competence}}</td>
                <td>{{duration}}</td>
                <td>{{description}}</td>
            </tr>
            {{/each}}
        </tbody>
    </table>
    
    <!-- Project Experience Pages -->
    {{#each projectExperiences}}
    <div class="page-break"></div>
    <h2>CV professional experience page</h2>
    <p>CV experience page number for this CV: {{@index}}</p>
    
    <table>
        <tr><td colspan="2"><strong>PROJECT EXPERIENCE</strong></td></tr>
        <tr>
            <td><strong>Project name:</strong></td>
            <td>{{projectName}}</td>
        </tr>
        <tr>
            <td><strong>Company (employer):</strong></td>
            <td>{{company}}</td>
        </tr>
        <tr>
            <td><strong>Dates (start-end):</strong></td>
            <td>{{startDate}} – {{endDate}}</td>
        </tr>
        <tr>
            <td><strong>Effective number of months achieved:</strong></td>
            <td>{{effectiveMonths}} months</td>
        </tr>
        <tr>
            <td><strong>Client (customer):</strong></td>
            <td>{{client}}</td>
        </tr>
        <tr>
            <td><strong>Project size:</strong></td>
            <td>{{projectSize}}</td>
        </tr>
        <tr>
            <td><strong>Project description:</strong></td>
            <td>{{description}}</td>
        </tr>
        <tr>
            <td><strong>External service provider's roles & responsibilities in the project:</strong></td>
            <td>{{rolesResponsibilities}}</td>
        </tr>
        <tr>
            <td><strong>Technologies and methodologies used by the external service provider in the project:</strong></td>
            <td>{{#each technologies}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</td>
        </tr>
    </table>
    {{/each}}
</body>
</html>
```

---

## 5. Data Structure Extensions

### 5.1 Enhanced Candidate Schema

```json
{
  "id": "candidate-uuid",
  "contacts": {
    "name": "John Doe",
    "email": "john@example.com",
    "dateOfBirth": "1985-03-15",
    "nationality": "Belgian"
  },
  "sourceLanguage": "en",
  "targets": [
    {
      "targetLanguage": "en",
      "skills": [
        {
          "canonical": "Spring Boot",
          "aliases": ["SpringBoot"],
          "level": "Advanced",
          "implied": false,
          "evidenceRefs": ["exp:0:skill:spring-boot"],
          "digitMapping": {
            "keyword": "Spring Boot",
            "category": "Framework/Library",
            "baseTechnology": "Spring Boot",
            "versionGroup": "Spring Ecosystem"
          }
        }
      ],
      "experiences": [
        {
          "company": "TechCorp",
          "role": "Senior Developer",
          "startDate": "2020-01",
          "endDate": "2023-06",
          "bullets": ["Developed microservices with Spring Boot"],
          "techStack": ["Spring Boot", "Java", "PostgreSQL"],
          "digitReferenceId": "1",
          "effectiveDurationMonths": 42,
          "skillEvidences": [
            {
              "canonicalSkill": "Spring Boot",
              "competenceLevel": 4,
              "durationMonths": 42,
              "evidenceText": ["Developed microservices with Spring Boot"],
              "source": "extracted"
            }
          ]
        }
      ]
    }
  ],
  "digitExport": {
    "lastExported": "2025-09-08T10:00:00Z",
    "professionalCareerStart": "2018-06-01",
    "totalITExperienceMonths": 84,
    "proposedLevel": 7
  }
}
```

### 5.2 Master Data Loading Service

```typescript
class MasterDataService {
  private digitKeywords: Map<string, DIGITKeywordEntry>;
  private skillMappings: Map<string, string[]>;
  private impliedSkills: Map<string, string[]>;
  
  async initialize(): Promise<void> {
    await Promise.all([
      this.loadDIGITKeywords(),
      this.loadSkillMappings(),
      this.loadImpliedSkills(),
      this.loadLanguageMappings()
    ]);
  }
  
  async loadDIGITKeywords(): Promise<void> {
    const data = await this.storage.read<DIGITKeywordMaster>('master-data/digit-keywords.json');
    this.digitKeywords = new Map();
    
    data.keywords.forEach(keyword => {
      this.digitKeywords.set(keyword.keyword.toLowerCase(), keyword);
      keyword.aliases.forEach(alias => {
        this.digitKeywords.set(alias.toLowerCase(), keyword);
      });
    });
  }
  
  getDIGITKeyword(skill: string): DIGITKeywordEntry | null {
    return this.digitKeywords.get(skill.toLowerCase()) || null;
  }
  
  getImpliedSkills(skill: string): string[] {
    return this.impliedSkills.get(skill.toLowerCase()) || [];
  }
  
  async updateMasterData(source: 'digit-tm-ii' | 'digit-tm-iii'): Promise<void> {
    // Update master data from external source
    const updates = await this.fetchLatestKeywords(source);
    await this.mergeMasterData(updates);
    await this.rebuildIndices();
  }
}
```

---

## 6. API Endpoints

### 6.1 DIGIT-TM Export Endpoints

```typescript
// GET /api/digit-tm/keywords
// Returns the master keyword list
app.get('/api/digit-tm/keywords', async (req, res) => {
  const keywords = await masterDataService.getDIGITKeywords();
  res.json({
    success: true,
    data: {
      version: keywords.version,
      totalKeywords: keywords.keywords.length,
      categories: [...new Set(keywords.keywords.map(k => k.category))],
      keywords: keywords.keywords
    }
  });
});

// POST /api/digit-tm/export/:candidateId
// Export candidate in DIGIT-TM format
app.post('/api/digit-tm/export/:candidateId', async (req, res) => {
  const { candidateId } = req.params;
  const { format = 'pdf', language = 'en' } = req.body;
  
  try {
    const result = await digitExportService.exportToDIGITFormat(
      candidateId, 
      format,
      language
    );
    
    res.json({
      success: true,
      data: {
        format: result.format,
        filename: result.filename,
        filePath: result.filePath,
        downloadUrl: `/api/assets/download/${result.filename}`
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'DIGIT_EXPORT_FAILED',
        message: error.message
      }
    });
  }
});

// POST /api/digit-tm/validate/:candidateId
// Validate candidate data for DIGIT-TM export
app.post('/api/digit-tm/validate/:candidateId', async (req, res) => {
  const { candidateId } = req.params;
  
  const validation = await digitExportService.validateForExport(candidateId);
  
  res.json({
    success: true,
    data: {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      completeness: validation.completeness,
      missingSkillMappings: validation.missingSkillMappings
    }
  });
});

// PUT /api/digit-tm/skill-mapping
// Update skill to DIGIT keyword mapping
app.put('/api/digit-tm/skill-mapping', async (req, res) => {
  const { originalSkill, digitKeyword, competenceLevel } = req.body;
  
  await masterDataService.updateSkillMapping(originalSkill, digitKeyword, competenceLevel);
  
  res.json({
    success: true,
    message: 'Skill mapping updated successfully'
  });
});
```

### 6.2 Frontend Integration

```typescript
// Frontend service for DIGIT-TM operations
class DIGITExportService {
  async exportCandidate(candidateId: string, format: 'pdf' | 'docx' | 'json'): Promise<ExportResult> {
    const response = await apiClient.post(`/api/digit-tm/export/${candidateId}`, { format });
    return response.data;
  }
  
  async validateCandidate(candidateId: string): Promise<ValidationResult> {
    const response = await apiClient.post(`/api/digit-tm/validate/${candidateId}`);
    return response.data;
  }
  
  async getKeywordSuggestions(skill: string): Promise<DIGITKeywordEntry[]> {
    const response = await apiClient.get(`/api/digit-tm/keywords/search?q=${encodeURIComponent(skill)}`);
    return response.data.keywords;
  }
}

// React component for DIGIT-TM export
const DIGITExportPanel: React.FC<{ candidateId: string }> = ({ candidateId }) => {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [exporting, setExporting] = useState(false);
  
  const handleExport = async (format: 'pdf' | 'docx') => {
    setExporting(true);
    try {
      const result = await digitService.exportCandidate(candidateId, format);
      // Trigger download
      window.open(result.downloadUrl, '_blank');
    } catch (error) {
      // Handle error
    } finally {
      setExporting(false);
    }
  };
  
  const handleValidate = async () => {
    const result = await digitService.validateCandidate(candidateId);
    setValidation(result);
  };
  
  return (
    <div className="digit-export-panel">
      <h3>DIGIT-TM Export</h3>
      
      <button onClick={handleValidate} className="btn-secondary">
        Validate for DIGIT-TM
      </button>
      
      {validation && (
        <div className="validation-results">
          <div className={`status ${validation.isValid ? 'valid' : 'invalid'}`}>
            {validation.isValid ? 'Ready for export' : 'Validation issues found'}
          </div>
          
          {validation.errors.length > 0 && (
            <div className="errors">
              <h4>Errors:</h4>
              <ul>
                {validation.errors.map((error, i) => (
                  <li key={i} className="error">{error}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validation.warnings.length > 0 && (
            <div className="warnings">
              <h4>Warnings:</h4>
              <ul>
                {validation.warnings.map((warning, i) => (
                  <li key={i} className="warning">{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      <div className="export-buttons">
        <button 
          onClick={() => handleExport('pdf')} 
          disabled={exporting || !validation?.isValid}
          className="btn-primary"
        >
          Export as PDF
        </button>
        
        <button 
          onClick={() => handleExport('docx')} 
          disabled={exporting || !validation?.isValid}
          className="btn-secondary"
        >
          Export as Word
        </button>
      </div>
    </div>
  );
};
```

---

## 7. Validation Rules

### 7.1 DIGIT-TM Export Validation

```typescript
class DIGITExportValidator {
  async validateCandidate(candidate: Candidate): Promise<DIGITValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingMappings: string[] = [];
    
    // Required fields validation
    if (!candidate.contacts.name) {
      errors.push('Candidate name is required');
    }
    
    if (!candidate.contacts.nationality) {
      errors.push('Nationality is required for DIGIT-TM export');
    }
    
    // Professional experience validation
    if (!candidate.digitExport?.professionalCareerStart) {
      errors.push('Professional career start date is required');
    }
    
    // Skill mappings validation
    const target = candidate.targets[0];
    if (target) {
      for (const skill of target.skills) {
        const digitMapping = this.masterData.getDIGITKeyword(skill.canonical);
        if (!digitMapping) {
          missingMappings.push(skill.canonical);
        }
      }
    }
    
    // Experience cross-references validation
    for (const experience of target?.experiences || []) {
      if (!experience.digitReferenceId) {
        errors.push(`Experience "${experience.company}" missing reference ID`);
      }
      
      if (experience.skillEvidences.length === 0) {
        warnings.push(`Experience "${experience.company}" has no skill evidences`);
      }
      
      // Validate competence levels
      for (const evidence of experience.skillEvidences) {
        if (evidence.competenceLevel < 1 || evidence.competenceLevel > 5) {
          errors.push(`Invalid competence level ${evidence.competenceLevel} for skill ${evidence.canonicalSkill}`);
        }
      }
    }
    
    // Completeness calculation
    const totalFields = 10; // Define based on DIGIT-TM requirements
    const completedFields = this.countCompletedFields(candidate);
    const completeness = (completedFields / totalFields) * 100;
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      missingSkillMappings: missingMappings,
      completeness: Math.round(completeness)
    };
  }
  
  private countCompletedFields(candidate: Candidate): number {
    let count = 0;
    
    if (candidate.contacts.name) count++;
    if (candidate.contacts.email) count++;
    if (candidate.contacts.nationality) count++;
    if (candidate.digitExport?.professionalCareerStart) count++;
    if (candidate.targets[0]?.skills.length > 0) count++;
    if (candidate.targets[0]?.experiences.length > 0) count++;
    // ... add more field checks
    
    return count;
  }
}
```

### 7.2 Implementation Checklist

**Phase 1: Master Data Setup**
- [ ] Create master-data directory structure
- [ ] Import DIGIT-TM keyword list from your Python data
- [ ] Implement keyword canonicalisation service
- [ ] Create skill implication rules
- [ ] Set up language proficiency mappings

**Phase 2: Data Structure Extensions**
- [ ] Extend ExperienceItem with digitReferenceId and skillEvidences
- [ ] Add DIGITExportData to candidate schema
- [ ] Create migration script for existing candidates
- [ ] Update normalisation service to generate DIGIT mappings

**Phase 3: Cross-Reference System**
- [ ] Implement cross-reference mapper
- [ ] Create competence level calculator
- [ ] Build project duration calculator
- [ ] Add evidence text extractor

**Phase 4: Export Implementation**
- [ ] Create DIGIT-TM HTML template
- [ ] Implement PDF export service
- [ ] Add Word document export
- [ ] Build validation service

**Phase 5: Frontend Integration**
- [ ] Add DIGIT-TM export panel to UI
- [ ] Create skill mapping interface
- [ ] Implement validation display
- [ ] Add export progress indicators

This comprehensive DIGIT-TM integration ensures your CV tool can export in the specialized format required by the European Commission while maintaining full traceability between skills and project evidence.