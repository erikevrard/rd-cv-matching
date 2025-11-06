// backend/routes/export.js - Export functionality
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const cvService = require('../services/cv-service');

// ============================================================================
// TEMPLATE MANAGEMENT
// ============================================================================

const TEMPLATES_DIR = path.join(__dirname, '../data/export-templates');
const EXPORTS_DIR = path.join(__dirname, '../data/exports');

// Ensure directories exist
async function ensureDirectories() {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
}

// Default templates configuration
const DEFAULT_TEMPLATES = [
    {
        id: 'eurostar',
        name: 'Eurostar Format',
        filename: 'eurostar_template.docx',
        description: 'Standard Eurostar CV format',
        isDefault: true
    },
    {
        id: 'randstad',
        name: 'Randstad Digital Belgium',
        filename: 'randstad_template.docx',
        description: 'Randstad Digital Belgium CV format',
        isDefault: true
    }
];

// GET /api/export/templates - List all templates
router.get('/templates', async (req, res) => {
    try {
        await ensureDirectories();
        
        const files = await fs.readdir(TEMPLATES_DIR);
        const templates = [];
        
        // Add default templates if they exist
        for (const template of DEFAULT_TEMPLATES) {
            const exists = files.includes(template.filename);
            if (exists) {
                const stats = await fs.stat(path.join(TEMPLATES_DIR, template.filename));
                templates.push({
                    ...template,
                    exists: true,
                    size: stats.size,
                    modifiedAt: stats.mtime
                });
            } else {
                templates.push({
                    ...template,
                    exists: false
                });
            }
        }
        
        // Add custom templates
        const customFiles = files.filter(f => 
            f.endsWith('.docx') && 
            !DEFAULT_TEMPLATES.some(t => t.filename === f)
        );
        
        for (const file of customFiles) {
            const stats = await fs.stat(path.join(TEMPLATES_DIR, file));
            templates.push({
                id: file.replace('.docx', ''),
                name: file.replace('.docx', '').replace(/_/g, ' '),
                filename: file,
                description: 'Custom template',
                isDefault: false,
                exists: true,
                size: stats.size,
                modifiedAt: stats.mtime
            });
        }
        
        res.json({ success: true, data: templates });
        
    } catch (error) {
        console.error('Error listing templates:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/export/templates/upload - Upload new template
router.post('/templates/upload', async (req, res) => {
    try {
        await ensureDirectories();
        
        // This would use multer in production
        // For now, return success structure
        res.json({ 
            success: true, 
            message: 'Template upload endpoint ready',
            note: 'Integrate with multer for file uploads'
        });
        
    } catch (error) {
        console.error('Error uploading template:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/export/templates/:templateId - Delete template
router.delete('/templates/:templateId', async (req, res) => {
    try {
        const { templateId } = req.params;
        
        // Prevent deletion of default templates
        const isDefault = DEFAULT_TEMPLATES.some(t => t.id === templateId);
        if (isDefault) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot delete default templates' 
            });
        }
        
        const filename = `${templateId}.docx`;
        const filePath = path.join(TEMPLATES_DIR, filename);
        
        await fs.unlink(filePath);
        
        res.json({ success: true, message: 'Template deleted successfully' });
        
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// EXPORT - DG DIGIT TM2 FORMAT
// ============================================================================

// POST /api/export/tm2 - Export to DG DIGIT TM2 format
router.post('/tm2', async (req, res) => {
    try {
        const { userId, cvId, targetLanguage } = req.body;
        
        if (!userId || !cvId) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId and cvId are required' 
            });
        }
        
        // Load CV data
        const cv = await cvService.getCVById(cvId, userId);
        if (!cv) {
            return res.status(404).json({ 
                success: false, 
                error: 'CV not found' 
            });
        }
        
        // Check if CV has parsed data
        const data = cv.detailedParsingData?.extractedData || 
                    cv.initialParsingData?.extractedData;
        
        if (!data) {
            return res.status(400).json({ 
                success: false, 
                error: 'CV has not been parsed yet. Please parse the CV first.' 
            });
        }
        
        // Generate TM2 format
        const tm2Content = generateTM2Format(cv, data, targetLanguage || 'en');
        
        // Save to exports directory
        await ensureDirectories();
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const candidateName = sanitizeFilename(
            data.fullName || data.candidate_full_name || 'Unknown'
        );
        const filename = `TM2_${candidateName}_${timestamp}.txt`;
        const exportPath = path.join(EXPORTS_DIR, filename);
        
        await fs.writeFile(exportPath, tm2Content, 'utf8');
        
        res.json({ 
            success: true, 
            data: {
                filename,
                path: exportPath,
                size: Buffer.byteLength(tm2Content, 'utf8'),
                downloadUrl: `/api/export/download/${filename}`
            }
        });
        
    } catch (error) {
        console.error('Error exporting to TM2:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// EXPORT - WORD TEMPLATE
// ============================================================================

// POST /api/export/word - Export using Word template
router.post('/word', async (req, res) => {
    try {
        const { userId, cvId, templateId, targetLanguage } = req.body;
        
        if (!userId || !cvId || !templateId) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId, cvId, and templateId are required' 
            });
        }
        
        await ensureDirectories();
        
        // Load CV data
        const cv = await cvService.getCVById(cvId, userId);
        if (!cv) {
            return res.status(404).json({ 
                success: false, 
                error: 'CV not found' 
            });
        }
        
        // Check if CV has parsed data
        const data = cv.detailedParsingData?.extractedData || 
                    cv.initialParsingData?.extractedData;
        
        if (!data) {
            return res.status(400).json({ 
                success: false, 
                error: 'CV has not been parsed yet. Please parse the CV first.' 
            });
        }
        
        // Find template
        const template = DEFAULT_TEMPLATES.find(t => t.id === templateId);
        const templateFilename = template ? template.filename : `${templateId}.docx`;
        const templatePath = path.join(TEMPLATES_DIR, templateFilename);
        
        // Check if template exists
        try {
            await fs.access(templatePath);
        } catch {
            return res.status(404).json({ 
                success: false, 
                error: `Template not found: ${templateFilename}. Please upload this template first.` 
            });
        }
        
        // Load template
        let templateContent;
        try {
            templateContent = await fs.readFile(templatePath, 'binary');
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                error: `Cannot read template file: ${error.message}` 
            });
        }
        
        // Prepare template data with translations
        const templateData = prepareTemplateData(cv, data, targetLanguage || 'en');
        
        // Generate document
        let doc;
        try {
            const zip = new PizZip(templateContent);
            doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: () => '' // Return empty string for null values
            });
            
            doc.render(templateData);
            
        } catch (error) {
            console.error('Template rendering error:', error);
            return res.status(500).json({ 
                success: false, 
                error: `Template rendering failed: ${error.message}. The template may have syntax errors.` 
            });
        }
        
        // Generate output buffer
        const buffer = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE'
        });
        
        // Save to exports directory
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const candidateName = sanitizeFilename(
            data.fullName || data.candidate_full_name || 'Unknown'
        );
        const templateName = template ? template.name.replace(/\s+/g, '_') : templateId;
        const filename = `CV_${candidateName}_${templateName}_${timestamp}.docx`;
        const exportPath = path.join(EXPORTS_DIR, filename);
        
        await fs.writeFile(exportPath, buffer);
        
        res.json({ 
            success: true, 
            data: {
                filename,
                path: exportPath,
                size: buffer.length,
                downloadUrl: `/api/export/download/${filename}`
            }
        });
        
    } catch (error) {
        console.error('Error exporting to Word:', error);
        res.status(500).json({ 
            success: false, 
            error: `Export failed: ${error.message}` 
        });
    }
});

