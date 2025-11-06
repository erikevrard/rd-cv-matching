// Prompt Manager - v1.0.1
// Manages LLM prompt templates with variable substitution

(function () {
    'use strict';

    const API_BASE_URL = window.CVManager?.config?.api?.baseUrl || 'http://localhost:3001';

    class PromptManager {
        constructor() {
            this.prompts = [];
            this.activePrompt = null;
            this.editingPrompt = null;
        }

        async init() {
            await this.loadPrompts();
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
            // Hook into Settings button to show prompt manager
            const settingsBtn = document.getElementById('cv-settings-btn');
            if (settingsBtn) {
                // We'll add a separate prompts button, or integrate into settings modal
                // For now, we'll create a dedicated button
            }
        }

        // ============================================================================
        // DATA LOADING
        // ============================================================================

        async loadPrompts() {
            const userId = window.CVManager.auth?.getCurrentUser()?.id;
            if (!userId) return;

            try {
                const response = await this.authenticatedFetch(
                    `${API_BASE_URL}/api/prompts/${userId}`
                );
                const result = await response.json();

                if (result.success) {
                    this.prompts = result.data || [];
                    this.activePrompt = this.prompts.find(p => p.active);
                    console.log('Loaded', this.prompts.length, 'prompts');
                }
            } catch (error) {
                console.error('Error loading prompts:', error);
                this.showToast('Failed to load prompts', 'error');
            }
        }

        async getActivePrompt() {
            const userId = window.CVManager.auth?.getCurrentUser()?.id;
            if (!userId) return null;

            try {
                const response = await this.authenticatedFetch(
                    `${API_BASE_URL}/api/prompts/${userId}/active`
                );
                const result = await response.json();

                if (result.success) {
                    this.activePrompt = result.data;
                    return result.data;
                }
            } catch (error) {
                if (!error.message?.includes('404')) {
                    console.error('Error getting active prompt:', error);
                }
            }
            return null;
        }

        // ============================================================================
        // UI - PROMPT MANAGER MODAL
        // ============================================================================

        showPromptManager() {
            let modal = document.getElementById('prompt-manager-modal');
            if (!modal) {
                this.createPromptManagerModal();
                modal = document.getElementById('prompt-manager-modal');
            }

            modal.style.display = 'flex';
            this.renderPromptList();
        }

        createPromptManagerModal() {
            const modal = document.createElement('div');
            modal.id = 'prompt-manager-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 1000px;">
                    <div class="modal-header">
                        <h2>Prompt Templates</h2>
                        <button class="modal-close" onclick="promptManager.closePromptManager()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="prompt-manager-header">
                            <p class="subtitle">Create and manage LLM prompt templates with variable substitution</p>
                            <button class="btn-primary" onclick="promptManager.showAddPrompt()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Create Prompt
                            </button>
                        </div>
                        
                        <div id="prompt-list-container" class="prompt-list-container">
                            <!-- Prompt cards will be rendered here -->
                        </div>
                        
                        <div id="prompt-form-container" class="prompt-form-container hidden">
                            <!-- Add/Edit form will be rendered here -->
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closePromptManager();
                }
            });
        }

        renderPromptList() {
            const container = document.getElementById('prompt-list-container');
            if (!container) return;

            if (this.prompts.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding: 60px 20px;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14,2 14,8 20,8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                        <h3>No Prompt Templates Yet</h3>
                        <p>Create your first prompt template to customize CV parsing</p>
                        <button class="btn-primary" onclick="promptManager.showAddPrompt()">Create Your First Prompt</button>
                    </div>
                `;
                return;
            }

            const cards = this.prompts.map(prompt => this.createPromptCard(prompt)).join('');
            container.innerHTML = `<div class="prompt-grid">${cards}</div>`;
        }

        createPromptCard(prompt) {
            const isActive = prompt.active;
            const activeClass = isActive ? 'prompt-card-active' : '';
            const activeBadge = isActive ? '<span class="badge active-badge">ACTIVE</span>' : '';

            // Map backend fields to frontend display
            const variables = Array.isArray(prompt.tags) ? prompt.tags : [];
            const variablesList = variables.length > 0
                ? variables.map(v => `<code>{${this.escapeHtml(v)}}</code>`).join(' ')
                : '<span style="color: var(--text-muted);">No variables</span>';

            const template = prompt.text || '';
            const previewText = template.length > 200
                ? template.substring(0, 200) + '...'
                : template;

            return `
        <div class="prompt-card ${activeClass}">
            <div class="prompt-card-header">
                <div class="prompt-card-title">
                    <div class="mnemonic-badge">${this.escapeHtml(prompt.mnemonic)}</div>
                    ${activeBadge}
                </div>
                <div class="prompt-card-actions">
                    ${!isActive ? `
                        <button class="btn-icon" onclick="promptManager.setActive('${prompt.mnemonic}')" title="Set as active">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
                            </svg>
                        </button>
                    ` : ''}
                    <button class="btn-icon" onclick="promptManager.editPrompt('${prompt.mnemonic}')" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon delete" onclick="promptManager.deletePrompt('${prompt.mnemonic}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="prompt-card-body">
                ${prompt.title ? `<div class="prompt-detail"><strong>Name:</strong> ${this.escapeHtml(prompt.title)}</div>` : ''}
                <div class="prompt-detail">
                    <strong>Variables:</strong>
                    <div class="variables-list">${variablesList}</div>
                </div>
                
                <div class="prompt-detail">
                    <strong>Template Preview:</strong>
                    <div class="template-preview">${this.escapeHtml(previewText)}</div>
                </div>
            </div>
            
            <div class="prompt-card-footer">
                <small>Created: ${this.formatDate(prompt.createdAt)}</small>
            </div>
        </div>
    `;
        }

        // ============================================================================
        // UI - ADD/EDIT FORM
        // ============================================================================

        showAddPrompt() {
            this.editingPrompt = null;
            this.renderPromptForm();
        }

        editPrompt(mnemonic) {
            this.editingPrompt = this.prompts.find(p => p.mnemonic === mnemonic);
            if (this.editingPrompt) {
                this.renderPromptForm();
            }
        }

        renderPromptForm() {
            const container = document.getElementById('prompt-form-container');
            const listContainer = document.getElementById('prompt-list-container');

            if (!container) return;

            // Hide list, show form
            if (listContainer) listContainer.classList.add('hidden');
            container.classList.remove('hidden');

            const prompt = this.editingPrompt || {};
            const isEdit = !!this.editingPrompt;

            // Map backend fields to frontend form
            const name = prompt.title || '';
            const template = prompt.text || '';

            container.innerHTML = `
                <div class="form-container">
                    <div class="form-header">
                        <h3>${isEdit ? 'Edit' : 'Create'} Prompt Template</h3>
                        <button class="btn-secondary" onclick="promptManager.cancelForm()">Cancel</button>
                    </div>

                    ${isEdit ? `
                        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: var(--border-radius); padding: var(--spacing-sm); margin-bottom: var(--spacing-md);">
                            <strong>Note:</strong> Editing will create a new prompt with a new mnemonic. The original "${this.escapeHtml(prompt.mnemonic)}" will remain unchanged.
                        </div>
                    ` : ''}

                    <div class="form-section">
                        <h4>Basic Information</h4>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Name (Optional)</label>
                                <input type="text" id="prompt-name" placeholder="e.g., Standard CV Parser" value="${this.escapeHtml(name)}">
                                <small>Friendly name to identify this prompt</small>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>Prompt Template</h4>
                        
                        <div class="form-group">
                            <label>Template * <span style="font-weight: normal; color: var(--text-muted); font-size: var(--font-size-xs);">(Use {VARIABLE_NAME} for substitution)</span></label>
                            <textarea id="prompt-template" rows="15" placeholder="Extract the following information from this CV:&#10;&#10;{CV_TEXT}&#10;&#10;Return JSON with fields: name, email, phone..." required>${this.escapeHtml(template)}</textarea>
                            <small>Use curly braces for variables, e.g., {CV_TEXT}, {JOB_TITLE}, {SENIORITY}</small>
                        </div>

                        <div class="form-group">
                            <label>Variables Detected:</label>
                            <div id="detected-variables" style="padding: var(--spacing-sm); background: var(--background); border-radius: var(--border-radius-sm); min-height: 40px; font-family: monospace; font-size: var(--font-size-sm);">
                                <span style="color: var(--text-muted);">Type your template above to detect variables</span>
                            </div>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button class="btn-secondary" onclick="promptManager.cancelForm()">Cancel</button>
                        <button class="btn-primary" onclick="promptManager.savePrompt()">${isEdit ? 'Create New' : 'Create'} Prompt</button>
                    </div>

                    <div id="prompt-form-result" style="margin-top: 16px;"></div>
                </div>
            `;

            // Add event listener for template textarea to detect variables
            const templateTextarea = document.getElementById('prompt-template');
            if (templateTextarea) {
                templateTextarea.addEventListener('input', () => this.updateDetectedVariables());
                // Trigger initial update if editing
                if (isEdit) {
                    this.updateDetectedVariables();
                }
            }
        }

        updateDetectedVariables() {
            const template = document.getElementById('prompt-template')?.value || '';
            const detectedDiv = document.getElementById('detected-variables');

            if (!detectedDiv) return;

            // Extract variables using regex: {VARIABLE_NAME}
            const variableRegex = /\{([A-Z_]+)\}/g;
            const matches = [...template.matchAll(variableRegex)];
            const variables = [...new Set(matches.map(m => m[1]))]; // Unique variables

            if (variables.length === 0) {
                detectedDiv.innerHTML = '<span style="color: var(--text-muted);">No variables detected</span>';
            } else {
                detectedDiv.innerHTML = variables.map(v => `<code style="margin-right: var(--spacing-xs); padding: var(--spacing-xs); background: var(--surface); border: 1px solid var(--border); border-radius: 4px;">{${v}}</code>`).join('');
            }
        }

        cancelForm() {
            const container = document.getElementById('prompt-form-container');
            const listContainer = document.getElementById('prompt-list-container');

            if (container) container.classList.add('hidden');
            if (listContainer) listContainer.classList.remove('hidden');

            this.editingPrompt = null;
        }

        generateMnemonic(name) {
            if (name && name.trim()) {
                const cleaned = name
                    .toUpperCase()
                    .replace(/[^A-Z0-9]+/g, '_')
                    .replace(/^_+|_+$/g, '');
                
                if (cleaned.length > 0) {
                    return cleaned.substring(0, 40);
                }
            }
            // Fallback to timestamp
            return `PROMPT_${Date.now()}`;
        }

        async savePrompt() {
            const resultDiv = document.getElementById('prompt-form-result');
            if (!resultDiv) return;

            const userId = window.CVManager.auth?.getCurrentUser()?.id;
            if (!userId) {
                resultDiv.innerHTML = '<div style="background: #fee; border: 1px solid #fcc; padding: 12px; border-radius: 6px; color: #c00; margin-top: 12px;">User not authenticated</div>';
                return;
            }

            const name = document.getElementById('prompt-name')?.value.trim();
            const template = document.getElementById('prompt-template')?.value.trim();

            // Validation
            if (!template) {
                resultDiv.innerHTML = '<div style="background: #fee; border: 1px solid #fcc; padding: 12px; border-radius: 6px; color: #c00; margin-top: 12px;">Please enter a prompt template</div>';
                return;
            }

            // Extract variables
            const variableRegex = /\{([A-Z_]+)\}/g;
            const matches = [...template.matchAll(variableRegex)];
            const variables = [...new Set(matches.map(m => m[1]))];

            // Generate mnemonic
            const mnemonic = this.generateMnemonic(name);

            // Build payload
            const payload = {
                userId,
                mnemonic,
                text: template,
                title: name || undefined,
                tags: variables.length > 0 ? variables : undefined
            };

            console.log('📤 Sending prompt payload:', payload);

            try {
                const response = await this.authenticatedFetch(
                    `${API_BASE_URL}/api/prompts`,
                    {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    }
                );

                const result = await response.json();
                console.log('📥 Received response:', result);

                if (result.success) {
                    this.showToast('Prompt template saved successfully!', 'success');
                    await this.loadPrompts();
                    this.cancelForm();
                    this.renderPromptList();
                } else {
                    const errorMsg = result.error || 'Unknown error';
                    resultDiv.innerHTML = `<div style="background: #fee; border: 1px solid #fcc; padding: 12px; border-radius: 6px; color: #c00; margin-top: 12px;"><strong>Failed to save:</strong> ${this.escapeHtml(errorMsg)}</div>`;
                }
            } catch (error) {
                console.error('❌ Save error:', error);
                resultDiv.innerHTML = `<div style="background: #fee; border: 1px solid #fcc; padding: 12px; border-radius: 6px; color: #c00; margin-top: 12px;"><strong>Failed to save:</strong> ${this.escapeHtml(error.message)}</div>`;
            }
        }

        // ============================================================================
        // ACTIONS
        // ============================================================================

        async setActive(mnemonic) {
            const userId = window.CVManager.auth?.getCurrentUser()?.id;
            if (!userId) return;

            try {
                const response = await this.authenticatedFetch(
                    `${API_BASE_URL}/api/prompts/${userId}/${mnemonic}/active`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ active: true })
                    }
                );

                const result = await response.json();

                if (result.success) {
                    this.showToast('Active prompt updated', 'success');
                    await this.loadPrompts();
                    this.renderPromptList();
                } else {
                    this.showToast(`Failed to set active: ${result.error}`, 'error');
                }
            } catch (error) {
                this.showToast('Failed to set active prompt', 'error');
            }
        }

        async deletePrompt(mnemonic) {
            if (!confirm('Are you sure you want to delete this prompt template?')) {
                return;
            }

            const userId = window.CVManager.auth?.getCurrentUser()?.id;
            if (!userId) return;

            try {
                const response = await this.authenticatedFetch(
                    `${API_BASE_URL}/api/prompts/${userId}/${mnemonic}`,
                    {
                        method: 'DELETE'
                    }
                );

                const result = await response.json();

                if (result.success) {
                    this.showToast('Prompt template deleted', 'success');
                    await this.loadPrompts();
                    this.renderPromptList();
                } else {
                    this.showToast(`Failed to delete: ${result.error}`, 'error');
                }
            } catch (error) {
                this.showToast('Failed to delete prompt', 'error');
            }
        }

        closePromptManager() {
            const modal = document.getElementById('prompt-manager-modal');
            if (modal) {
                modal.style.display = 'none';
            }
            this.editingPrompt = null;
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
            if (window.cvPoolManager && window.cvPoolManager.showToast) {
                window.cvPoolManager.showToast(message, type);
                return;
            }

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

    let promptManager;

    document.addEventListener('DOMContentLoaded', () => {
        const checkAuthAndInit = () => {
            if (window.CVManager && window.CVManager.auth && window.CVManager.auth.isAuthenticated()) {
                promptManager = new PromptManager();
                promptManager.init();

                window.promptManager = promptManager;

                console.log('✅ PromptManager initialized');
            } else {
                setTimeout(checkAuthAndInit, 100);
            }
        };

        setTimeout(checkAuthAndInit, 500);
    });

    console.log('✅ Prompt Manager module loaded (v1.0.1)');

})();