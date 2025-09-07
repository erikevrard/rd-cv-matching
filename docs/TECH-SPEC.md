# Technical Specification — CV Matching Tool
**Project:** Randstad Digital Belgium — CV Matching Tool  
**Version:** 1.0  
**Date:** 07 September 2025  

---

## 1. Overview
The CV Matching Tool ingests, normalises, analyses, and rewrites CVs. It matches candidates with client profiles based on skills, experiences, and job requirements.  

- Scope: ≤1,000 CVs (no database, filesystem-only storage)  
- Data: JSON documents + PDFs in `storage/`  
- Output: Standardised CVs in Randstad template (multi-language, UK English by default)  

---

## 2. Objectives
1. Standardise incoming CVs (formats, languages).  
2. Normalise skills, experiences, and job titles into JSON.  
3. Match CVs against search profiles with scoring + visualisation.  
4. Rewrite CVs into branded templates.  
5. Provide human-in-the-loop approval.  
6. Ensure GDPR compliance and lightweight tech design.  

---

## 3. User Roles
- **Recruiter/Consultant:** Upload, create profiles, review matches, curate rewrites.  
- **Administrator:** Manage users, configs, and AI connectors.  

---

## 4. Functional Requirements

### 4.1 CV Management
- Upload PDF/DOCX/TXT → parse → JSON skeleton.  
- Store source + translated target versions.  
- Support Dutch, French, English, German, Romanian, Portuguese.  
- Flag uncertainties.  

### 4.2 Search Profiles
- Define required/optional skills, languages, certs.  
- Multi-language queries.  
- Cross-link skills ↔ experience.  

### 4.3 Matching & Visualisation
- Ranked results with score breakdown.  
- Colour-coded indicators.  
- Export to CSV/Excel/PDF.  

### 4.4 CV Rewriting
- Rewrite into Randstad template.  
- UK English enforced.  
- Parallel language rewrites.  
- File naming: `[Candidate]_[SkillCluster]_[Profile]_[Lang]_[Date].pdf`  

### 4.5 Human Curation
- Recruiter must approve rewrites.  
- Manual edits allowed.  
- Highlight AI-uncertain sections.  

### 4.6 Contact & Follow-up
- Direct mailto/tel links.  
- Recruiter notes.  
- Export candidate package.  

---

## 5. Non-Functional Requirements
- Usability: 4-tab UI (CVs, Profiles, Matches, Rewriting).  
- Performance: <5s upload/parse, match <800ms p95.  
- Capacity: ≤1,000 CVs.  
- Security: AES-256 at rest, GDPR.  
- Deployment: Replit, Mac, Vercel.  

---

## 6. Tech Stack
- **Frontend:** Next.js + TailwindCSS, Recharts for viz.  
- **Backend:** Node.js (Express, TypeScript).  
- **Parsing:** pdf-parse, mammoth, docx4js.  
- **AI connectors:** Claude, ChatGPT, Gemini.  
- **Storage:** JSON on filesystem.  
- **Export:** Puppeteer → PDF.  

---

## 7. Roadmap
**Phase 1:** Parser, normaliser, manual profiles, basic matching.  
**Phase 2:** AI-assisted normalisation, multilingual support, viz.  
**Phase 3:** Polished rewriting, GDPR tooling, client dashboard.  

---

## 8. Risks
- Parsing errors → manual fallback.  
- AI hallucinations → mandatory human approval.  
- Translation quirks → QC pipeline.  
