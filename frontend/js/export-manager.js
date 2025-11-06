// frontend/js/export-manager.js - Enhanced Export functionality with debugging
const API_BASE_URL_EXPORT = window.CVManager?.config?.api?.baseUrl || 'http://localhost:3001';

class ExportManager {
    constructor() {
        this.selectedCVId = null;
        this.selectedTemplate = 'eurostar';
        this.selectedLanguage = 'en';
        this.templates = [];
        this.availableCVs = []; // For debugging: list all available CVs
        this.isInitialized = false;
        
        console.log('📦 ExportManager initializing (Enhanced)...');
    }

    async init() {
        if (this.isInitialized) {
            // Just re-render if already initialized
            await this.renderExportTab();
            return;
        }

        await this.loadTemplates();
        await this.loadAvailableCVs(); // Load all CVs for debugging
        this.isInitialized = true;
        await this.renderExportTab();
        console.log('✅ ExportManager initialized (Enhanced)');
    }

    // ============================================================================
    // AUTHENTICATION
    // ============================================================================

    async authenticatedFetch(url, options = {}) {
        const auth = window.CVManager.auth;
        if (!auth?.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const token = auth.getToken();
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: { ...defaultOptions.headers, ...options.headers }
        };

        const response = await fetch(url, mergedOptions);

        if (response.status === 401) {
            throw new Error('Authentication failed');
        }

        return response;
    }

    getCurrentUser() {
        return window.CVManager.auth?.getCurrentUser();
    }

    // ============================================================================
    // TEMPLATE MANAGEMENT
    // ============================================================================

