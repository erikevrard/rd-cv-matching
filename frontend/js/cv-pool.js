// CV Pool Manager - v2.2.0 with Backend Authentication
// API Configuration
const API_BASE_URL = 'http://localhost:3001';

class CVPoolManager {
    constructor() {
        this.cvs = [];
        this.settings = null;
        this.autoRefresh = false;
        this.refreshInterval = null;
        this.selectedCvId = null;

        this.init();
    }

    async init() {
        await this.loadSettings();
        await this.loadCVs();
        this.setupEventListeners();
        this.updateUI();
    }

    // ============================================================================
    // AUTHENTICATION HELPER
    // ============================================================================

    async authenticatedFetch(url, options = {}) {
        const auth = window.CVManager.auth;
        
        if (!auth || !auth.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const token = auth.getToken();
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        // Merge options, with user options taking precedence
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, mergedOptions);

            // Handle 401 Unauthorized
            if (response.status === 401) {
                this.showToast('Session expired. Please log in again.', 'error');
                window.CVManager.auth?.logout();
                throw new Error('Authentication failed');
            }

            return response;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    // ============================================================================
    // EVENT LISTENERS
    // ============================================================================

    setupEventListeners() {
        // File upload
        const fileInput = document.getElementById('cv-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Upload button
        const uploadBtn = document.getElementById('cv-upload-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => document.getElementById('cv-file-input')?.click());
        }

        // Process all button
        const processBtn = document.getElementById('cv-process-all-btn');
        if (processBtn) {
            processBtn.addEventListener('click', () => this.processAll());
        }

        // Settings button
        const settingsBtn = document.getElementById('cv-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }

        // Also handle the settings menu button
        const settingsMenuBtn = document.getElementById('settings-menu-btn');
        if (settingsMenuBtn) {
            settingsMenuBtn.addEventListener('click', () => this.showSettings());
        }

        // Auto-refresh toggle
        const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => this.toggleAutoRefresh(e.target.checked));
        }
    }

    // ============================================================================
    // DATA LOADING
    // ============================================================================

    async loadCVs() {
        try {
            const currentUser = window.CVManager.auth?.getCurrentUser();
            if (!currentUser) {
                console.log('No user logged in');
                return;
            }

            const url = `${API_BASE_URL}/api/cvs/${currentUser.id}`;
            console.log('Fetching CVs from:', url);

            const response = await this.authenticatedFetch(url);
            console.log('Response status:', response.status);

            const result = await response.json();
            console.log('API Result:', result);

            if (result.success) {
                this.cvs = result.data.cvs || [];
                
                // Calculate summary if not provided
                if (result.data.summary) {
                    this.summary = result.data.summary;
                } else {
                    this.summary = this.calculateSummary(this.cvs);
                }

                console.log('CVs loaded:', this.cvs.length, 'CVs');
                this.updateCVList();
                this.updateSummary();
            } else {
                console.error('API returned success: false', result);
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
            processing: cvs.filter(cv => cv.status === 'processing').length,
            parsed: cvs.filter(cv => cv.status === 'processed').length,
            failed: cvs.filter(cv => cv.status === 'error').length
        };
    }

    async loadSettings() {
        const userId = window.CVManager.auth?.getCurrentUser()?.id;
        if (!userId) return;

        try {
            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/settings/${userId}`
            );
            const result = await response.json();

            if (result.success) {
                this.settings = result.data;
                this.updateSettingsUI();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    // ============================================================================
    // FILE UPLOAD
    // ============================================================================

    async handleFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const currentUser = window.CVManager.auth?.getCurrentUser();
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
            
            // For multipart/form-data, don't set Content-Type header
            // Browser will set it automatically with boundary
            const response = await fetch(`${API_BASE_URL}/api/cvs/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // DON'T set Content-Type for multipart
                },
                body: formData
            });

            // Handle 401
            if (response.status === 401) {
                this.showToast('Session expired. Please log in again.', 'error');
                window.CVManager.auth?.logout();
                return;
            }

            const result = await response.json();

            if (result.success) {
                const uploaded = result.data.uploadedCount || result.data.uploaded?.length || 0;
                const rejected = result.data.rejectedCount || result.data.rejected?.length || 0;
                
                this.showToast(
                    `Uploaded ${uploaded} CV(s)${rejected > 0 ? `, ${rejected} rejected` : ''}`, 
                    'success'
                );
                
                await this.loadCVs();
                event.target.value = '';

                // Start auto-refresh for processing updates
                this.toggleAutoRefresh(true);
                setTimeout(() => this.toggleAutoRefresh(false), 30000);
            } else {
                this.showToast(`Upload failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('Upload failed', 'error');
        }
    }

    // ============================================================================
    // CV PROCESSING
    // ============================================================================

    async processAll() {
        const currentUser = window.CVManager.auth?.getCurrentUser();
        if (!currentUser) {
            this.showToast('Please log in first', 'error');
            return;
        }

        try {
            this.showToast('Starting CV processing...', 'info');
            
            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/cvs/process-all`,
                {
                    method: 'POST',
                    body: JSON.stringify({ userId: currentUser.id })
                }
            );

            const result = await response.json();

            if (result.success) {
                this.showToast(result.data.message, 'success');
                this.toggleAutoRefresh(true);
                setTimeout(() => this.toggleAutoRefresh(false), 60000);
            } else {
                this.showToast(`Processing failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Processing error:', error);
            this.showToast('Processing failed', 'error');
        }
    }

    async viewCV(cvId) {
        try {
            const currentUser = window.CVManager.auth?.getCurrentUser();
            if (!currentUser) return;

            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/cvs/detail/${cvId}?userId=${currentUser.id}`
            );
            const result = await response.json();

            if (result.success) {
                this.selectedCvId = cvId;
                this.showCVDetails(result.data);
            }
        } catch (error) {
            console.error('Error loading CV details:', error);
            this.showToast('Failed to load CV details', 'error');
        }
    }

    // ============================================================================
    // UI UPDATES
    // ============================================================================

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

        const cvListHTML = this.cvs.map(cv => {
            const statusIcon = this.getStatusIcon(cv.status);
            const statusClass = this.getStatusClass(cv.status);
            const confidence = cv.confidence ? cv.confidence.overall : null;

            return `
                <div class="cv-item ${this.selectedCvId === cv.id ? 'selected' : ''}" 
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
                            </div>
                        </div>
                        <div class="cv-badges">
                            <span class="cv-status-badge ${statusClass}">${cv.status}</span>
                            ${confidence ? `<span class="cv-confidence-badge ${this.getConfidenceClass(confidence)}">${confidence}</span>` : ''}
                        </div>
                    </div>
                    ${cv.errorMessage ? `<div class="cv-error">${this.escapeHtml(cv.errorMessage)}</div>` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = cvListHTML;
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

    showCVDetails(cv) {
        const container = document.getElementById('cv-details-container');
        if (!container) return;

        container.style.display = 'block';

        let extractionHTML = '';
        if (cv.extractionData) {
            const data = cv.extractionData;
            extractionHTML = `
                <div class="extraction-section">
                    <h4>Extracted Information</h4>
                    <div class="extraction-data">
                        ${data.firstName || data.lastName ? `
                            <div class="extraction-item">
                                <strong>Name:</strong> 
                                ${this.escapeHtml(data.firstName || '')} ${this.escapeHtml(data.lastName || '')}
                            </div>
                        ` : ''}
                        ${data.email ? `
                            <div class="extraction-item">
                                <strong>Email:</strong> ${this.escapeHtml(data.email)}
                            </div>
                        ` : ''}
                        ${data.phone ? `
                            <div class="extraction-item">
                                <strong>Phone:</strong> ${this.escapeHtml(data.phone)}
                            </div>
                        ` : ''}
                        ${data.address ? `
                            <div class="extraction-item">
                                <strong>Address:</strong> ${this.escapeHtml(data.address)}
                            </div>
                        ` : ''}
                        ${data.uniqueIdentifier ? `
                            <div class="extraction-item">
                                <strong>Unique ID:</strong> ${this.escapeHtml(data.uniqueIdentifier)}
                            </div>
                        ` : ''}
                        ${data.company ? `
                            <div class="extraction-item">
                                <strong>Company:</strong> ${this.escapeHtml(data.company)}
                            </div>
                        ` : ''}
                        ${data.profile ? `
                            <div class="extraction-item">
                                <strong>Profile:</strong> ${this.escapeHtml(data.profile)}
                            </div>
                        ` : ''}
                        ${data.seniority ? `
                            <div class="extraction-item">
                                <strong>Seniority:</strong> ${this.escapeHtml(data.seniority)}
                            </div>
                        ` : ''}
                    </div>
                    
                    ${data.confidence ? `
                        <div class="confidence-section">
                            <h5>Confidence Levels</h5>
                            <div class="confidence-grid">
                                <div class="confidence-item ${this.getConfidenceClass(data.confidence.name)}">
                                    Name: ${data.confidence.name}
                                </div>
                                <div class="confidence-item ${this.getConfidenceClass(data.confidence.contact)}">
                                    Contact: ${data.confidence.contact}
                                </div>
                                <div class="confidence-item ${this.getConfidenceClass(data.confidence.overall)}">
                                    Overall: ${data.confidence.overall}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${data.extractionNotes ? `
                        <div class="extraction-notes">
                            <h5>AI Notes</h5>
                            <div class="notes-content">${this.escapeHtml(data.extractionNotes)}</div>
                        </div>
                    ` : ''}
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
                    </div>
                </div>
                
                ${extractionHTML}
                
                ${cv.errorMessage ? `
                    <div class="error-section">
                        <h4>Error Details</h4>
                        <div class="cv-error">${this.escapeHtml(cv.errorMessage)}</div>
                    </div>
                ` : ''}
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
    // SETTINGS
    // ============================================================================

    showSettings() {
        let modal = document.getElementById('settings-modal');
        if (!modal) {
            this.createSettingsModal();
            modal = document.getElementById('settings-modal');
        }

        modal.style.display = 'flex';
        this.loadSettingsForm();
    }

    createSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>AI Configuration</h2>
                    <button class="modal-close" onclick="cvPoolManager.closeSettings()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="settings-form">
                        <div class="form-group">
                            <label>AI Provider</label>
                            <select id="ai-provider-select">
                                <option value="claude">Claude (Anthropic)</option>
                                <option value="openai">OpenAI</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Model</label>
                            <select id="ai-model-select">
                                <option value="claude-3-haiku-20240307">Claude 3 Haiku (Cheapest)</option>
                                <option value="claude-3-sonnet-20240229">Claude 3 Sonnet (Balanced)</option>
                                <option value="claude-3-opus-20240229">Claude 3 Opus (Best)</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>API URL</label>
                            <input type="url" id="ai-api-url" placeholder="https://api.anthropic.com/v1/messages">
                        </div>
                        
                        <div class="form-group">
                            <label>API Key</label>
                            <input type="password" id="ai-api-key" placeholder="Enter your API key">
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="ai-enabled"> Enable AI processing
                            </label>
                        </div>

                        <div class="form-group">
                            <label>CV Parsing Prompt</label>
                            <textarea id="ai-parsing-prompt" rows="8" placeholder="Enter the prompt for CV parsing..."></textarea>
                            <small style="color: var(--text-muted); font-size: 12px;">
                                This prompt instructs the AI how to extract information from CVs. 
                                Use placeholders like {CV_TEXT} where the CV content will be inserted.
                            </small>
                        </div>
                        
                        <div class="form-actions">
                            <button id="test-connection-btn" class="btn-secondary">Test Connection</button>
                            <button id="save-settings-btn" class="btn-primary">Save Settings</button>
                        </div>
                        
                        <div id="connection-result"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        document.getElementById('ai-provider-select').addEventListener('change', (e) => this.updateModelOptions(e.target.value));
        document.getElementById('test-connection-btn').addEventListener('click', () => this.testConnection());
        document.getElementById('save-settings-btn').addEventListener('click', () => this.saveSettings());
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeSettings();
            }
        });
    }

    loadSettingsForm() {
        if (!this.settings) return;

        const provider = this.settings.aiProvider;
        document.getElementById('ai-provider-select').value = provider.provider;
        document.getElementById('ai-model-select').value = provider.model;
        document.getElementById('ai-api-url').value = provider.apiUrl;
        document.getElementById('ai-api-key').value = provider.apiKey === '[SET]' ? '' : provider.apiKey;
        document.getElementById('ai-enabled').checked = provider.enabled;
        document.getElementById('ai-parsing-prompt').value = this.settings.parsingPrompt || '';

        this.updateModelOptions(provider.provider);
    }

    updateModelOptions(provider) {
        const modelSelect = document.getElementById('ai-model-select');
        const apiUrlInput = document.getElementById('ai-api-url');

        if (!modelSelect || !apiUrlInput) return;

        modelSelect.innerHTML = '';

        if (provider === 'claude') {
            modelSelect.innerHTML = `
                <option value="claude-3-haiku-20240307">Claude 3 Haiku (Cheapest)</option>
                <option value="claude-3-sonnet-20240229">Claude 3 Sonnet (Balanced)</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus (Best)</option>
            `;
            apiUrlInput.value = 'https://api.anthropic.com/v1/messages';
        } else if (provider === 'openai') {
            modelSelect.innerHTML = `
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast & Cheap)</option>
                <option value="gpt-4">GPT-4 (High Quality)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo (Latest)</option>
            `;
            apiUrlInput.value = 'https://api.openai.com/v1/chat/completions';
        } else {
            modelSelect.innerHTML = `
                <option value="custom-model">Custom Model</option>
            `;
            apiUrlInput.value = '';
        }
    }

    async testConnection() {
        const resultDiv = document.getElementById('connection-result');
        const testBtn = document.getElementById('test-connection-btn');

        if (!resultDiv || !testBtn) return;

        const config = {
            provider: document.getElementById('ai-provider-select').value,
            model: document.getElementById('ai-model-select').value,
            apiUrl: document.getElementById('ai-api-url').value,
            apiKey: document.getElementById('ai-api-key').value
        };

        if (!config.apiKey) {
            resultDiv.innerHTML = '<div class="result-error">Please enter an API key</div>';
            return;
        }

        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        resultDiv.innerHTML = '<div class="result-info">Testing connection...</div>';

        try {
            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/settings/test`,
                {
                    method: 'POST',
                    body: JSON.stringify(config)
                }
            );

            const result = await response.json();

            if (result.success && result.data.success) {
                resultDiv.innerHTML = `<div class="result-success">✓ Connection successful! Response time: ${result.data.responseTime}ms</div>`;
            } else {
                resultDiv.innerHTML = `<div class="result-error">✗ Connection failed: ${result.data.error}</div>`;
            }
        } catch (error) {
            resultDiv.innerHTML = `<div class="result-error">✗ Connection failed: ${error.message}</div>`;
        }

        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
    }

