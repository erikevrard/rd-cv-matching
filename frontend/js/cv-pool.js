// CV Pool Manager - v3.0.0 Refactored with Delete & Parsing State
// Clean, modern implementation with proper separation of concerns

const API_BASE_URL = window.CVManager?.config?.api?.baseUrl || 'http://localhost:3001';

class CVPoolManager {
    constructor() {
        this.cvs = [];
        this.summary = null;
        this.selectedCvId = null;
        this.autoRefreshInterval = null;
        this.isRefreshing = false;

        this.init();
    }

    async init() {
        await this.loadCVs();
        this.setupEventListeners();
        this.injectParseButton();
        this.updateUI();
        this.startAutoRefresh();

        console.log('✅ CVPoolManager v3.0 initialized');
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
            this.showToast('Session expired. Please log in again.', 'error');
            auth.logout();
            throw new Error('Authentication failed');
        }

        return response;
    }

    getCurrentUser() {
        return window.CVManager.auth?.getCurrentUser();
    }

    // ============================================================================
    // DATA LOADING
    // ============================================================================

    async loadCVs() {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) {
                console.log('No user logged in');
                return;
            }

            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/cvs/${currentUser.id}`
            );

            const result = await response.json();

            if (result.success) {
                this.cvs = result.data.cvs || [];
                this.summary = result.data.summary || this.calculateSummary(this.cvs);

                console.log(`Loaded ${this.cvs.length} CVs`);
                this.updateUI();
            }
        } catch (error) {
            console.error('Error loading CVs:', error);
            this.showToast('Failed to load CVs', 'error');
        }
    }

    calculateSummary(cvs) {
        return {
            total: cvs.length,
            uploaded: cvs.filter(cv => cv.status === 'uploaded').length,
            processing: cvs.filter(cv => ['processing', 'parsing_initial', 'parsing_detailed'].includes(cv.status)).length,
            parsed: cvs.filter(cv => cv.status === 'processed').length,
            failed: cvs.filter(cv => cv.status === 'error').length
        };
    }

    // ============================================================================
    // AUTO-REFRESH
    // ============================================================================

    startAutoRefresh(intervalMs = 10000) {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }

        this.autoRefreshInterval = setInterval(async () => {
            if (!this.isRefreshing && document.visibilityState === 'visible') {
                await this.refreshCVList();
            }
        }, intervalMs);

        console.log(`🔄 Auto-refresh: ${intervalMs / 1000}s`);
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    async refreshCVList() {
        if (this.isRefreshing) return;

        this.isRefreshing = true;
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) return;

            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/cvs/${currentUser.id}`
            );
            const result = await response.json();

            if (result.success) {
                const oldCount = this.cvs.length;
                this.cvs = result.data.cvs || [];
                this.summary = result.data.summary || this.calculateSummary(this.cvs);

                if (oldCount !== this.cvs.length || this.hasChanges(result.data.cvs)) {
                    this.updateCVList();
                    this.updateSummary();
                }
            }
        } catch (error) {
            console.error('Refresh error:', error);
        } finally {
            this.isRefreshing = false;
        }
    }

    hasChanges(newCVs) {
        if (!newCVs || newCVs.length === 0) return true;

        for (let i = 0; i < Math.min(5, newCVs.length); i++) {
            const oldCV = this.cvs[i];
            const newCV = newCVs[i];

            if (!oldCV ||
                oldCV.status !== newCV.status ||
                oldCV.parsingState !== newCV.parsingState) {
                return true;
            }
        }
        return false;
    }

    // ============================================================================
    // EVENT LISTENERS
    // ============================================================================

    setupEventListeners() {
        // File upload
        const fileInput = document.getElementById('cv-file-input');
        if (fileInput) {
            const newFileInput = fileInput.cloneNode(true);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);
            newFileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Upload button
        const uploadBtn = document.getElementById('cv-upload-btn');
        if (uploadBtn) {
            const newUploadBtn = uploadBtn.cloneNode(true);
            uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
            newUploadBtn.addEventListener('click', () => {
                document.getElementById('cv-file-input')?.click();
            });
        }
    }

    // ============================================================================
    // FILE UPLOAD
    // ============================================================================

    async handleFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            this.showToast('Please log in first', 'error');
            return;
        }

        const token = window.CVManager.auth?.getToken();
        const formData = new FormData();
        formData.append('userId', currentUser.id);

        Array.from(files).forEach(file => {
            formData.append('cvs', file);
        });

        try {
            this.showToast('Uploading CVs...', 'info');

            const response = await fetch(`${API_BASE_URL}/api/cvs/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (response.status === 401) {
                this.showToast('Session expired. Please log in again.', 'error');
                window.CVManager.auth?.logout();
                return;
            }

            const result = await response.json();

            if (result.success) {
                const uploaded = result.data.uploadedCount || 0;
                const rejected = result.data.rejectedCount || 0;

                this.showToast(
                    `✅ Uploaded ${uploaded} CV(s)${rejected > 0 ? `, ${rejected} rejected` : ''}`,
                    'success'
                );

                await this.loadCVs();
                event.target.value = '';

                // Speed up refresh temporarily
                this.startAutoRefresh(3000);
                setTimeout(() => this.startAutoRefresh(), 60000);
            } else {
                this.showToast(`Upload failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('Upload failed', 'error');
        }
    }

    // ============================================================================
    // CV DELETION
    // ============================================================================

    async deleteCV(cvId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        const cv = this.cvs.find(c => c.id === cvId);
        if (!cv) return;

        const confirmMsg = `Delete CV: ${cv.originalName || cv.filename}?\n\nThis action cannot be undone.`;
        if (!confirm(confirmMsg)) return;

        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) {
                this.showToast('Please log in first', 'error');
                return;
            }

            this.showToast('Deleting CV...', 'info');

            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/cvs/${cvId}?userId=${currentUser.id}`,
                { method: 'DELETE' }
            );

            const result = await response.json();

            if (result.success) {
                this.showToast('✅ CV deleted successfully', 'success');

                // Remove from local array
                this.cvs = this.cvs.filter(c => c.id !== cvId);
                this.updateCVList();
                this.updateSummary();

                // Close details if this CV was selected
                if (this.selectedCvId === cvId) {
                    this.closeCVDetails();
                }
            } else {
                throw new Error(result.error || 'Failed to delete');
            }
        } catch (error) {
            console.error('Delete CV error:', error);
            this.showToast(`Failed to delete: ${error.message}`, 'error');
        }
    }

    // ============================================================================
    // UI RENDERING
    // ============================================================================

    updateUI() {
        this.updateCVList();
        this.updateSummary();
    }

    updateCVList() {
        const container = document.getElementById('cv-list-container');
        if (!container) return;

        if (this.cvs.length === 0) {
            container.innerHTML = `
                <div class="cv-empty-state">
                    <div class="upload-icon">📄</div>
                    <h3>No CVs uploaded yet</h3>
                    <p>Upload PDF, DOCX, DOC, or TXT files to get started with AI-powered CV parsing.</p>
                    <button onclick="document.getElementById('cv-file-input')?.click()" class="btn-primary">
                        Upload Your First CV
                    </button>
                </div>
            `;
            return;
        }

        const cvListHTML = this.cvs.map(cv => this.renderCVItem(cv)).join('');
        container.innerHTML = cvListHTML;
    }

renderCVItem(cv) {
    const statusIcon = this.getStatusIcon(cv.status, cv.parsingState);
    const statusClass = this.getStatusClass(cv.status);
    const parsingStateDisplay = this.getParsingStateDisplay(cv.parsingState);

    // Extract candidate information from parsing data
    const info = this.extractCandidateInfo(cv);

    return `
        <div class="cv-item ${this.selectedCvId === cv.id ? 'selected' : ''}" 
             data-status="${cv.status}"
             onclick="cvPoolManager.viewCV('${cv.id}')">
            <div class="cv-item-header">
                <div class="cv-info">
                    <span class="cv-status-icon">${statusIcon}</span>
                    <div class="cv-details">
                        <div class="cv-filename">${this.escapeHtml(cv.originalName || cv.filename)}</div>
                        <div class="cv-meta">
                            ${this.formatFileSize(cv.fileSize)} • 
                            ${this.formatDate(cv.uploadedAt)}
                        </div>
                        ${this.renderCandidateInfo(info)}
                    </div>
                </div>
                <div class="cv-actions">
                    <div class="cv-badges">
                        <span class="cv-status-badge ${statusClass}">${cv.status}</span>
                        ${parsingStateDisplay ? `<span class="cv-parsing-badge">${parsingStateDisplay}</span>` : ''}
                        ${this.renderParsingSourceBadge(cv)}
                    </div>
                    <div class="cv-action-buttons">
                        <button class="btn-icon" 
                                onclick="cvPoolManager.viewOriginalCV('${cv.id}', event)" 
                                title="View Original PDF"
                                aria-label="View Original PDF">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10 9 9 9 8 9"/>
                            </svg>
                        </button>
                        <button class="btn-icon" 
                                onclick="cvPoolManager.viewCVJson('${cv.id}', event)" 
                                title="View JSON Data"
                                aria-label="View JSON Data">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="16 18 22 12 16 6"/>
                                <polyline points="8 6 2 12 8 18"/>
                            </svg>
                        </button>
                        <button class="btn-icon-delete" 
                                onclick="cvPoolManager.deleteCV('${cv.id}', event)" 
                                title="Delete CV"
                                aria-label="Delete CV">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            ${cv.errorMessage ? `<div class="cv-error">${this.escapeHtml(cv.errorMessage)}</div>` : ''}
        </div>
    `;
}
    /**
 * Extract candidate information from CV parsing data
 */
    extractCandidateInfo(cv) {
        const initialData = cv.initialParsingData?.extractedData;
        const detailedData = cv.detailedParsingData?.extractedData;

        // Use initial data as base, override with detailed if available
        const data = { ...initialData, ...detailedData };

        // Calculate total experience (placeholder for now)
        let totalExperience = null;
        if (cv.parsingState === 'detailed') {
            totalExperience = "7 years 7 months"; // Placeholder
        }

        return {
            candidateId: data.candidate_id || null,
            fullName: data.candidate_full_name && data.candidate_full_name !== "NOT_FOUND"
                ? data.candidate_full_name
                : null,
            profile: data.candidate_main_profile || null,
            preferredProfile: data.candidate_main_profile || null,
            nationality: data.candidate_nationality ? [data.candidate_nationality] : [],
            isEUCitizen: this.isEUCountry(data.candidate_nationality),
            residenceCountry: data.country_of_residence || null,
            affiliatedCompany: data.current_employer || null,
            totalExperience: totalExperience,
            seniority: null,
            yearsOfExperience: null
        };
    }

    isEUCountry(countryCode) {
        if (!countryCode) return false;
        const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
        return euCountries.includes(countryCode.toUpperCase());
    }

    /**
     * Render candidate information badges
     */
    renderCandidateInfo(info) {
        // Only show if CV is parsed
        if (!info.fullName && !info.candidateId && !info.profile) {
            return '';
        }

        const badges = [];

        // Name / ID
        if (info.fullName || info.candidateId) {
            let nameDisplay = '';
            if (info.fullName && info.candidateId) {
                nameDisplay = `${info.fullName} (${info.candidateId})`;
            } else {
                nameDisplay = info.fullName || info.candidateId;
            }

            badges.push(`
            <span class="info-badge name-badge" title="Candidate Name/ID">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
                ${this.escapeHtml(nameDisplay)}
            </span>
        `);
        } else {
            badges.push(`
            <span class="info-badge missing-badge" title="Name/ID not available">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                No name/ID
            </span>
        `);
        }

        // Profile
        if (info.preferredProfile) {
            badges.push(`
            <span class="info-badge profile-badge" title="Preferred Profile">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
                </svg>
                ${this.escapeHtml(info.preferredProfile)}
            </span>
        `);
        } else {
            badges.push(`
            <span class="info-badge missing-badge" title="Profile not available">
                No profile
            </span>
        `);
        }

        // Nationality
        if (info.nationality.length > 0) {
            const nationalityDisplay = info.nationality.join(', ');
            const euIcon = info.isEUCitizen ? ' 🇪🇺' : '';

            badges.push(`
            <span class="info-badge nationality-badge ${info.isEUCitizen ? 'eu-citizen' : 'non-eu'}" 
                  title="Nationality (${info.isEUCitizen ? 'EU Citizen' : 'Non-EU'})">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                </svg>
                ${this.escapeHtml(nationalityDisplay)}${euIcon}
            </span>
        `);
        } else {
            badges.push(`
            <span class="info-badge missing-badge" title="Nationality not available">
                No nationality
            </span>
        `);
        }

        // Residence
        if (info.residenceCountry) {
            badges.push(`
            <span class="info-badge residence-badge" title="Country of Residence">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                ${this.escapeHtml(info.residenceCountry)}
            </span>
        `);
        } else {
            badges.push(`
            <span class="info-badge missing-badge" title="Residence not available">
                No residence
            </span>
        `);
        }

        // Company
        if (info.affiliatedCompany) {
            badges.push(`
            <span class="info-badge company-badge" title="Affiliated Company">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 21h18"/>
                    <path d="M5 21V7l8-4v18"/>
                    <path d="M19 21V11l-6-4"/>
                </svg>
                ${this.escapeHtml(info.affiliatedCompany)}
            </span>
        `);
        } else {
            badges.push(`
            <span class="info-badge missing-badge" title="Company not available">
                No company
            </span>
        `);
        }

        // Total Experience (only for detailed parsing)
        if (info.totalExperience) {
            badges.push(`
        <span class="info-badge experience-badge" title="Total Professional Experience">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
            ${this.escapeHtml(info.totalExperience)}
        </span>
    `);
        }

        return `<div class="cv-candidate-info">${badges.join('')}</div>`;
    }

    /**
     * Render parsing source badge (PRESET, LLM name, or MOCK)
     */
    renderParsingSourceBadge(cv) {
        let source = null;
        let sourceType = 'llm';

        // Check initial parsing source
        if (cv.initialParsingData) {
            const llm = cv.initialParsingData.llmMnemonic;
            if (llm === 'PRESET') {
                source = '📦 Preset';
                sourceType = 'preset';
            } else if (llm === 'MOCK') {
                source = '🎲 Mock';
                sourceType = 'mock';
            } else if (llm) {
                source = `🤖 ${llm}`;
            }
        }

        // Check detailed parsing source (overrides initial if present)
        if (cv.detailedParsingData) {
            const llm = cv.detailedParsingData.llmMnemonic;
            if (llm === 'PRESET') {
                source = '📦 Preset (Detailed)';
                sourceType = 'preset';
            } else if (llm === 'MOCK') {
                source = '🎲 Mock (Detailed)';
                sourceType = 'mock';
            } else if (llm) {
                source = `🤖 ${llm} (Detailed)`;
            }
        }

        if (!source) return '';

        return `<span class="cv-source-badge source-${sourceType}" title="Parsing Source">${source}</span>`;
    }

    updateSummary() {
        if (!this.summary) return;

        const summaryContainer = document.getElementById('cv-summary');
        if (!summaryContainer) return;

        summaryContainer.innerHTML = `
            <div class="summary-stats">
                <div class="stat-item">
                    <div class="stat-number">${this.summary.total}</div>
                    <div class="stat-label">Total CVs</div>
                </div>
                <div class="stat-item pending">
                    <div class="stat-number">${this.summary.uploaded}</div>
                    <div class="stat-label">Pending</div>
                </div>
                <div class="stat-item processing">
                    <div class="stat-number">${this.summary.processing}</div>
                    <div class="stat-label">Processing</div>
                </div>
                <div class="stat-item parsed">
                    <div class="stat-number">${this.summary.parsed}</div>
                    <div class="stat-label">Parsed</div>
                </div>
                <div class="stat-item failed">
                    <div class="stat-number">${this.summary.failed}</div>
                    <div class="stat-label">Failed</div>
                </div>
            </div>
        `;
    }

    // ============================================================================
    // CV DETAILS VIEW
    // ============================================================================

    async viewCV(cvId) {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) return;

            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/cvs/detail/${cvId}?userId=${currentUser.id}`
            );
            const result = await response.json();

            if (result.success) {
                this.selectedCvId = cvId;
                this.showCVDetails(result.data);
                this.updateCVList(); // Re-render to show selection
            }
        } catch (error) {
            console.error('Error loading CV details:', error);
            this.showToast('Failed to load CV details', 'error');
        }
    }

    async viewOriginalCV(cvId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) return;

            // Open PDF in new window
            const url = `${API_BASE_URL}/api/cvs/view/${cvId}?userId=${currentUser.id}`;
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error opening CV:', error);
            this.showToast('Failed to open CV', 'error');
        }
    }

    async viewCVJson(cvId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) return;

            // Fetch full CV data
            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/cvs/detail/${cvId}?userId=${currentUser.id}`
            );
            const result = await response.json();

            if (result.success) {
                // Open JSON in new window with formatting
                const jsonWindow = window.open('', '_blank');
                jsonWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>CV JSON - ${result.data.originalName || cvId}</title>
                    <style>
                        body {
                            font-family: 'Monaco', 'Courier New', monospace;
                            background: #1e1e1e;
                            color: #d4d4d4;
                            padding: 20px;
                            margin: 0;
                        }
                        pre {
                            background: #252526;
                            padding: 20px;
                            border-radius: 8px;
                            overflow: auto;
                            line-height: 1.5;
                        }
                        .json-key { color: #9cdcfe; }
                        .json-string { color: #ce9178; }
                        .json-number { color: #b5cea8; }
                        .json-boolean { color: #569cd6; }
                        .json-null { color: #569cd6; }
                        h1 {
                            color: #fff;
                            font-size: 18px;
                            margin-bottom: 20px;
                        }
                        .copy-btn {
                            position: fixed;
                            top: 20px;
                            right: 20px;
                            padding: 10px 20px;
                            background: #0e639c;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-family: system-ui;
                        }
                        .copy-btn:hover {
                            background: #1177bb;
                        }
                    </style>
                </head>
                <body>
                    <button class="copy-btn" onclick="copyToClipboard()">Copy JSON</button>
                    <h1>CV JSON Data: ${this.escapeHtml(result.data.originalName || cvId)}</h1>
                    <pre id="json-content">${this.syntaxHighlightJson(result.data)}</pre>
                    <script>
                        function copyToClipboard() {
                            const jsonText = ${JSON.stringify(JSON.stringify(result.data, null, 2))};
                            navigator.clipboard.writeText(jsonText).then(() => {
                                const btn = document.querySelector('.copy-btn');
                                btn.textContent = 'Copied!';
                                setTimeout(() => btn.textContent = 'Copy JSON', 2000);
                            });
                        }
                    </script>
                </body>
                </html>
            `);
                jsonWindow.document.close();
            }
        } catch (error) {
            console.error('Error viewing CV JSON:', error);
            this.showToast('Failed to load CV JSON', 'error');
        }
    }

    showCVDetails(cv) {
        const container = document.getElementById('cv-details-container');
        if (!container) return;

        container.style.display = 'block';

        const initialData = cv.initialParsingData?.extractedData;
        const detailedData = cv.detailedParsingData?.extractedData;

        let parsingHTML = '';

        if (initialData) {
            parsingHTML += `
                <div class="extraction-section">
                    <h4>Initial Parsing Data</h4>
                    <div class="extraction-data">
                        ${this.renderDataField('Name', `${initialData.firstName || ''} ${initialData.lastName || ''}`)}
                        ${this.renderDataField('Email', initialData.email)}
                        ${this.renderDataField('Phone', initialData.phone)}
                        ${this.renderDataField('Profile', initialData.profile)}
                        ${this.renderDataField('Seniority', initialData.seniority)}
                        ${this.renderDataField('Nationality', initialData.nationality)}
                        ${this.renderDataField('Years of Experience', initialData.yearsOfExperience)}
                    </div>
                    <div class="parsing-meta">
                        <small>Parsed: ${this.formatDate(cv.initialParsingData.parsedAt)} • 
                        LLM: ${cv.initialParsingData.llmMnemonic}</small>
                    </div>
                </div>
            `;
        }

        if (detailedData) {
            parsingHTML += `
                <div class="extraction-section">
                    <h4>Detailed Parsing Data</h4>
                    <div class="extraction-data">
                        ${this.renderDataField('Full Name', detailedData.fullName)}
                        ${this.renderDataField('Email', detailedData.email)}
                        ${this.renderDataField('Phone', detailedData.phone)}
                        ${this.renderDataField('Profile', detailedData.profile)}
                        ${this.renderDataField('Seniority', detailedData.seniority)}
                        ${detailedData.skills ? `
                            <div class="extraction-item">
                                <strong>Skills:</strong>
                                <div class="skills-list">
                                    ${detailedData.skills.map(s => `<span class="skill-tag">${this.escapeHtml(s)}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                        ${detailedData.languages ? `
                            <div class="extraction-item">
                                <strong>Languages:</strong> 
                                ${detailedData.languages.map(l => `${l.language} (${l.level})`).join(', ')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="parsing-meta">
                        <small>Parsed: ${this.formatDate(cv.detailedParsingData.parsedAt)} • 
                        LLM: ${cv.detailedParsingData.llmMnemonic}</small>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="cv-details-header">
                <h3>${this.escapeHtml(cv.originalName || cv.filename)}</h3>
                <button class="btn-icon" onclick="cvPoolManager.closeCVDetails()" title="Close">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            
            <div class="cv-details-content">
                <div class="file-info-section">
                    <h4>File Information</h4>
                    <div class="file-info">
                        <div><strong>Size:</strong> ${this.formatFileSize(cv.fileSize)}</div>
                        <div><strong>Type:</strong> ${(cv.fileType || '').toUpperCase()}</div>
                        <div><strong>Uploaded:</strong> ${this.formatDate(cv.uploadedAt)}</div>
                        ${cv.processedAt ? `<div><strong>Processed:</strong> ${this.formatDate(cv.processedAt)}</div>` : ''}
                        <div><strong>Status:</strong> <span class="cv-status-badge ${this.getStatusClass(cv.status)}">${cv.status}</span></div>
                        ${cv.parsingState ? `<div><strong>Parsing State:</strong> <span class="cv-parsing-badge">${this.getParsingStateDisplay(cv.parsingState)}</span></div>` : ''}
                    </div>
                </div>
                
                ${parsingHTML}
                
                ${cv.errorMessage ? `
                    <div class="error-section">
                        <h4>Error Details</h4>
                        <div class="cv-error">${this.escapeHtml(cv.errorMessage)}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderDataField(label, value) {
        if (!value && value !== 0) return '';  // Allow 0 as valid value
        const strValue = String(value).trim();
        if (strValue === '') return '';
        return `
    <div class="extraction-item">
      <strong>${label}:</strong> ${this.escapeHtml(strValue)}
    </div>
  `;
    }

    closeCVDetails() {
        const container = document.getElementById('cv-details-container');
        if (container) {
            container.style.display = 'none';
        }
        this.selectedCvId = null;
        this.updateCVList();
    }

    // ============================================================================
    // PARSE BUTTON INJECTION
    // ============================================================================

    injectParseButton() {
        const headerActions = document.querySelector('#cv-pool .header-actions');
        if (!headerActions) return;

        const existingBtn = document.getElementById('parse-cvs-btn');
        if (existingBtn) return;

        const parseBtn = document.createElement('button');
        parseBtn.id = 'parse-cvs-btn';
        parseBtn.className = 'btn-secondary';
        parseBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
        </svg>
        Parse CVs
    `;

        // Wait for parseManager with timeout
        parseBtn.onclick = async () => {
            console.log('🎯 Parse CVs button clicked');

            // Wait up to 2 seconds for parseManager to be ready
            let attempts = 0;
            const maxAttempts = 20; // 20 * 100ms = 2 seconds

            while (!window.parseManager && attempts < maxAttempts) {
                console.log(`⏳ Waiting for parseManager... (${attempts + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (window.parseManager?.showParseDialog) {
                console.log('✅ parseManager found, showing dialog');
                window.parseManager.showParseDialog();
            } else {
                console.error('❌ parseManager not available after timeout');
                alert('Parse system failed to load. Please refresh the page and try again.');
            }
        };

        const uploadBtn = document.getElementById('cv-upload-btn');
        if (uploadBtn) {
            headerActions.insertBefore(parseBtn, uploadBtn);
        } else {
            headerActions.appendChild(parseBtn);
        }
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    getStatusIcon(status, parsingState) {
        // Return proper SVG icons instead of emojis
        const icons = {
            uploaded: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>`,

            processing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
        </svg>`,

            processed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`,

            error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>`
        };

        if (status === 'error') return icons.error;
        if (['processing', 'parsing_initial', 'parsing_detailed'].includes(status)) return icons.processing;
        if (status === 'processed') return icons.processed;
        return icons.uploaded;
    }

    getStatusClass(status) {
        return `status-${status}`;
    }

    getParsingStateDisplay(parsingState) {
        const states = {
            'unparsed': '',
            'initial': 'Initial Parse',
            'detailed': 'Detailed Parse'
        };
        return states[parsingState] || '';
    }


    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    formatDate(isoString) {
        if (!isoString) return 'N/A';
        try {
            return new Date(isoString).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'Invalid date';
        }
    }

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

    destroy() {
        this.stopAutoRefresh();
    }

    syntaxHighlightJson(json) {
        if (typeof json !== 'string') {
            json = JSON.stringify(json, null, 2);
        }

        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            function (match) {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'json-key';
                    } else {
                        cls = 'json-string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return '<span class="' + cls + '">' + match + '</span>';
            }
        );
    }
}

// ============================================================================
// INITIALIZATION & COMPATIBILITY
// ============================================================================

let cvPoolManager;

// Ensure CVManager namespace exists
window.CVManager = window.CVManager || {};

// CRITICAL: Provide immediate placeholder for app.js module detection
// This prevents app.js from timing out while waiting for authentication
window.CVManager.cvManager = window.CVManager.cvManager || {
    cvs: [],
    initialized: false,
    saveCVs: () => console.warn('CVPoolManager not yet initialized'),
    updateDisplay: () => console.warn('CVPoolManager not yet initialized')
};

// Initialize when DOM and auth are ready
document.addEventListener('DOMContentLoaded', () => {
    const checkAuthAndInit = () => {
        if (window.CVManager?.auth?.isAuthenticated()) {
            cvPoolManager = new CVPoolManager();

            // Replace placeholder with actual instance
            window.CVManager.cvManager = cvPoolManager;
            window.cvPoolManager = cvPoolManager;

            console.log('✅ CVPoolManager v3.0 initialized');
        } else {
            setTimeout(checkAuthAndInit, 100);
        }
    };
    setTimeout(checkAuthAndInit, 500);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (cvPoolManager) {
        cvPoolManager.destroy();
    }
});

console.log('✅ CV Pool module loaded (v3.0.0 - Refactored with Delete & Parsing State)');