// ============================================================================
// DOWNLOAD
// ============================================================================

// GET /api/export/download/:filename - Download exported file
router.get('/download/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        // Security: prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ success: false, error: 'Invalid filename' });
        }
        
        const filePath = path.join(EXPORTS_DIR, filename);
        
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ success: false, error: 'File not found' });
        }
        
        res.download(filePath, filename);
        
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sanitizeFilename(name) {
    return name
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
}

function generateTM2Format(cv, data, language) {
    const translations = getTranslations(language);
    
    // DG DIGIT TM2 format structure
    const lines = [];
    
    lines.push('=== CURRICULUM VITAE ===');
    lines.push('');
    
    // Personal Information
    lines.push(`${translations.personalInfo}:`);
    lines.push(`${translations.name}: ${data.fullName || data.candidate_full_name || 'N/A'}`);
    lines.push(`${translations.email}: ${data.email || 'N/A'}`);
    lines.push(`${translations.phone}: ${data.phone || 'N/A'}`);
    lines.push(`${translations.nationality}: ${data.nationality || data.candidate_nationality || 'N/A'}`);
    lines.push(`${translations.residence}: ${data.residenceCountry || data.country_of_residence || 'N/A'}`);
    lines.push('');
    
    // Professional Profile
    lines.push(`${translations.profile}:`);
    lines.push(`${translations.currentProfile}: ${data.profile || data.candidate_main_profile || 'N/A'}`);
    lines.push(`${translations.seniority}: ${data.seniority || 'N/A'}`);
    lines.push(`${translations.experience}: ${data.yearsOfExperience || 'N/A'} ${translations.years}`);
    lines.push(`${translations.currentEmployer}: ${data.affiliatedCompany || data.current_employer || 'N/A'}`);
    lines.push('');
    
    // Skills
    if (data.skills && Array.isArray(data.skills) && data.skills.length > 0) {
        lines.push(`${translations.skills}:`);
        data.skills.forEach(skill => {
            lines.push(`- ${skill}`);
        });
        lines.push('');
    }
    
    // Languages
    if (data.languages && Array.isArray(data.languages) && data.languages.length > 0) {
        lines.push(`${translations.languages}:`);
        data.languages.forEach(lang => {
            lines.push(`- ${lang.language}: ${lang.level || 'N/A'}`);
        });
        lines.push('');
    }
    
    // Education
    if (data.education && Array.isArray(data.education) && data.education.length > 0) {
        lines.push(`${translations.education}:`);
        data.education.forEach(edu => {
            lines.push(`- ${edu.degree || ''} ${translations.in} ${edu.field || ''} (${edu.year || 'N/A'})`);
            if (edu.institution) lines.push(`  ${edu.institution}`);
        });
        lines.push('');
    }
    
    // Certifications
    if (data.certifications && Array.isArray(data.certifications) && data.certifications.length > 0) {
        lines.push(`${translations.certifications}:`);
        data.certifications.forEach(cert => {
            lines.push(`- ${cert}`);
        });
        lines.push('');
    }
    
    // Metadata
    lines.push('---');
    lines.push(`${translations.exportedAt}: ${new Date().toISOString()}`);
    lines.push(`${translations.sourceFile}: ${cv.originalName || cv.filename}`);
    lines.push(`${translations.candidateId}: ${data.candidateId || data.candidate_id || 'N/A'}`);
    
    return lines.join('\n');
}

