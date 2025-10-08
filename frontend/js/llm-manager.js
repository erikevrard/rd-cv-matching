// LLM Manager - v2.2.0
// Manages LLM configurations for AI-powered CV processing

const API_BASE_URL = 'http://localhost:3001';

class LLMManager {
    constructor() {
        this.llms = [];
        this.activeLLM = null;
        this.editingLLM = null;
    }

    async init() {
        await this.loadLLMs();
        this.setupEventListeners();
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
        // Open LLM manager button
        const llmBtn = document.getElementById('llm-manager-btn');
        if (llmBtn) {
            llmBtn.addEventListener('click', () => this.showLLMManager());
        }

        // Also hook into settings button if LLM manager doesn't have dedicated button yet
        const settingsBtn = document.getElementById('settings-menu-btn');
        if (settingsBtn && !llmBtn) {
            // We'll add a check to show LLM manager instead of old settings
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLLMManager();
            });
        }
    }

    // ============================================================================
    // DATA LOADING
    // ============================================================================

    async loadLLMs() {
        const userId = window.CVManager.auth?.getCurrentUser()?.id;
        if (!userId) return;

        try {
            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/llms/${userId}`
            );
            const result = await response.json();

            if (result.success) {
                this.llms = result.data || [];
                this.activeLLM = this.llms.find(llm => llm.active);
                console.log('Loaded', this.llms.length, 'LLM configurations');
            }
        } catch (error) {
            console.error('Error loading LLMs:', error);
            this.showToast('Failed to load LLM configurations', 'error');
        }
    }

    async getActiveLLM() {
        const userId = window.CVManager.auth?.getCurrentUser()?.id;
        if (!userId) return null;

        try {
            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/llms/${userId}/active`
            );
            const result = await response.json();

            if (result.success) {
                this.activeLLM = result.data;
                return result.data;
            }
        } catch (error) {
            // 404 is normal if no active LLM
            if (error.message?.includes('404')) {
                return null;
            }
            console.error('Error getting active LLM:', error);
        }
        return null;
    }

    // ============================================================================
    // UI - MAIN MANAGER
    // ============================================================================

    showLLMManager() {
        let modal = document.getElementById('llm-manager-modal');
        if (!modal) {
            this.createLLMManagerModal();
            modal = document.getElementById('llm-manager-modal');
        }

        modal.style.display = 'flex';
        this.renderLLMList();
    }

    createLLMManagerModal() {
        const modal = document.createElement('div');
        modal.id = 'llm-manager-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2>LLM Configurations</h2>
                    <button class="modal-close" onclick="llmManager.closeLLMManager()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="llm-manager-header">
                        <p class="subtitle">Manage AI language model configurations for CV processing</p>
                        <button class="btn-primary" onclick="llmManager.showAddLLM()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add LLM Configuration
                        </button>
                    </div>
                    
                    <div id="llm-list-container" class="llm-list-container">
                        <!-- LLM cards will be rendered here -->
                    </div>
                    
                    <div id="llm-form-container" class="llm-form-container hidden">
                        <!-- Add/Edit form will be rendered here -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeLLMManager();
            }
        });
    }

    renderLLMList() {
        const container = document.getElementById('llm-list-container');
        if (!container) return;

        if (this.llms.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 60px 20px;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
                    </svg>
                    <h3>No LLM Configurations Yet</h3>
                    <p>Add your first LLM configuration to enable AI-powered CV processing</p>
                    <button class="btn-primary" onclick="llmManager.showAddLLM()">Add Your First LLM</button>
                </div>
            `;
            return;
        }

        const cards = this.llms.map(llm => this.createLLMCard(llm)).join('');
        container.innerHTML = `<div class="llm-grid">${cards}</div>`;
    }

    createLLMCard(llm) {
        const isActive = llm.active;
        const activeClass = isActive ? 'llm-card-active' : '';
        const activeBadge = isActive ? '<span class="badge active-badge">ACTIVE</span>' : '';

        return `
            <div class="llm-card ${activeClass}">
                <div class="llm-card-header">
                    <div class="llm-card-title">
                        <strong>${this.escapeHtml(llm.mnemonic)}</strong>
                        ${activeBadge}
                    </div>
                    <div class="llm-card-actions">
                        ${!isActive ? `
                            <button class="btn-icon" onclick="llmManager.setActive('${llm.mnemonic}')" title="Set as active">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
                                </svg>
                            </button>
                        ` : ''}
                        <button class="btn-icon" onclick="llmManager.editLLM('${llm.mnemonic}')" title="Edit">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-icon delete" onclick="llmManager.deleteLLM('${llm.mnemonic}')" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="llm-card-body">
                    ${llm.name ? `<div class="llm-detail"><strong>Name:</strong> ${this.escapeHtml(llm.name)}</div>` : ''}
                    <div class="llm-detail"><strong>Model:</strong> ${this.escapeHtml(llm.model)}</div>
                    <div class="llm-detail"><strong>Version:</strong> ${this.escapeHtml(llm.version)}</div>
                    <div class="llm-detail"><strong>API URL:</strong> <code class="url-code">${this.escapeHtml(llm.apiUrl)}</code></div>
                    ${llm.apiKey ? `<div class="llm-detail"><strong>API Key:</strong> <code>${this.maskKey(llm.apiKey)}</code></div>` : ''}
                    <div class="llm-detail"><strong>Temperature:</strong> ${llm.temperature}</div>
                    <div class="llm-detail"><strong>Max Tokens:</strong> ${llm.maxTokens}</div>
                </div>
                <div class="llm-card-footer">
                    <small>Created: ${this.formatDate(llm.createdAt)}</small>
                    ${llm.updatedAt !== llm.createdAt ? `<small>Updated: ${this.formatDate(llm.updatedAt)}</small>` : ''}
                </div>
            </div>
        `;
    }

    maskKey(key) {
        if (!key || key === '[SET]') return '••••••••';
        if (key.length <= 8) return '••••••••';
        return `${key.slice(0, 3)}•••${key.slice(-4)}`;
    }

    // ============================================================================
    // UI - ADD/EDIT FORM
    // ============================================================================

    showAddLLM() {
        this.editingLLM = null;
        this.renderLLMForm();
    }

    editLLM(mnemonic) {
        this.editingLLM = this.llms.find(llm => llm.mnemonic === mnemonic);
        this.renderLLMForm();
    }

    renderLLMForm() {
        const container = document.getElementById('llm-form-container');
        const listContainer = document.getElementById('llm-list-container');
        
        if (!container) return;

        const isEdit = !!this.editingLLM;
        const llm = this.editingLLM || {};

        // Hide list, show form
        if (listContainer) listContainer.classList.add('hidden');
        container.classList.remove('hidden');

        container.innerHTML = `
            <div class="llm-form">
                <div class="form-header">
                    <h3>${isEdit ? 'Edit' : 'Add'} LLM Configuration</h3>
                    <button class="btn-secondary" onclick="llmManager.cancelForm()">Cancel</button>
                </div>

                <div class="form-grid">
                    <div class="form-group">
                        <label>Name (Optional)</label>
                        <input type="text" id="llm-name" placeholder="e.g., My Claude Config" value="${llm.name || ''}">
                        <small>Friendly name to identify this configuration</small>
                    </div>

                    <div class="form-group">
                        <label>Model *</label>
                        <input type="text" id="llm-model" placeholder="e.g., claude-3-sonnet-20240229" value="${llm.model || ''}" required>
                        <small>Model identifier (e.g., gpt-4, claude-3-opus-20240229)</small>
                    </div>

                    <div class="form-group">
                        <label>Version *</label>
                        <input type="text" id="llm-version" placeholder="e.g., 2024-06-01 or v1" value="${llm.version || ''}" required>
                        <small>API version or model version</small>
                    </div>

                    <div class="form-group full-width">
                        <label>API URL *</label>
                        <input type="url" id="llm-api-url" placeholder="https://api.anthropic.com/v1/messages" value="${llm.apiUrl || ''}" required>
                    </div>

                    <div class="form-group full-width">
                        <label>API Key ${isEdit ? '(leave blank to keep existing)' : '*'}</label>
                        <input type="password" id="llm-api-key" placeholder="${isEdit ? 'Enter new key or leave blank' : 'Enter your API key'}" value="">
                    </div>

                    <div class="form-group">
                        <label>Temperature</label>
                        <input type="number" id="llm-temperature" min="0" max="2" step="0.1" value="${llm.temperature || 0}">
                        <small>0 = deterministic, 2 = creative</small>
                    </div>

                    <div class="form-group">
                        <label>Max Tokens</label>
                        <input type="number" id="llm-max-tokens" min="1" max="100000" value="${llm.maxTokens || 1024}">
                        <small>Maximum response length</small>
                    </div>

                    <div class="form-group">
                        <label>Timeout (ms)</label>
                        <input type="number" id="llm-timeout" min="1000" max="300000" step="1000" value="${llm.timeoutMs || 30000}">
                        <small>Request timeout in milliseconds</small>
                    </div>
                </div>

                <div class="form-actions">
                    <button class="btn-secondary" onclick="llmManager.testConnection()">Test Connection</button>
                    <button class="btn-primary" onclick="llmManager.saveLLM()">${isEdit ? 'Update' : 'Create'} Configuration</button>
                </div>

                <div id="llm-form-result"></div>
            </div>
        `;
    }

    cancelForm() {
        const container = document.getElementById('llm-form-container');
        const listContainer = document.getElementById('llm-list-container');
        
        if (container) container.classList.add('hidden');
        if (listContainer) listContainer.classList.remove('hidden');
        
        this.editingLLM = null;
    }

    async testConnection() {
        const resultDiv = document.getElementById('llm-form-result');
        if (!resultDiv) return;

        const config = this.getFormData();
        
        if (!config.model || !config.version || !config.apiUrl) {
            resultDiv.innerHTML = '<div class="result-error">Please fill in required fields</div>';
            return;
        }

        if (!config.apiKey && !this.editingLLM) {
            resultDiv.innerHTML = '<div class="result-error">API key is required for new configurations</div>';
            return;
        }

        resultDiv.innerHTML = '<div class="result-info">Testing connection...</div>';

        try {
            // For testing, we need to determine the provider from the URL
            let provider = 'custom';
            if (config.apiUrl.includes('anthropic.com')) provider = 'claude';
            if (config.apiUrl.includes('openai.com')) provider = 'openai';

            const testPayload = {
                provider,
                model: config.model,
                apiUrl: config.apiUrl,
                apiKey: config.apiKey || 'test-key' // Use placeholder if testing existing config
            };

            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/settings/test`,
                {
                    method: 'POST',
                    body: JSON.stringify(testPayload)
                }
            );

            const result = await response.json();

            if (result.success && result.data.success) {
                resultDiv.innerHTML = `<div class="result-success">✓ Connection successful! Response time: ${result.data.responseTime}ms</div>`;
            } else {
                resultDiv.innerHTML = `<div class="result-error">✗ Connection failed: ${result.data?.error || 'Unknown error'}</div>`;
            }
        } catch (error) {
            resultDiv.innerHTML = `<div class="result-error">✗ Connection test failed: ${error.message}</div>`;
        }
    }

    async saveLLM() {
        const resultDiv = document.getElementById('llm-form-result');
        if (!resultDiv) return;

        const config = this.getFormData();
        const userId = window.CVManager.auth?.getCurrentUser()?.id;

        if (!userId) {
            resultDiv.innerHTML = '<div class="result-error">User not authenticated</div>';
            return;
        }

        // Validation
        if (!config.model || !config.version || !config.apiUrl) {
            resultDiv.innerHTML = '<div class="result-error">Please fill in all required fields</div>';
            return;
        }

        if (!this.editingLLM && !config.apiKey) {
            resultDiv.innerHTML = '<div class="result-error">API key is required for new configurations</div>';
            return;
        }

        try {
            const payload = {
                userId,
                name: config.name || null,
                model: config.model,
                version: config.version,
                apiUrl: config.apiUrl,
                apiKey: config.apiKey || undefined,
                temperature: parseFloat(config.temperature) || 0,
                maxTokens: parseInt(config.maxTokens) || 1024,
                timeoutMs: parseInt(config.timeoutMs) || 30000
            };

            // TODO: Implement UPDATE endpoint when available
            // For now, only CREATE is supported
            if (this.editingLLM) {
                resultDiv.innerHTML = '<div class="result-error">Update functionality coming soon. Please delete and recreate.</div>';
                return;
            }

            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/llms`,
                {
                    method: 'POST',
                    body: JSON.stringify(payload)
                }
            );

            const result = await response.json();

            if (result.success) {
                this.showToast('LLM configuration saved successfully!', 'success');
                await this.loadLLMs();
                this.cancelForm();
                this.renderLLMList();
            } else {
                resultDiv.innerHTML = `<div class="result-error">Failed to save: ${result.error}</div>`;
            }
        } catch (error) {
            resultDiv.innerHTML = `<div class="result-error">Failed to save: ${error.message}</div>`;
        }
    }

    getFormData() {
        return {
            name: document.getElementById('llm-name')?.value.trim(),
            model: document.getElementById('llm-model')?.value.trim(),
            version: document.getElementById('llm-version')?.value.trim(),
            apiUrl: document.getElementById('llm-api-url')?.value.trim(),
            apiKey: document.getElementById('llm-api-key')?.value.trim(),
            temperature: document.getElementById('llm-temperature')?.value,
            maxTokens: document.getElementById('llm-max-tokens')?.value,
            timeoutMs: document.getElementById('llm-timeout')?.value
        };
    }

    // ============================================================================
    // ACTIONS
    // ============================================================================

    async setActive(mnemonic) {
        const userId = window.CVManager.auth?.getCurrentUser()?.id;
        if (!userId) return;

        try {
            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/llms/${userId}/${mnemonic}/active`,
                {
                    method: 'POST',
                    body: JSON.stringify({ active: true })
                }
            );

            const result = await response.json();

            if (result.success) {
                this.showToast('Active LLM updated', 'success');
                await this.loadLLMs();
                this.renderLLMList();
            } else {
                this.showToast(`Failed to set active: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showToast('Failed to set active LLM', 'error');
        }
    }

    async deleteLLM(mnemonic) {
        if (!confirm('Are you sure you want to delete this LLM configuration?')) {
            return;
        }

        const userId = window.CVManager.auth?.getCurrentUser()?.id;
        if (!userId) return;

        try {
            const response = await this.authenticatedFetch(
                `${API_BASE_URL}/api/llms/${userId}/${mnemonic}`,
                {
                    method: 'DELETE'
                }
            );

            const result = await response.json();

            if (result.success) {
                this.showToast('LLM configuration deleted', 'success');
                await this.loadLLMs();
                this.renderLLMList();
            } else {
                this.showToast(`Failed to delete: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showToast('Failed to delete LLM', 'error');
        }
    }

    closeLLMManager() {
        const modal = document.getElementById('llm-manager-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.editingLLM = null;
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

    formatDate(isoString) {
        if (!isoString) return 'N/A';
        try {
            return new Date(isoString).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return 'Invalid date';
        }
    }

    showToast(message, type = 'info') {
        // Reuse the toast system from cv-pool if available
        if (window.cvPoolManager && window.cvPoolManager.showToast) {
            window.cvPoolManager.showToast(message, type);
            return;
        }

        // Fallback toast implementation
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

let llmManager;

document.addEventListener('DOMContentLoaded', () => {
    const checkAuthAndInit = () => {
        if (window.CVManager && window.CVManager.auth && window.CVManager.auth.isAuthenticated()) {
            llmManager = new LLMManager();
            llmManager.init();
            console.log('✅ LLMManager initialized');
        } else {
            setTimeout(checkAuthAndInit, 100);
        }
    };
    
    setTimeout(checkAuthAndInit, 500);
});

console.log('✅ LLM Manager module loaded (v2.2.0)');