    async loadTemplates() {
        try {
            const response = await this.authenticatedFetch(`${API_BASE_URL_EXPORT}/api/export/templates`);
            const result = await response.json();

            if (result.success) {
                this.templates = result.data;
                console.log(`📦 Loaded ${this.templates.length} export templates`);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            this.showToast('Failed to load export templates', 'error');
        }
    }

    // ============================================================================
    // CV LOADING (FOR DEBUGGING)
    // ============================================================================

    async loadAvailableCVs() {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) {
                console.log('No user logged in');
                return;
            }

            const response = await this.authenticatedFetch(
                `${API_BASE_URL_EXPORT}/api/cvs/${currentUser.id}`
            );

            const result = await response.json();

            if (result.success) {
                this.availableCVs = result.data.cvs || [];
                console.log(`📋 Loaded ${this.availableCVs.length} available CVs for export selection`);
            }
        } catch (error) {
            console.error('Error loading available CVs:', error);
        }
    }

    // ============================================================================
    // RENDERING
    // ============================================================================

    async renderExportTab() {
        const container = document.getElementById('export-container');
        if (!container) {
            console.warn('⚠️ Export container not found');
            return;
        }

        console.log('🎨 Rendering Export tab...');

        // Check if user has selected a CV from matching
        const selectedCV = this.getSelectedCVForExport();

        if (!selectedCV) {
            container.innerHTML = this.renderNoSelection();
            return;
        }

        // Render export interface
        container.innerHTML = this.renderExportInterface(selectedCV);

        // Bind events
        this.bindEvents();
    }

    getSelectedCVForExport() {
        // Check session storage
        const exportData = sessionStorage.getItem('cv_marked_for_export');
        if (exportData) {
            try {
                return JSON.parse(exportData);
            } catch (e) {
                console.error('Failed to parse cv_marked_for_export:', e);
                sessionStorage.removeItem('cv_marked_for_export');
            }
        }
        return null;
    }

    renderNoSelection() {
        // Enhanced no selection view with debugging tools
        const parsedCVs = this.availableCVs.filter(cv => 
            cv.status === 'processed' && 
            (cv.parsingState === 'initial' || cv.parsingState === 'detailed')
        );

        return `
            <div class="export-empty-state">
                <div class="empty-icon">📦</div>
                <h3>No CV Selected for Export</h3>
                <p>Please select a CV from the <strong>Matching</strong> tab and mark it "To be exported".</p>
                <button class="btn-primary" onclick="window.CVManager.ui.switchTab('matching')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="M21 21l-4.35-4.35"></path>
                    </svg>
                    Go to Matching
                </button>

                ${parsedCVs.length > 0 ? `
                    <!-- DEBUG SECTION -->
                    <div class="debug-section">
                        <h4>🔧 Debug: Quick Select CV for Export</h4>
                        <p class="debug-note">Select a parsed CV below to test export functionality:</p>
                        <div class="debug-cv-list">
                            ${parsedCVs.map(cv => this.renderDebugCVOption(cv)).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="info-message" style="margin-top: 2rem;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <strong>No Parsed CVs Available</strong>
                        <p>Upload and parse CVs in the CV Pool tab before exporting.</p>
                    </div>
                `}
            </div>
        `;
    }

    renderDebugCVOption(cv) {
        const info = this.extractCandidateInfo(cv);
        const displayName = info.fullName || cv.originalName || cv.filename || 'Unknown';
        
        return `
            <div class="debug-cv-option" onclick="exportManager.debugSelectCV('${cv.id}')">
                <div class="debug-cv-icon">📄</div>
                <div class="debug-cv-info">
                    <div class="debug-cv-name">${this.escapeHtml(displayName)}</div>
                    <div class="debug-cv-meta">
                        ${info.profile ? `<span class="badge">${this.escapeHtml(info.profile)}</span>` : ''}
                        <span class="badge badge-${cv.parsingState}">${cv.parsingState} parse</span>
                    </div>
                </div>
                <button class="btn-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
            </div>
        `;
    }

    async debugSelectCV(cvId) {
        try {
            // Fetch full CV data
            const currentUser = this.getCurrentUser();
            if (!currentUser) {
                this.showToast('Please log in first', 'error');
                return;
            }

            const response = await this.authenticatedFetch(
                `${API_BASE_URL_EXPORT}/api/cvs/detail/${cvId}?userId=${currentUser.id}`
            );
            const result = await response.json();

            if (result.success) {
                const cv = result.data;
                
                // Create export-ready CV object
                const exportCV = {
                    id: cv.id,
                    candidateName: this.extractCandidateName(cv),
                    profile: this.extractProfile(cv),
                    filename: cv.originalName || cv.filename,
                    parsingState: cv.parsingState,
                    ...cv
                };

                // Mark for export
                sessionStorage.setItem('cv_marked_for_export', JSON.stringify(exportCV));
                
                this.showToast('✅ CV selected for export (DEBUG)', 'success');
                
                // Re-render
                await this.renderExportTab();
            }
        } catch (error) {
            console.error('Error selecting CV for export:', error);
            this.showToast('Failed to select CV', 'error');
        }
    }

    extractCandidateName(cv) {
        const initial = cv.initialParsingData?.extractedData;
        const detailed = cv.detailedParsingData?.extractedData;
        
        if (detailed?.candidate_full_name && detailed.candidate_full_name !== 'NOT_FOUND') {
            return detailed.candidate_full_name;
        }
        if (initial?.candidate_full_name && initial.candidate_full_name !== 'NOT_FOUND') {
            return initial.candidate_full_name;
        }
        if (initial?.firstName && initial?.lastName) {
            return `${initial.firstName} ${initial.lastName}`;
        }
        return 'Unknown';
    }

    extractProfile(cv) {
        const initial = cv.initialParsingData?.extractedData;
        const detailed = cv.detailedParsingData?.extractedData;
        
        return detailed?.candidate_main_profile || 
               initial?.candidate_main_profile || 
               initial?.profile || 
               'No profile';
    }

    extractCandidateInfo(cv) {
        const initialData = cv.initialParsingData?.extractedData;
        const detailedData = cv.detailedParsingData?.extractedData;
        const data = { ...initialData, ...detailedData };

        return {
            candidateId: data.candidate_id || null,
            fullName: data.candidate_full_name && data.candidate_full_name !== "NOT_FOUND"
                ? data.candidate_full_name
                : (initialData?.firstName && initialData?.lastName 
                    ? `${initialData.firstName} ${initialData.lastName}` 
                    : null),
            profile: data.candidate_main_profile || data.profile || null,
            nationality: data.candidate_nationality ? [data.candidate_nationality] : [],
            residenceCountry: data.country_of_residence || null,
            affiliatedCompany: data.current_employer || null
        };
    }

    renderExportInterface(selectedCV) {
        const languages = [
            { code: 'en', name: 'English' },
            { code: 'fr', name: 'Français' },
            { code: 'nl', name: 'Nederlands' },
            { code: 'de', name: 'Deutsch' },
            { code: 'es', name: 'Español' },
            { code: 'it', name: 'Italiano' }
        ];

        const availableTemplates = this.templates.filter(t => t.exists);
        const missingTemplates = this.templates.filter(t => !t.exists);

        return `
            <div class="export-interface">
                <!-- Selected CV Info -->
                <div class="export-section">
                    <h3>Selected CV</h3>
                    <div class="selected-cv-card">
                        <div class="cv-icon">📄</div>
                        <div class="cv-info">
                            <div class="cv-name">${this.escapeHtml(selectedCV.candidateName || 'Unknown')}</div>
                            <div class="cv-meta">
                                ${this.escapeHtml(selectedCV.profile || 'No profile')} • 
                                ${this.escapeHtml(selectedCV.filename || 'No filename')}
                                ${selectedCV.parsingState ? ` • <span class="badge badge-${selectedCV.parsingState}">${selectedCV.parsingState} parse</span>` : ''}
                            </div>
                        </div>
                        <button class="btn-secondary" onclick="exportManager.clearSelection()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            Clear Selection
                        </button>
                    </div>
                </div>

                <!-- Export Options -->
                <div class="export-section">
                    <h3>Export Options</h3>
                    
                    <!-- Language Selection -->
                    <div class="form-group">
                        <label for="export-language">Target Language</label>
                        <select id="export-language" class="form-control">
                            ${languages.map(lang => `
                                <option value="${lang.code}" ${lang.code === this.selectedLanguage ? 'selected' : ''}>
                                    ${lang.name}
                                </option>
                            `).join('')}
                        </select>
                        <small>Select the language for labels and text in the exported document</small>
                    </div>

                    <!-- Export Format Tabs -->
                    <div class="export-format-tabs">
                        <button class="export-tab active" data-format="tm2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                            DG DIGIT TM2 Format
                        </button>
                        <button class="export-tab" data-format="word">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            Word Template
                        </button>
                    </div>

                    <!-- TM2 Export Panel -->
                    <div id="export-panel-tm2" class="export-panel active">
                        <div class="export-description">
                            <p>Export CV in DG DIGIT TM2 PDF format. This format is commonly used for European Commission translation services.</p>
                        </div>
                        <button class="btn-primary btn-large" onclick="exportManager.exportTM2()">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Export as TM2
                        </button>
                    </div>

                    <!-- Word Template Export Panel -->
                    <div id="export-panel-word" class="export-panel">
                        <div class="export-description">
                            <p>Export CV using a Word template. Select from available templates below.</p>
                        </div>

                        <!-- Available Templates -->
                        ${availableTemplates.length > 0 ? `
                            <div class="form-group">
                                <label>Select Template</label>
                                <div class="template-grid">
                                    ${availableTemplates.map(template => `
                                        <div class="template-card ${template.id === this.selectedTemplate ? 'selected' : ''}" 
                                             onclick="exportManager.selectTemplate('${template.id}')">
                                            <div class="template-icon">
                                                ${template.isDefault ? '⭐' : '📄'}
                                            </div>
                                            <div class="template-info">
                                                <div class="template-name">${this.escapeHtml(template.name)}</div>
                                                <div class="template-desc">${this.escapeHtml(template.description)}</div>
                                                ${template.isDefault ? '<span class="badge badge-default">Default</span>' : ''}
                                            </div>
                                            ${template.id === this.selectedTemplate ? 
                                                '<div class="template-selected">✓</div>' : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <button class="btn-primary btn-large" onclick="exportManager.exportWord()">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Export as Word Document
                            </button>
                        ` : `
                            <div class="warning-message">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                    <line x1="12" y1="9" x2="12" y2="13"></line>
                                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                                <strong>No templates available</strong>
                                <p>Please upload Word templates to use this export format.</p>
                            </div>
                        `}

                        <!-- Missing Templates Warning -->
                        ${missingTemplates.length > 0 ? `
                            <div class="info-message">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                                <strong>Missing Templates</strong>
                                <p>The following default templates are not found:</p>
                                <ul>
                                    ${missingTemplates.map(t => `
                                        <li>${this.escapeHtml(t.name)} (${this.escapeHtml(t.filename)})</li>
                                    `).join('')}
                                </ul>
                                <p>Place these .docx files in <code>backend/data/export-templates/</code> to use them.</p>
                            </div>
                        ` : ''}

                        <!-- Upload Template -->
                        <div class="template-upload">
                            <h4>Upload Custom Template</h4>
                            <p>Upload a Word (.docx) template with placeholders like <code>{fullName}</code>, <code>{email}</code>, etc.</p>
                            <input type="file" id="template-upload-input" accept=".docx" style="display: none;">
                            <button class="btn-secondary" onclick="document.getElementById('template-upload-input').click()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                Upload Template
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================

    bindEvents() {
        // Language selection
        const languageSelect = document.getElementById('export-language');
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => {
                this.selectedLanguage = e.target.value;
            });
        }

        // Format tabs
        document.querySelectorAll('.export-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const format = e.currentTarget.dataset.format;
                this.switchExportFormat(format);
            });
        });

        // Template upload
        const uploadInput = document.getElementById('template-upload-input');
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => {
                this.handleTemplateUpload(e);
            });
        }
    }

    switchExportFormat(format) {
        // Update tabs
        document.querySelectorAll('.export-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.format === format);
        });

        // Update panels
        document.querySelectorAll('.export-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        const targetPanel = document.getElementById(`export-panel-${format}`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
    }

    selectTemplate(templateId) {
        this.selectedTemplate = templateId;
        
        // Update UI
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
            const checkmark = card.querySelector('.template-selected');
            if (checkmark) checkmark.remove();
        });

        const selectedCard = document.querySelector(`.template-card[onclick*="${templateId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            
            const check = document.createElement('div');
            check.className = 'template-selected';
            check.textContent = '✓';
            selectedCard.appendChild(check);
        }
    }

    clearSelection() {
        sessionStorage.removeItem('cv_marked_for_export');
        this.renderExportTab();
    }

    // ============================================================================
    // EXPORT ACTIONS
    // ============================================================================

    async exportTM2() {
        const selectedCV = this.getSelectedCVForExport();
        if (!selectedCV) {
            this.showToast('No CV selected', 'error');
            return;
        }

        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            this.showToast('Please log in first', 'error');
            return;
        }

        try {
            this.showToast('Exporting to TM2 format...', 'info');

            const response = await this.authenticatedFetch(`${API_BASE_URL_EXPORT}/api/export/tm2`, {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUser.id,
                    cvId: selectedCV.id,
                    targetLanguage: this.selectedLanguage
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('✅ Export successful!', 'success');
                
                // Download file
                const downloadUrl = `${API_BASE_URL_EXPORT}${result.data.downloadUrl}`;
                window.open(downloadUrl, '_blank');
            } else {
                throw new Error(result.error || 'Export failed');
            }

        } catch (error) {
            console.error('TM2 export error:', error);
            this.showToast(`Export failed: ${error.message}`, 'error');
        }
    }

    async exportWord() {
        const selectedCV = this.getSelectedCVForExport();
        if (!selectedCV) {
            this.showToast('No CV selected', 'error');
            return;
        }

        if (!this.selectedTemplate) {
            this.showToast('Please select a template', 'error');
            return;
        }

        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            this.showToast('Please log in first', 'error');
            return;
        }

        try {
            this.showToast('Exporting to Word format...', 'info');

            const response = await this.authenticatedFetch(`${API_BASE_URL_EXPORT}/api/export/word`, {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUser.id,
                    cvId: selectedCV.id,
                    templateId: this.selectedTemplate,
                    targetLanguage: this.selectedLanguage
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('✅ Export successful!', 'success');
                
                // Download file
                const downloadUrl = `${API_BASE_URL_EXPORT}${result.data.downloadUrl}`;
                window.open(downloadUrl, '_blank');
            } else {
                throw new Error(result.error || 'Export failed');
            }

        } catch (error) {
            console.error('Word export error:', error);
            this.showToast(`Export failed: ${error.message}`, 'error');
        }
    }

    async handleTemplateUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.docx')) {
            this.showToast('Only .docx files are supported', 'error');
            return;
        }

        // TODO: Implement template upload via multer
        this.showToast('Template upload: Integration with multer required', 'warning');
        
        // Clear file input
        event.target.value = '';
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let exportManager;

document.addEventListener('DOMContentLoaded', () => {
    const checkAuthAndInit = () => {
        if (window.CVManager?.auth?.isAuthenticated()) {
            exportManager = new ExportManager();
            window.exportManager = exportManager;
            window.CVManager.exportManager = exportManager;

            console.log('✅ ExportManager created (will initialize on tab switch)');
        } else {
            setTimeout(checkAuthAndInit, 100);
        }
    };
    setTimeout(checkAuthAndInit, 600);
});

// Listen for tab changes
document.addEventListener('tabChange', (event) => {
    console.log('🔔 tabChange event received:', event.detail);
    if (event.detail?.tabId === 'export' && exportManager) {
        console.log('🎯 Initializing Export tab...');
        exportManager.init();
    }
});

// FALLBACK: Listen for when export tab becomes visible
// This handles cases where the tabChange event might not fire
const exportTabObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const exportSection = document.getElementById('export');
            if (exportSection?.classList.contains('active') && exportManager && !exportManager.isInitialized) {
                console.log('👀 Export tab became visible (MutationObserver), initializing...');
                exportManager.init();
            }
        }
    });
});

// Start observing when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const exportSection = document.getElementById('export');
    if (exportSection) {
        exportTabObserver.observe(exportSection, { attributes: true });
        console.log('👁️ MutationObserver watching export section');
    }
});

console.log('✅ Export module loaded (Enhanced with debugging + MutationObserver fallback)');