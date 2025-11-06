(function () {
    'use strict';

    console.log('🔧 UI.JS Loading - Version 3.0 - Modern UX');

    const API_BASE_URL = window.CVManager?.config?.api?.baseUrl || 'http://localhost:3001';
    console.log('🔧 API Base URL:', API_BASE_URL);

    window.CVManager = window.CVManager || {};

    class UIManager {
        constructor() {
            this.activeTab = 'cv-pool';
            this.activeSettingTab = 'llm-providers';
            this.editingLLM = null;
            this.editingPrompt = null;
            this.editingTaxonomy = null;
            console.log('✅ UIManager constructor called');
        }

        init() {
            console.log('🔧 UIManager.init() called');
            this.bindTabNavigation();
            this.claimSettingsButton();
            this.setupResponsiveHandling();
            this.bindSettingsNavigation();
            this.wireSettingsChrome();
            console.log('✅ UIManager initialized');
        }

        claimSettingsButton() {
            console.log('🎯 Claiming settings-menu-btn...');

            const btn = document.getElementById('settings-menu-btn');
            if (!btn) {
                console.warn('⚠️ settings-menu-btn not found');
                return;
            }

            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            console.log('✅ Cloned button to remove old listeners');

            newBtn.addEventListener('click', (e) => {
                console.log('🚀 Settings button clicked (ui.js handler)');
                e.preventDefault();
                e.stopImmediatePropagation();
                this.openSettings();
            }, true);

            console.log('✅ Settings button claimed by ui.js');
        }

        openSettings() {
            console.log('🔧 openSettings() called');
            this.switchTab('settings');
            this.switchSettingTab('llm-providers');
            this.loadLLMProviders();
        }

        bindTabNavigation() {
            const navTabs = document.querySelectorAll('.nav-tab');
            navTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetTab = tab.dataset.tab;
                    this.switchTab(targetTab);
                });
            });
        }

        switchTab(tabId) {
            console.log('🔧 Switching to tab:', tabId);
            this.activeTab = tabId;

            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('active');
                if (tab.dataset.tab === tabId) {
                    tab.classList.add('active');
                }
            });

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            const activeContent = document.getElementById(tabId);
            if (activeContent) {
                activeContent.classList.add('active');
            }

            this.handleTabChange(tabId);
        }

        handleTabChange(tabId) {
            switch (tabId) {
                case 'cv-pool':
                    if (window.cvPoolManager) {
                        window.cvPoolManager.loadCVs();
                        window.cvPoolManager.updateUI();
                    }
                    break;
                case 'tender-requests':
                    const tenderSection = document.getElementById('tender-requests');
                    const placeholder = tenderSection?.querySelector('.placeholder-content');
                    if (placeholder) placeholder.remove();

                    if (window.tenderSearchBuilder) {
                        window.tenderSearchBuilder.renderTenderRequestsTab();
                    }
                    break;
                case 'matching':
                    if (window.matchingManager) {
                        window.matchingManager.init();
                    }
                    break;
            }
        }

        setupResponsiveHandling() {
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => this.handleResize(), 100);
            });
            this.handleResize();
        }

        handleResize() {
            const isMobile = window.innerWidth <= 768;
            const isTablet = window.innerWidth <= 1024;

            document.body.classList.toggle('mobile', isMobile);
            document.body.classList.toggle('tablet', isTablet && !isMobile);
            document.body.classList.toggle('desktop', !isTablet);
        }

        bindSettingsNavigation() {
            const settingsSection = document.getElementById('settings');
            if (!settingsSection) return;

            const nav = settingsSection.querySelector('.settings-nav');
            if (!nav) return;

            nav.addEventListener('click', (e) => {
                const btn = e.target.closest('.settings-tab');
                if (!btn) return;

                const target = btn.getAttribute('data-setting');
                if (!target) return;

                this.switchSettingTab(target);

                switch (target) {
                    case 'llm-providers':
                        this.loadLLMProviders();
                        break;
                    case 'prompt-templates':
                        this.loadPrompts();
                        break;
                    case 'taxonomy':
                        this.loadTaxonomy();
                        break;
                    case 'users':
                        this.loadUsers();
                        break;
                }
            });
        }

        switchSettingTab(settingName) {
            console.log('🔧 Switching to setting tab:', settingName);
            this.activeSettingTab = settingName;

            const settingsSection = document.getElementById('settings');
            if (!settingsSection) return;

            const allBtns = settingsSection.querySelectorAll('.settings-tab');
            const allPanels = settingsSection.querySelectorAll('.setting-content');

            allBtns.forEach(btn => {
                const isActive = btn.getAttribute('data-setting') === settingName;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', String(isActive));
            });

            allPanels.forEach(panel => {
                const id = panel.id.replace('setting-', '');
                panel.classList.toggle('hidden', id !== settingName);
            });
        }

        wireSettingsChrome() {
            const btn = document.getElementById('settings-fullscreen-toggle');
            const sec = document.getElementById('settings');
            if (btn && sec) {
                btn.addEventListener('click', () => {
                    sec.classList.toggle('fullscreen');
                });
            }
        }

        // ============================================================
        // LLM PROVIDERS - Modern UX with Inline Editing
        // ============================================================

        async loadLLMProviders() {
            console.log('🔧 loadLLMProviders() called');
            const mount = document.getElementById('llm-providers-mount');
            if (!mount) {
                console.warn('⚠️ llm-providers-mount not found');
                return;
            }

            const userId = window.CVManager?.auth?.currentUser?.id;
            if (!userId) {
                mount.innerHTML = '<p class="empty">Please log in to manage LLM providers.</p>';
                return;
            }

            mount.innerHTML = '<p class="loading">Loading LLM providers...</p>';

            try {
                const url = `${API_BASE_URL}/api/llms/${encodeURIComponent(userId)}`;
                console.log('🔧 Fetching LLMs from:', url);

                const res = await window.CVManager.auth.authenticatedFetch(url);
                console.log('🔧 LLM Response status:', res.status);

                if (!res.ok) {
                    if (res.status === 404) {
                        mount.innerHTML = `
                            <div class="error">
                                <p><strong>Endpoint Not Found (404)</strong></p>
                                <p>The backend endpoint <code>${url}</code> does not exist.</p>
                            </div>
                        `;
                        return;
                    }
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await res.text();
                    console.error('❌ Non-JSON response:', text.substring(0, 200));
                    throw new Error('Server returned non-JSON response');
                }

                const js = await res.json();
                console.log('🔧 LLM data:', js);

                if (!js.success) {
                    throw new Error(js.error || 'Failed to load LLM providers');
                }

                this.renderLLMProviders(mount, js.data || [], userId);
            } catch (e) {
                console.error('❌ Error loading LLM providers:', e);
                mount.innerHTML = `
                    <div class="error">
                        <p><strong>Error Loading LLM Providers</strong></p>
                        <p>${this.escapeHtml(e.message)}</p>
                        <button class="btn-secondary" onclick="window.CVManager.ui.loadLLMProviders()">Retry</button>
                    </div>
                `;
            }
        }

        renderLLMProviders(mount, data, userId) {
            // If editing, show edit form
            if (this.editingLLM !== null) {
                this.renderLLMEditForm(mount, this.editingLLM, data, userId);
                return;
            }

            const rows = data.map(llm => `
                <tr>
                    <td><code>${this.escapeHtml(llm.mnemonic)}</code></td>
                    <td>${this.escapeHtml(llm.model || '')}</td>
                    <td>${this.escapeHtml(llm.version || '')}</td>
                    <td>
                        ${llm.active
                    ? '<span class="badge badge-success">Active</span>'
                    : '<span class="badge badge-inactive">Inactive</span>'}
                    </td>
                    <td>
                        <div class="btn-group">
                            ${!llm.active
                    ? `<button class="btn-link" data-action="activate" data-mnemonic="${this.escapeHtml(llm.mnemonic)}" title="Activate">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"></polygon>
                                    </svg>
                                </button>`
                    : `<button class="btn-link" data-action="deactivate" data-mnemonic="${this.escapeHtml(llm.mnemonic)}" title="Deactivate">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="15" y1="9" x2="9" y2="15"></line>
                                        <line x1="9" y1="9" x2="15" y2="15"></line>
                                    </svg>
                                </button>`
                }
                            <button class="btn-link" data-action="edit" data-mnemonic="${this.escapeHtml(llm.mnemonic)}" title="Edit">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-link btn-link-danger" data-action="delete" data-mnemonic="${this.escapeHtml(llm.mnemonic)}" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            mount.innerHTML = `
                <div class="actions">
                    <button id="add-llm-btn" class="btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add LLM Provider
                    </button>
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Mnemonic</th>
                            <th>Model</th>
                            <th>Version</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="5" class="empty">No LLM providers configured.</td></tr>'}</tbody>
                </table>
            `;

            mount.onclick = async (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                const mnemonic = btn.dataset.mnemonic;

                if (btn.id === 'add-llm-btn') {
                    this.editingLLM = { isNew: true };
                    this.renderLLMProviders(mount, data, userId);
                } else if (btn.dataset.action === 'edit') {
                    const llm = data.find(l => l.mnemonic === mnemonic);
                    if (llm) {
                        this.editingLLM = { ...llm, isNew: false };
                        this.renderLLMProviders(mount, data, userId);
                    }
                } else if (btn.dataset.action === 'activate') {
                    await this.toggleLLMActive(userId, mnemonic, true);
                } else if (btn.dataset.action === 'deactivate') {
                    await this.toggleLLMActive(userId, mnemonic, false);
                } else if (btn.dataset.action === 'delete') {
                    await this.deleteLLM(userId, mnemonic);
                }
            };
        }

        renderLLMEditForm(mount, llm, allData, userId) {
            const isNew = llm.isNew;
            const title = isNew ? 'Add New LLM Provider' : `Edit ${llm.mnemonic}`;

            mount.innerHTML = `
                <div class="edit-form-container">
                    <div class="edit-form-header">
                        <h3>${title}</h3>
                        <button class="btn-icon" id="cancel-llm-edit">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    
                    <form class="edit-form" id="llm-edit-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="llm-mnemonic">
                                    Mnemonic ${isNew ? '(auto-generated)' : '(cannot be changed)'}
                                </label>
                                <input 
                                    type="text" 
                                    id="llm-mnemonic" 
                                    name="mnemonic" 
                                    value="${this.escapeHtml(llm.mnemonic || '')}" 
                                    readonly
                                    style="background-color: var(--background); cursor: not-allowed;"
                                    placeholder="${isNew ? 'Auto-generated from Model + Version' : ''}">
                                <small>
                                    ${isNew
                    ? 'Format: MODEL_VER (e.g., GPT4_202)'
                    : 'Mnemonic is permanent and cannot be changed'}
                                </small>
                            </div>
                            
                            <div class="form-group">
                                <label for="llm-name">Name</label>
                                <input type="text" id="llm-name" name="name" 
                                    value="${this.escapeHtml(llm.name || '')}" 
                                    placeholder="e.g., OpenAI GPT-4">
                                <small>Friendly display name (optional)</small>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="llm-model">Model *</label>
                                <input type="text" id="llm-model" name="model" 
                                    value="${this.escapeHtml(llm.model || '')}" 
                                    placeholder="e.g., gpt-4o" required>
                                <small>Model identifier</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="llm-version">Version *</label>
                                <input type="text" id="llm-version" name="version" 
                                    value="${this.escapeHtml(llm.version || '')}" 
                                    placeholder="e.g., 2024-01-01" required>
                                <small>API or model version</small>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="llm-apiUrl">API Base URL *</label>
                            <input type="url" id="llm-apiUrl" name="apiUrl" 
                                value="${this.escapeHtml(llm.apiUrl || '')}" 
                                placeholder="https://api.anthropic.com/v1/messages" required>
                            <small>Full API endpoint URL</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="llm-apiKey">API Key ${isNew ? '*' : '(leave blank to keep existing)'}</label>
                            <input type="password" id="llm-apiKey" name="apiKey" 
                                placeholder="${isNew ? 'Enter API key' : 'Enter new key or leave blank'}" 
                                ${isNew ? 'required' : ''}>
                            <small>${isNew ? 'Your API authentication key' : 'Only enter if you want to change the key'}</small>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="llm-temperature">Temperature</label>
                                <input type="number" id="llm-temperature" name="temperature" 
                                    value="${llm.temperature || 0}" 
                                    min="0" max="2" step="0.1">
                                <small>0 = deterministic, 2 = creative</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="llm-maxTokens">Max Tokens</label>
                                <input type="number" id="llm-maxTokens" name="maxTokens" 
                                    value="${llm.maxTokens || 1024}" 
                                    min="1" max="100000">
                                <small>Maximum response length</small>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" id="cancel-llm-btn">Cancel</button>
                            <button type="submit" class="btn-primary">
                                ${isNew ? 'Create Provider' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            `;

            // Bind events
            document.getElementById('cancel-llm-edit').onclick = () => {
                this.editingLLM = null;
                this.renderLLMProviders(mount, allData, userId);
            };

            document.getElementById('cancel-llm-btn').onclick = () => {
                this.editingLLM = null;
                this.renderLLMProviders(mount, allData, userId);
            };

            document.getElementById('llm-edit-form').onsubmit = async (e) => {
                e.preventDefault();
                await this.saveLLM(userId, allData);
            };
        }

        async saveLLM(userId, allData) {
            const form = document.getElementById('llm-edit-form');
            const formData = new FormData(form);

            const isNew = this.editingLLM.isNew;
            const originalMnemonic = this.editingLLM.mnemonic;

            const data = {
                name: formData.get('name') || null,
                model: formData.get('model'),
                version: formData.get('version'),
                apiUrl: formData.get('apiUrl'),
                temperature: parseFloat(formData.get('temperature')) || 0,
                maxTokens: parseInt(formData.get('maxTokens')) || 1024
            };

            const apiKey = formData.get('apiKey');
            if (apiKey) data.apiKey = apiKey;

            // Validation
            if (!data.model || !data.version || !data.apiUrl) {
                this.showNotification('Please fill in all required fields', 'error');
                return;
            }

            if (isNew && !apiKey) {
                this.showNotification('API key is required', 'error');
                return;
            }

            try {
                let url, method;

                if (isNew) {
                    url = `${API_BASE_URL}/api/llms`;
                    method = 'POST';
                    data.userId = userId;
                } else {
                    url = `${API_BASE_URL}/api/llms/${encodeURIComponent(userId)}/${encodeURIComponent(originalMnemonic)}`;
                    method = 'PUT';
                }

                const response = await window.CVManager.auth.authenticatedFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.error || 'Failed to save');
                }

                // ✅ SUCCESS - GREEN notification
                this.showNotification(
                    isNew ? '✓ Created successfully' : '✓ Updated successfully',
                    'success',
                    3000
                );

                this.editingLLM = null;
                await this.loadLLMProviders();

            } catch (e) {
                console.error('Save error:', e);
                // ❌ ERROR - RED notification
                this.showNotification(`Failed: ${e.message}`, 'error', 5000);
            }
        }

        async toggleLLMActive(userId, mnemonic, active) {
            try {
                const res = await window.CVManager.auth.authenticatedFetch(
                    `${API_BASE_URL}/api/llms/${encodeURIComponent(userId)}/${encodeURIComponent(mnemonic)}/active`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ active })
                    }
                );

                const result = await res.json();
                if (!result.success) throw new Error(result.error || 'Failed');

                this.showNotification(
                    active ? 'LLM provider activated' : 'LLM provider deactivated',
                    'success'
                );
                this.loadLLMProviders();
            } catch (e) {
                this.showNotification('Error: ' + e.message, 'error');
            }
        }

        async deleteLLM(userId, mnemonic) {
            if (!confirm(`Delete LLM provider "${mnemonic}"?\n\nThis action cannot be undone.`)) return;

            try {
                const res = await window.CVManager.auth.authenticatedFetch(
                    `${API_BASE_URL}/api/llms/${encodeURIComponent(userId)}/${encodeURIComponent(mnemonic)}`,
                    { method: 'DELETE' }
                );

                const result = await res.json();
                if (!result.success) throw new Error(result.error || 'Failed to delete');

                this.showNotification('LLM provider deleted', 'success');
                this.loadLLMProviders();
            } catch (e) {
                this.showNotification('Error: ' + e.message, 'error');
            }
        }

        // ============================================================
        // PROMPT TEMPLATES - Modern UX with Inline Editing
        // ============================================================

        async loadPrompts() {
            const mount = document.getElementById('prompt-templates-mount');
            if (!mount) return;

            const userId = window.CVManager?.auth?.currentUser?.id;
            if (!userId) {
                mount.innerHTML = '<p class="empty">Please log in to manage prompts.</p>';
                return;
            }

            mount.innerHTML = '<p class="loading">Loading prompts...</p>';

            try {
                const res = await window.CVManager.auth.authenticatedFetch(
                    `${API_BASE_URL}/api/prompts/${encodeURIComponent(userId)}`
                );

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Server returned non-JSON response');
                }

                const js = await res.json();
                if (!js.success) throw new Error(js.error || 'Failed');

                this.renderPrompts(mount, js.data, userId);
            } catch (e) {
                console.error('Error loading prompts:', e);
                mount.innerHTML = `<p class="error">Error: ${this.escapeHtml(e.message)}</p>`;
            }
        }

        renderPrompts(mount, data, userId) {
            // If editing, show edit form
            if (this.editingPrompt !== null) {
                this.renderPromptEditForm(mount, this.editingPrompt, data, userId);
                return;
            }

            const rows = data.map(p => `
                <tr>
                    <td><code>${this.escapeHtml(p.mnemonic)}</code></td>
                    <td>${this.escapeHtml(p.title || p.name || '')}</td>
                    <td class="text-muted">${this.truncate(p.text || p.template || '', 80)}</td>
                    <td>
                        <div class="btn-group">
                            <button class="btn-link" data-action="edit" data-mnemonic="${this.escapeHtml(p.mnemonic)}" title="Edit">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-link btn-link-danger" data-action="delete" data-mnemonic="${this.escapeHtml(p.mnemonic)}" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            mount.innerHTML = `
                <div class="actions">
                    <button id="add-prompt-btn" class="btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Prompt Template
                    </button>
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Mnemonic</th>
                            <th>Title</th>
                            <th>Preview</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="4" class="empty">No prompts configured.</td></tr>'}</tbody>
                </table>
            `;

            mount.onclick = async (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                if (btn.id === 'add-prompt-btn') {
                    this.editingPrompt = { isNew: true };
                    this.renderPrompts(mount, data, userId);
                } else if (btn.dataset.action === 'edit') {
                    const prompt = data.find(p => p.mnemonic === btn.dataset.mnemonic);
                    if (prompt) {
                        this.editingPrompt = { ...prompt, isNew: false };
                        this.renderPrompts(mount, data, userId);
                    }
                } else if (btn.dataset.action === 'delete') {
                    await this.deletePrompt(userId, btn.dataset.mnemonic);
                }
            };
        }

        renderPromptEditForm(mount, prompt, allData, userId) {
            const isNew = prompt.isNew;
            const title = isNew ? 'Add New Prompt Template' : `Edit ${prompt.mnemonic}`;

            mount.innerHTML = `
                <div class="edit-form-container">
                    <div class="edit-form-header">
                        <h3>${title}</h3>
                        <button class="btn-icon" id="cancel-prompt-edit">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    
                    <form class="edit-form" id="prompt-edit-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="prompt-mnemonic">Mnemonic *</label>
                                <input type="text" id="prompt-mnemonic" name="mnemonic" 
                                    value="${this.escapeHtml(prompt.mnemonic || '')}" 
                                    ${isNew ? '' : 'readonly'} 
                                    placeholder="e.g., CV-PARSER" required>
                                <small>Unique identifier for this prompt</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="prompt-title">Title</label>
                                <input type="text" id="prompt-title" name="title" 
                                    value="${this.escapeHtml(prompt.title || prompt.name || '')}" 
                                    placeholder="e.g., CV Initial Parsing">
                                <small>Friendly display name (optional)</small>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="prompt-text">Prompt Template *</label>
                            <textarea id="prompt-text" name="text" rows="15" required 
                                placeholder="Enter your prompt template here...&#10;&#10;Use {VARIABLE_NAME} for variable substitution.&#10;Example: Extract information from this CV: {CV_TEXT}">${this.escapeHtml(prompt.text || prompt.template || '')}</textarea>
                            <small>Use curly braces for variables, e.g., {CV_TEXT}, {JOB_TITLE}</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Detected Variables:</label>
                            <div id="detected-variables" class="detected-variables">
                                <span class="text-muted">Type your template to detect variables</span>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" id="cancel-prompt-btn">Cancel</button>
                            <button type="submit" class="btn-primary">
                                ${isNew ? 'Create Template' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            `;

            // Bind events
            document.getElementById('cancel-prompt-edit').onclick = () => {
                this.editingPrompt = null;
                this.renderPrompts(mount, allData, userId);
            };

            document.getElementById('cancel-prompt-btn').onclick = () => {
                this.editingPrompt = null;
                this.renderPrompts(mount, allData, userId);
            };

            document.getElementById('prompt-edit-form').onsubmit = async (e) => {
                e.preventDefault();
                await this.savePrompt(userId, allData);
            };

            // Variable detection
            const textarea = document.getElementById('prompt-text');
            const varsDiv = document.getElementById('detected-variables');

            const updateVariables = () => {
                const text = textarea.value;
                const regex = /\{([A-Z_]+)\}/g;
                const matches = [...text.matchAll(regex)];
                const variables = [...new Set(matches.map(m => m[1]))];

                if (variables.length === 0) {
                    varsDiv.innerHTML = '<span class="text-muted">No variables detected</span>';
                } else {
                    varsDiv.innerHTML = variables.map(v =>
                        `<code class="variable-badge">{${this.escapeHtml(v)}}</code>`
                    ).join('');
                }
            };

            textarea.addEventListener('input', updateVariables);
            updateVariables(); // Initial check
        }

        async savePrompt(userId, allData) {
            const form = document.getElementById('prompt-edit-form');
            const formData = new FormData(form);

            const data = {
                userId,
                mnemonic: formData.get('mnemonic'),
                title: formData.get('title') || null,
                text: formData.get('text')
            };

            try {
                const res = await window.CVManager.auth.authenticatedFetch(`${API_BASE_URL}/api/prompts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await res.json();
                if (!result.success) throw new Error(result.error || 'Failed to save');

                this.showNotification(
                    this.editingPrompt.isNew ? 'Prompt template created successfully' : 'Prompt template updated successfully',
                    'success'
                );
                this.editingPrompt = null;
                this.loadPrompts();
            } catch (e) {
                this.showNotification('Error: ' + e.message, 'error');
            }
        }

        async deletePrompt(userId, mnemonic) {
            if (!confirm(`Delete prompt template "${mnemonic}"?\n\nThis action cannot be undone.`)) return;

            try {
                const res = await window.CVManager.auth.authenticatedFetch(
                    `${API_BASE_URL}/api/prompts/${encodeURIComponent(userId)}/${encodeURIComponent(mnemonic)}`,
                    { method: 'DELETE' }
                );

                const result = await res.json();
                if (!result.success) throw new Error(result.error || 'Failed');

                this.showNotification('Prompt template deleted', 'success');
                this.loadPrompts();
            } catch (e) {
                this.showNotification('Error: ' + e.message, 'error');
            }
        }

        // ============================================================
        // TAXONOMY - Modern UX with Inline Editing
        // ============================================================

        async loadTaxonomy() {
            const mount = document.getElementById('taxonomy-mount');
            if (!mount) return;

            mount.innerHTML = '<p class="loading">Loading taxonomy...</p>';

            try {
                const res = await window.CVManager.auth.authenticatedFetch(`${API_BASE_URL}/api/taxonomy`);

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Server returned non-JSON response');
                }

                const js = await res.json();
                if (!js.success) throw new Error(js.error || 'Failed');

                this.renderTaxonomy(mount, js.data);
            } catch (e) {
                console.error('Error loading taxonomy:', e);
                mount.innerHTML = `<p class="error">Error: ${this.escapeHtml(e.message)}</p>`;
            }
        }

        renderTaxonomy(mount, data) {
            // If editing, show edit form
            if (this.editingTaxonomy !== null) {
                this.renderTaxonomyEditForm(mount, this.editingTaxonomy, data);
                return;
            }

            const rows = data.map(item => `
                <tr>
                    <td><code>${this.escapeHtml(item.key)}</code></td>
                    <td>${this.escapeHtml(item.label || '')}</td>
                    <td>${Array.isArray(item.aliases) ? item.aliases.map(a => `<span class="alias-tag">${this.escapeHtml(a)}</span>`).join('') : ''}</td>
                    <td>
                        <div class="btn-group">
                            <button class="btn-link" data-action="edit" data-key="${this.escapeHtml(item.key)}" title="Edit">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-link btn-link-danger" data-action="delete" data-key="${this.escapeHtml(item.key)}" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            mount.innerHTML = `
                <div class="actions">
                    <button id="add-taxonomy-btn" class="btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Entry
                    </button>
                    <button id="export-taxonomy-btn" class="btn-secondary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Export JSON
                    </button>
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Key</th>
                            <th>Label</th>
                            <th>Aliases</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="4" class="empty">No taxonomy entries.</td></tr>'}</tbody>
                </table>
            `;

            mount.onclick = async (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                if (btn.id === 'add-taxonomy-btn') {
                    this.editingTaxonomy = { isNew: true };
                    this.renderTaxonomy(mount, data);
                } else if (btn.id === 'export-taxonomy-btn') {
                    await this.exportTaxonomy();
                } else if (btn.dataset.action === 'edit') {
                    const item = data.find(t => t.key === btn.dataset.key);
                    if (item) {
                        this.editingTaxonomy = { ...item, isNew: false };
                        this.renderTaxonomy(mount, data);
                    }
                } else if (btn.dataset.action === 'delete') {
                    await this.deleteTaxonomy(btn.dataset.key);
                }
            };
        }

        renderTaxonomyEditForm(mount, item, allData) {
            const isNew = item.isNew;
            const title = isNew ? 'Add New Taxonomy Entry' : `Edit ${item.key}`;

            mount.innerHTML = `
                <div class="edit-form-container">
                    <div class="edit-form-header">
                        <h3>${title}</h3>
                        <button class="btn-icon" id="cancel-taxonomy-edit">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    
                    <form class="edit-form" id="taxonomy-edit-form">
                        <div class="form-group">
                            <label for="taxonomy-key">Key *</label>
                            <input type="text" id="taxonomy-key" name="key" 
                                value="${this.escapeHtml(item.key || '')}" 
                                ${isNew ? '' : 'readonly'} 
                                placeholder="e.g., senior-developer" required>
                            <small>Unique identifier (lowercase, hyphens allowed)</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="taxonomy-label">Label *</label>
                            <input type="text" id="taxonomy-label" name="label" 
                                value="${this.escapeHtml(item.label || '')}" 
                                placeholder="e.g., Senior Developer" required>
                            <small>Human-readable display name</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="taxonomy-aliases">Aliases</label>
                            <input type="text" id="taxonomy-aliases" name="aliases" 
                                value="${Array.isArray(item.aliases) ? item.aliases.join(', ') : ''}" 
                                placeholder="e.g., Sr. Dev, Senior Dev, Lead Developer">
                            <small>Comma-separated alternative names</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Preview:</label>
                            <div id="aliases-preview" class="aliases-preview">
                                <span class="text-muted">Enter aliases above to see preview</span>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" id="cancel-taxonomy-btn">Cancel</button>
                            <button type="submit" class="btn-primary">
                                ${isNew ? 'Create Entry' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            `;

            // Bind events
            document.getElementById('cancel-taxonomy-edit').onclick = () => {
                this.editingTaxonomy = null;
                this.renderTaxonomy(mount, allData);
            };

            document.getElementById('cancel-taxonomy-btn').onclick = () => {
                this.editingTaxonomy = null;
                this.renderTaxonomy(mount, allData);
            };

            document.getElementById('taxonomy-edit-form').onsubmit = async (e) => {
                e.preventDefault();
                await this.saveTaxonomy(allData);
            };

            // Aliases preview
            const aliasesInput = document.getElementById('taxonomy-aliases');
            const previewDiv = document.getElementById('aliases-preview');

            const updatePreview = () => {
                const text = aliasesInput.value;
                const aliases = text.split(',').map(s => s.trim()).filter(Boolean);

                if (aliases.length === 0) {
                    previewDiv.innerHTML = '<span class="text-muted">No aliases entered</span>';
                } else {
                    previewDiv.innerHTML = aliases.map(a =>
                        `<span class="alias-tag">${this.escapeHtml(a)}</span>`
                    ).join('');
                }
            };

            aliasesInput.addEventListener('input', updatePreview);
            updatePreview(); // Initial check
        }

        async saveTaxonomy(allData) {
            const form = document.getElementById('taxonomy-edit-form');
            const formData = new FormData(form);

            const key = formData.get('key');
            const label = formData.get('label');
            const aliasesStr = formData.get('aliases');
            const aliases = aliasesStr.split(',').map(s => s.trim()).filter(Boolean);

            const isNew = this.editingTaxonomy.isNew;

            try {
                const url = isNew
                    ? `${API_BASE_URL}/api/taxonomy`
                    : `${API_BASE_URL}/api/taxonomy/${encodeURIComponent(key)}`;

                const method = isNew ? 'POST' : 'PUT';

                const body = isNew
                    ? { key, label, aliases }
                    : { label, aliases };

                const res = await window.CVManager.auth.authenticatedFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                const result = await res.json();
                if (!result.success) throw new Error(result.error || 'Failed to save');

                this.showNotification(
                    isNew ? 'Taxonomy entry created successfully' : 'Taxonomy entry updated successfully',
                    'success'
                );
                this.editingTaxonomy = null;
                this.loadTaxonomy();
            } catch (e) {
                this.showNotification('Error: ' + e.message, 'error');
            }
        }

        async deleteTaxonomy(key) {
            if (!confirm(`Delete taxonomy entry "${key}"?\n\nThis action cannot be undone.`)) return;

            try {
                const res = await window.CVManager.auth.authenticatedFetch(
                    `${API_BASE_URL}/api/taxonomy/${encodeURIComponent(key)}`,
                    { method: 'DELETE' }
                );

                const result = await res.json();
                if (!result.success) throw new Error(result.error || 'Failed');

                this.showNotification('Taxonomy entry deleted', 'success');
                this.loadTaxonomy();
            } catch (e) {
                this.showNotification('Error: ' + e.message, 'error');
            }
        }

        async exportTaxonomy() {
            try {
                const res = await window.CVManager.auth.authenticatedFetch(`${API_BASE_URL}/api/taxonomy/export/all/json`);
                const result = await res.json();
                if (!result.success) throw new Error('Export failed');

                const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'taxonomy.json';
                a.click();
                URL.revokeObjectURL(url);

                this.showNotification('Taxonomy exported successfully', 'success');
            } catch (e) {
                this.showNotification('Error: ' + e.message, 'error');
            }
        }

        // ============================================================
        // USERS - Keep existing implementation
        // ============================================================

        async loadUsers() {
            const mount = document.getElementById('users-mount');
            if (!mount) return;

            mount.innerHTML = '<p class="loading">Loading users...</p>';

            try {
                const res = await window.CVManager.auth.authenticatedFetch(`${API_BASE_URL}/api/users`);

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Server returned non-JSON response');
                }

                const js = await res.json();
                if (!js.success) throw new Error(js.error || 'Failed');

                this.renderUsers(mount, js.data);
            } catch (e) {
                console.error('Error loading users:', e);
                mount.innerHTML = `<p class="error">Error: ${this.escapeHtml(e.message)}</p>`;
            }
        }

        renderUsers(mount, data) {
            const rows = data.map(u => `
                <tr>
                    <td>${u.id}</td>
                    <td>${this.escapeHtml(u.name || '')}</td>
                    <td>${this.escapeHtml(u.email || '')}</td>
                    <td>${u.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-inactive">Inactive</span>'}</td>
                    <td>${u.prime ? '⭐' : ''}</td>
                    <td>
                        <div class="btn-group">
                            <button class="btn-link" data-action="edit" data-id="${u.id}" title="Edit User">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-link" data-action="toggle-active" data-id="${u.id}" title="Toggle Active">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </button>
                            <button class="btn-link" data-action="toggle-prime" data-id="${u.id}" title="Toggle Prime">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"></polygon>
                                </svg>
                            </button>
                            <button class="btn-link btn-link-danger" data-action="delete" data-id="${u.id}" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');

            mount.innerHTML = `
                <div class="actions">
                    <button id="add-user-btn" class="btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add User
                    </button>
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Prime</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="6" class="empty">No users.</td></tr>'}</tbody>
                </table>
            `;

            mount.onclick = async (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                const id = btn.dataset.id;

                if (btn.id === 'add-user-btn') {
                    await this.addUserPrompt();
                } else if (btn.dataset.action === 'edit') {
                    await this.showEditUserForm(id, data);
                } else if (btn.dataset.action === 'toggle-active') {
                    await this.toggleUserActive(id);
                } else if (btn.dataset.action === 'toggle-prime') {
                    await this.toggleUserPrime(id);
                } else if (btn.dataset.action === 'delete') {
                    await this.deleteUser(id);
                }
            };
        }

        async showEditUserForm(userId, allUsers) {
            const user = allUsers.find(u => u.id === userId);
            if (!user) {
                this.showNotification('User not found', 'error');
                return;
            }

            const mount = document.getElementById('users-mount');
            if (!mount) return;

            mount.innerHTML = `
        <div class="edit-form-container">
            <div class="edit-form-header">
                <h3>Edit User: ${this.escapeHtml(user.name)}</h3>
                <button class="btn-icon" id="cancel-user-edit">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            
            <form class="edit-form" id="user-edit-form">
                <div class="form-group">
                    <label for="user-id">User ID</label>
                    <input type="text" id="user-id" value="${this.escapeHtml(user.id)}" readonly 
                           style="background-color: var(--background); cursor: not-allowed;">
                    <small>User ID cannot be changed</small>
                </div>
                
                <div class="form-group">
                    <label for="user-name">Name *</label>
                    <input type="text" id="user-name" value="${this.escapeHtml(user.name || '')}" required>
                </div>
                
                <div class="form-group">
                    <label for="user-email">Email *</label>
                    <input type="email" id="user-email" value="${this.escapeHtml(user.email || '')}" required>
                </div>
                
                <div class="form-group">
                    <label for="user-password">New Password</label>
                    <input type="password" id="user-password" placeholder="Leave blank to keep current">
                    <small>Only fill if changing password</small>
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="user-active" ${user.active ? 'checked' : ''}>
                        Active
                    </label>
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="user-prime" ${user.prime ? 'checked' : ''}>
                        Prime User
                    </label>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancel-user-btn">Cancel</button>
                    <button type="submit" class="btn-primary">Save Changes</button>
                </div>
            </form>
        </div>
    `;

            document.getElementById('cancel-user-edit').onclick = () => this.loadUsers();
            document.getElementById('cancel-user-btn').onclick = () => this.loadUsers();

            document.getElementById('user-edit-form').onsubmit = async (e) => {
                e.preventDefault();
                await this.saveUserEdit(userId);
            };
        }

        async saveUserEdit(userId) {
            const name = document.getElementById('user-name')?.value.trim();
            const email = document.getElementById('user-email')?.value.trim();
            const password = document.getElementById('user-password')?.value.trim();
            const active = document.getElementById('user-active')?.checked;
            const prime = document.getElementById('user-prime')?.checked;

            if (!name || !email) {
                this.showNotification('Name and email are required', 'error');
                return;
            }

            try {
                const updateData = {
                    id: userId,
                    name,
                    email,
                    active,
                    prime
                };

                if (password) {
                    updateData.password = password;
                }

                const response = await window.CVManager.auth.authenticatedFetch(
                    `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                    }
                );

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.error || 'Failed to update user');
                }

                this.showNotification('✓ User updated successfully', 'success');
                await this.loadUsers();
            } catch (e) {
                console.error('Update user error:', e);
                this.showNotification(`Failed to update: ${e.message}`, 'error');
            }
        }

        async addUserPrompt() {
            const name = prompt('Name:');
            if (!name) return;

            const email = prompt('Email:');
            if (!email) return;

            const password = prompt('Temporary password:');
            if (!password) return;

            try {
                const body = { name, email, password };
                const res = await window.CVManager.auth.authenticatedFetch(`${API_BASE_URL}/api/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                const result = await res.json();
                if (!result.success) throw new Error(result.error || 'Failed');

                this.showNotification('User created successfully', 'success');
                this.loadUsers();
            } catch (e) {
                this.showNotification('Error: ' + e.message, 'error');
            }
        }

        async toggleUserActive(id) {
            try {
                const res = await window.CVManager.auth.authenticatedFetch(`${API_BASE_URL}/api/users/activate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });

                const result = await res.json();
                if (!result.success) throw new Error(result.error || 'Failed');

                this.showNotification('User status updated', 'success');
                this.loadUsers();
            } catch (e) {
                this.showNotification('Error: ' + e.message, 'error');
            }
        }

        async toggleUserPrime(id) {
            try {
                const res = await window.CVManager.auth.authenticatedFetch(`${API_BASE_URL}/api/users/prime`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });

                const result = await res.json();
                if (!result.success) throw new Error(result.error || 'Failed');

                this.showNotification('Prime status updated', 'success');
                this.loadUsers();
            } catch (e) {
                this.showNotification('Error: ' + e.message, 'error');
            }
        }

        async deleteUser(id) {
            if (!confirm('Delete this user?\n\nThis action cannot be undone.')) return;

            try {
                const res = await window.CVManager.auth.authenticatedFetch(
                    `${API_BASE_URL}/api/users/${encodeURIComponent(id)}`,
                    { method: 'DELETE' }
                );

                const result = await res.json();
                if (!result.success) throw new Error(result.error || 'Failed');

                this.showNotification('User deleted', 'success');
                this.loadUsers();
            } catch (e) {
                this.showNotification('Error: ' + e.message, 'error');
            }
        }

        // ============================================================
        // UTILITY METHODS
        // ============================================================

        showNotification(message, type = 'info', duration = 3000) {
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;

            const colors = {
                info: '#3b82f6',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444'
            };

            Object.assign(notification.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                padding: '16px 20px',
                backgroundColor: colors[type] || colors.info,
                color: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: '10000',
                fontSize: '14px',
                fontWeight: '500',
                maxWidth: '350px',
                minWidth: '200px',
                transform: 'translateX(100%)',
                transition: 'transform 0.3s ease',
                wordWrap: 'break-word'
            });

            const icons = {
                info: '📘',
                success: '✅',
                warning: '⚠️',
                error: '❌'
            };

            notification.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>${icons[type] || icons.info}</span>
                    <span>${this.escapeHtml(message)}</span>
                </div>
            `;

            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, duration);
        }

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        truncate(text, maxLength) {
            if (!text) return '';
            if (text.length <= maxLength) return this.escapeHtml(text);
            return this.escapeHtml(text.substring(0, maxLength)) + '...';
        }

        getActiveTab() {
            return this.activeTab;
        }
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        window.CVManager.ui = new UIManager();
        window.CVManager.ui.init();
        console.log('✅ UI fully initialized');
    });

})();