function prepareTemplateData(cv, data, language) {
    const translations = getTranslations(language);
    
    // Prepare data object for template
    const templateData = {
        // Labels (translated)
        labels: translations,
        
        // Personal Information
        fullName: data.fullName || data.candidate_full_name || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        nationality: data.nationality || data.candidate_nationality || '',
        residenceCountry: data.residenceCountry || data.country_of_residence || '',
        candidateId: data.candidateId || data.candidate_id || '',
        
        // Professional Profile
        profile: data.profile || data.candidate_main_profile || '',
        preferredProfile: data.preferredProfile || data.profile || '',
        seniority: data.seniority || '',
        yearsOfExperience: data.yearsOfExperience || '',
        currentEmployer: data.affiliatedCompany || data.current_employer || '',
        
        // Skills (as array and comma-separated string)
        skills: data.skills || [],
        skillsList: (data.skills || []).join(', '),
        
        // Languages
        languages: data.languages || [],
        
        // Education
        education: data.education || [],
        
        // Work Experience
        workExperience: data.workExperience || [],
        
        // Certifications
        certifications: data.certifications || [],
        
        // Metadata
        exportDate: new Date().toLocaleDateString(getLocale(language)),
        exportDateTime: new Date().toLocaleString(getLocale(language)),
        sourceFilename: cv.originalName || cv.filename,
        
        // Matching data (if available)
        profileFit: data.matching?.profileServiceFit || null,
        experienceFit: data.matching?.experienceDurationFit || null,
        languageFit: data.matching?.languageFit || null,
        overallFit: data.matching?.overallFit || null
    };
    
    return templateData;
}

