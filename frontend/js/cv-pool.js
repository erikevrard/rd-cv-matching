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

    async loadCVs() {
        try {
            const currentUser = window.CVManager.auth?.getCurrentUser();
            if (!currentUser) {
                console.log('No user logged in');
                return;
            }

            const url = `${API_BASE_URL}/api/cvs/${currentUser.id}`;
            console.log('Fetching CVs from:', url);

            const response = await fetch(url);
            console.log('Response status:', response.status);

            const result = await response.json();
            console.log('API Result:', result);

            if (result.success) {
                this.cvs = result.data.cvs;
                this.summary = result.data.summary;

                console.log('CVs loaded:', this.cvs.length, 'CVs');
                console.log('CV data:', this.cvs);

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

    async loadSettings() {
        const userId = window.CVManager.auth?.getCurrentUser()?.id;
        if (!userId) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/settings/${userId}`);
            const result = await response.json();

            if (result.success) {
                this.settings = result.data;
                this.updateSettingsUI();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async handleFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        // Get current user
        const currentUser = window.CVManager.auth?.getCurrentUser();
        if (!currentUser) {
            this.showToast('Please log in first', 'error');
            return;
        }

        const formData = new FormData();

        // Add userId to formData
        formData.append('userId', currentUser.id);

        Array.from(files).forEach(file => {
            formData.append('cvs', file);
        });

        try {
            this.showToast('Uploading CVs...', 'info');
            const response = await fetch(`${API_BASE_URL}/api/cvs/upload`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.showToast(`Uploaded ${result.data.uploaded} CVs successfully`, 'success');
                await this.loadCVs();

                // Clear file input
                event.target.value = '';

                // Start auto-refresh for processing updates
                this.toggleAutoRefresh(true);
                setTimeout(() => this.toggleAutoRefresh(false), 30000); // Stop after 30 seconds
            } else {
                this.showToast(`Upload failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('Upload failed', 'error');
        }
    }

    async processAll() {
        try {
            this.showToast('Starting CV processing...', 'info');
            const response = await fetch(`${API_BASE_URL}/api/cvs/process-all`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                this.showToast(result.data.message, 'success');
                this.toggleAutoRefresh(true);
                setTimeout(() => this.toggleAutoRefresh(false), 60000); // Stop after 1 minute
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

            const response = await fetch(`${API_BASE_URL}/api/cvs/detail/${cvId}?userId=${currentUser.id}`);
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
                                <div class="cv-filename">${cv.filename}</div>
                                <div class="cv-meta">
                                    ${this.formatFileSize(cv.fileSize)} • 
                                    ${this.formatDate(cv.uploadedAt)}
                                    ${cv.processingAttempts > 0 ? ` • ${cv.processingAttempts} attempts` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="cv-badges">
                            <span class="cv-status-badge ${statusClass}">${cv.status}</span>
                            ${confidence ? `<span class="cv-confidence-badge ${this.getConfidenceClass(confidence)}">${confidence}</span>` : ''}
                        </div>
                    </div>
                    ${cv.errorMessage ? `<div class="cv-error">${cv.errorMessage}</div>` : ''}
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

        let extractionHTML = '';
        if (cv.extractionData && cv.extractionData.data) {
            const data = cv.extractionData.data;
            extractionHTML = `
                <div class="extraction-section">
                    <h4>Extracted Information</h4>
                    <div class="extraction-data">
                        <div class="extraction-item">
                            <strong>Name:</strong> 
                            ${data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : 'Not found'}
                        </div>
                        <div class="extraction-item">
                            <strong>Email:</strong> ${data.email || 'Not found'}
                        </div>
                        <div class="extraction-item">
                            <strong>Phone:</strong> ${data.phone || 'Not found'}
                        </div>
                        <div class="extraction-item">
                            <strong>Address:</strong> ${data.address || 'Not found'}
                        </div>
                        <div class="extraction-item">
                            <strong>Unique ID:</strong> ${data.uniqueIdentifier || 'Not found'}
                        </div>
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
                            <div class="notes-content">${data.extractionNotes}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="cv-details-header">
                <h3>${cv.filename}</h3>
                <span class="cv-status-badge ${this.getStatusClass(cv.status)}">${cv.status}</span>
            </div>
            
            <div class="cv-details-content">
                <div class="file-info-section">
                    <h4>File Information</h4>
                    <div class="file-info">
                        <div><strong>Size:</strong> ${this.formatFileSize(cv.fileSize)}</div>
                        <div><strong>Type:</strong> ${cv.fileType?.toUpperCase()}</div>
                        <div><strong>Uploaded:</strong> ${this.formatDate(cv.uploadedAt)}</div>
                        ${cv.processedAt ? `<div><strong>Processed:</strong> ${this.formatDate(cv.processedAt)}</div>` : ''}
                        ${cv.processingAttempts > 0 ? `<div><strong>Attempts:</strong> ${cv.processingAttempts}</div>` : ''}
                    </div>
                </div>
                
                ${extractionHTML}
                
                ${cv.errorMessage ? `
                    <div class="error-section">
                        <h4>Error Details</h4>
                        <div class="error-message">${cv.errorMessage}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    showSettings() {
        const modal = document.getElementById('settings-modal');
        if (!modal) {
            this.createSettingsModal();
        }

        const settingsModal = document.getElementById('settings-modal');
        settingsModal.style.display = 'block';
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
            const response = await fetch(`${API_BASE_URL}/api/settings/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

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
            const response = await fetch(`${API_BASE_URL}/api/settings/ai-provider`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

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

    updateUI() {
        this.updateCVList();
        this.updateSummary();
        this.updateConfigWarning();
    }

    updateSettingsUI() {
        // Update any UI elements that depend on settings
        // For example, update the auto-refresh toggle state
        const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
        if (autoRefreshToggle && this.settings) {
            // Set any default states based on settings if they exist
            if (this.settings.autoRefresh !== undefined) {
                autoRefreshToggle.checked = this.settings.autoRefresh;
            }
        }

        // Update configuration warning based on current settings
        this.updateConfigWarning();

        // If there are any other UI elements that depend on settings, update them here
        console.log('Settings UI updated:', this.settings);
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

    // Utility methods
    getStatusIcon(status) {
        switch (status) {
            case 'uploaded': return '🕒';
            case 'processing': return '⚡';
            case 'parsed': return '✅';
            case 'failed': return '❌';
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
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    formatDate(isoString) {
        return new Date(isoString).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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

// Initialize CV Pool Manager
let cvPoolManager;

// Add this at the very end of cv-pool.js to satisfy app.js dependencies
window.CVManager = window.CVManager || {};

// Map the cv-pool manager to the expected structure
window.CVManager.cvManager = cvPoolManager || {
    cvs: [],
    saveCVs: () => { },
    updateDisplay: () => { }
};

// Provide minimal implementations for other expected modules
window.CVManager.auth = {
    getCurrentUser: () => ({ name: 'Erik Evrard', email: 'erik@example.com' })
};

window.CVManager.ui = {
    switchTab: (tabName) => {
        // Remove active class from all tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Activate the requested tab
        const tab = document.querySelector(`[data-tab="${tabName}"]`);
        const content = document.getElementById(tabName);

        if (tab) tab.classList.add('active');
        if (content) content.classList.add('active');
    },
    getActiveTab: () => {
        const activeTab = document.querySelector('.nav-tab.active');
        return activeTab ? activeTab.dataset.tab : 'cv-pool';
    },
    showNotification: (message, type = 'info', duration = 3000) => {
        if (typeof cvPoolManager !== 'undefined' && cvPoolManager.showToast) {
            cvPoolManager.showToast(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
};

window.CVManager.config = {
    sampleCVData: [] // Empty for now
};

console.log('✅ CVManager modules registered for app.js compatibility');