    async saveSettings() {
        const config = {
            userId: window.CVManager.auth?.getCurrentUser()?.id,
            provider: document.getElementById('ai-provider-select').value,
            model: document.getElementById('ai-model-select').value,
            apiUrl: document.getElementById('ai-api-url').value,
            apiKey: document.getElementById('ai-api-key').value,
            enabled: document.getElementById('ai-enabled').checked,
            parsingPrompt: document.getElementById('ai-parsing-prompt').value
        };

        try {
            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/settings/ai-provider`,
                {
                    method: 'POST',
                    body: JSON.stringify(config)
                }
            );

            const result = await response.json();

            if (result.success) {
                this.showToast('Settings saved successfully!', 'success');
                await this.loadSettings();
                this.closeSettings();
            } else {
                this.showToast(`Failed to save settings: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showToast('Failed to save settings', 'error');
        }
    }

    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // ============================================================================
    // AUTO-REFRESH
    // ============================================================================

    toggleAutoRefresh(enabled) {
        this.autoRefresh = enabled;

        if (enabled) {
            this.refreshInterval = setInterval(() => {
                this.loadCVs();
            }, 3000);
        } else if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        const toggle = document.getElementById('auto-refresh-toggle');
        if (toggle) {
            toggle.checked = enabled;
        }
    }