function getTranslations(language) {
    const translations = {
        en: {
            personalInfo: 'Personal Information',
            name: 'Name',
            email: 'Email',
            phone: 'Phone',
            nationality: 'Nationality',
            residence: 'Country of Residence',
            profile: 'Professional Profile',
            currentProfile: 'Current Profile',
            seniority: 'Seniority',
            experience: 'Experience',
            years: 'years',
            currentEmployer: 'Current Employer',
            skills: 'Skills',
            languages: 'Languages',
            education: 'Education',
            in: 'in',
            certifications: 'Certifications',
            exportedAt: 'Exported at',
            sourceFile: 'Source file',
            candidateId: 'Candidate ID'
        },
        fr: {
            personalInfo: 'Informations personnelles',
            name: 'Nom',
            email: 'E-mail',
            phone: 'Téléphone',
            nationality: 'Nationalité',
            residence: 'Pays de résidence',
            profile: 'Profil professionnel',
            currentProfile: 'Profil actuel',
            seniority: 'Ancienneté',
            experience: 'Expérience',
            years: 'ans',
            currentEmployer: 'Employeur actuel',
            skills: 'Compétences',
            languages: 'Langues',
            education: 'Formation',
            in: 'en',
            certifications: 'Certifications',
            exportedAt: 'Exporté le',
            sourceFile: 'Fichier source',
            candidateId: 'ID candidat'
        },
        nl: {
            personalInfo: 'Persoonlijke informatie',
            name: 'Naam',
            email: 'E-mail',
            phone: 'Telefoon',
            nationality: 'Nationaliteit',
            residence: 'Land van verblijf',
            profile: 'Professioneel profiel',
            currentProfile: 'Huidig profiel',
            seniority: 'Anciënniteit',
            experience: 'Ervaring',
            years: 'jaar',
            currentEmployer: 'Huidige werkgever',
            skills: 'Vaardigheden',
            languages: 'Talen',
            education: 'Opleiding',
            in: 'in',
            certifications: 'Certificaten',
            exportedAt: 'Geëxporteerd op',
            sourceFile: 'Bronbestand',
            candidateId: 'Kandidaat ID'
        },
        de: {
            personalInfo: 'Persönliche Informationen',
            name: 'Name',
            email: 'E-Mail',
            phone: 'Telefon',
            nationality: 'Staatsangehörigkeit',
            residence: 'Wohnsitzland',
            profile: 'Berufsprofil',
            currentProfile: 'Aktuelles Profil',
            seniority: 'Dienstalter',
            experience: 'Erfahrung',
            years: 'Jahre',
            currentEmployer: 'Aktueller Arbeitgeber',
            skills: 'Fähigkeiten',
            languages: 'Sprachen',
            education: 'Bildung',
            in: 'in',
            certifications: 'Zertifizierungen',
            exportedAt: 'Exportiert am',
            sourceFile: 'Quelldatei',
            candidateId: 'Kandidaten-ID'
        },
        es: {
            personalInfo: 'Información personal',
            name: 'Nombre',
            email: 'Correo electrónico',
            phone: 'Teléfono',
            nationality: 'Nacionalidad',
            residence: 'País de residencia',
            profile: 'Perfil profesional',
            currentProfile: 'Perfil actual',
            seniority: 'Antigüedad',
            experience: 'Experiencia',
            years: 'años',
            currentEmployer: 'Empleador actual',
            skills: 'Habilidades',
            languages: 'Idiomas',
            education: 'Educación',
            in: 'en',
            certifications: 'Certificaciones',
            exportedAt: 'Exportado el',
            sourceFile: 'Archivo fuente',
            candidateId: 'ID del candidato'
        },
        it: {
            personalInfo: 'Informazioni personali',
            name: 'Nome',
            email: 'Email',
            phone: 'Telefono',
            nationality: 'Nazionalità',
            residence: 'Paese di residenza',
            profile: 'Profilo professionale',
            currentProfile: 'Profilo attuale',
            seniority: 'Anzianità',
            experience: 'Esperienza',
            years: 'anni',
            currentEmployer: 'Datore di lavoro attuale',
            skills: 'Competenze',
            languages: 'Lingue',
            education: 'Istruzione',
            in: 'in',
            certifications: 'Certificazioni',
            exportedAt: 'Esportato il',
            sourceFile: 'File sorgente',
            candidateId: 'ID candidato'
        }
    };
    
    return translations[language] || translations.en;
}

function getLocale(language) {
    const locales = {
        en: 'en-GB',
        fr: 'fr-FR',
        nl: 'nl-NL',
        de: 'de-DE',
        es: 'es-ES',
        it: 'it-IT'
    };
    
    return locales[language] || 'en-GB';
}

module.exports = router;