    // ============================================================================
    // UI MANAGEMENT
    // ============================================================================

    updateUI() {
        this.updateCVList();
        this.updateSummary();
        this.updateConfigWarning();
    }

    updateSettingsUI() {
        this.updateConfigWarning();
    }

    updateConfigWarning() {
        const warningContainer = document.getElementById('config-warning');
        if (!warningContainer) return;

        if (!this.settings || !this.settings.aiProvider.enabled) {
            warningContainer.innerHTML = `
                <div class="warning-banner">
                    <div class="warning-content">
                        <span class="warning-icon">⚠️</span>
                        <div>
                            <strong>AI Provider Not Configured</strong>
                            <p>Configure your AI provider in Settings to enable automatic CV parsing.</p>
                        </div>
                        <button onclick="cvPoolManager.showSettings()" class="btn-warning">Configure Now</button>
                    </div>
                </div>
            `;
        } else {
            warningContainer.innerHTML = '';
        }
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    getStatusIcon(status) {
        switch (status) {
            case 'uploaded': return '🕐';
            case 'processing': return '⚡';
            case 'processed': return '✅';
            case 'error': return '❌';
            default: return '📄';
        }
    }

    getStatusClass(status) {
        return `status-${status}`;
    }

    getConfidenceClass(confidence) {
        return `confidence-${confidence}`;
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
        // Create toast container if it doesn't exist
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

        // Remove toast after 5 seconds
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

// Initialize CV Pool Manager
let cvPoolManager;

// Wait for authentication before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated before initializing
    const checkAuthAndInit = () => {
        if (window.CVManager && window.CVManager.auth && window.CVManager.auth.isAuthenticated()) {
            cvPoolManager = new CVPoolManager();
            console.log('✅ CVPoolManager initialized');
        } else {
            // Wait a bit and try again
            setTimeout(checkAuthAndInit, 100);
        }
    };
    
    // Start checking after a short delay to let auth initialize
    setTimeout(checkAuthAndInit, 500);
});

// ============================================================================
// COMPATIBILITY LAYER FOR OTHER MODULES
// ============================================================================

window.CVManager = window.CVManager || {};

// Provide minimal implementations for app.js compatibility
if (!window.CVManager.cvManager) {
    window.CVManager.cvManager = {
        cvs: [],
        saveCVs: () => {
            console.warn('saveCVs called before CVPoolManager initialized');
        },
        updateDisplay: () => {
            console.warn('updateDisplay called before CVPoolManager initialized');
        }
    };
}

// Update the reference when cvPoolManager is initialized
Object.defineProperty(window.CVManager, 'cvManager', {
    get: function() {
        return cvPoolManager || {
            cvs: [],
            saveCVs: () => {},
            updateDisplay: () => {}
        };
    }
});

console.log('✅ CV Pool module loaded (v2.2.0 with backend authentication)');