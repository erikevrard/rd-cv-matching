// Tender Search Builder - v3.0.0
// SIMPLIFIED: One request = one profile

(function () {
    'use strict';

    const API_BASE_URL = window.CVManager?.config?.api?.baseUrl || 'http://localhost:3001';

    class TenderSearchBuilder {
        constructor() {
            this.searches = [];
            this.activeSearch = null;
            this.editingSearch = null;
        }

        async init() {
            await this.loadSearches();
            this.setupEventListeners();
            this.setupStatusBarListeners();
            this.renderSearchList();
            this.updateStatusBar();
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
            console.log('🔧 Setting up event listeners for tender search builder');
            this.setupStatusBarListeners();
        }

        // ============================================================================
        // DATA LOADING
        // ============================================================================

        async loadSearches() {
            const userId = window.CVManager.auth?.getCurrentUser()?.id;
            if (!userId) return;

            try {
                const response = await this.authenticatedFetch(
                    `${API_BASE_URL}/api/tender-searches/${userId}`
                );
                const result = await response.json();

                if (result.success) {
                    this.searches = result.data || [];
                    this.activeSearch = this.searches.find(s => s.active);
                    console.log('Loaded', this.searches.length, 'tender searches');
                }
            } catch (error) {
                console.error('Error loading tender searches:', error);
                this.showToast('Failed to load tender searches', 'error');
            }
        }

        async getActiveSearch() {
            const userId = window.CVManager.auth?.getCurrentUser()?.id;
            if (!userId) return null;

            try {
                const response = await this.authenticatedFetch(
                    `${API_BASE_URL}/api/tender-searches/${userId}/active`
                );
                const result = await response.json();

                if (result.success) {
                    this.activeSearch = result.data;
                    return result.data;
                }
            } catch (error) {
                if (!error.message?.includes('404')) {
                    console.error('Error getting active search:', error);
                }
            }
            return null;
        }

        // ============================================================================
        // UI - PROFILES TAB
        // ============================================================================

        renderTenderRequestsTab() {
            console.log('🎨 renderTenderRequestsTab called');

            const tenderRequestsSection = document.getElementById('tender-requests');
            console.log('📦 Tender requests section:', tenderRequestsSection);

            if (!tenderRequestsSection) {
                console.error('❌ Could not find tender-requests section!');
                return;
            }

            const placeholderContent = tenderRequestsSection.querySelector('.placeholder-content');
            if (placeholderContent) {
                console.log('🗑️ Removing placeholder');
                placeholderContent.remove();
            }

            const existingContainer = tenderRequestsSection.querySelector('.tender-request-container');
            if (existingContainer) {
                console.log('✅ UI already rendered, skipping');
                return;
            }

            console.log('🏗️ Creating new container');
            const container = document.createElement('div');
            container.className = 'tender-request-container';
            container.innerHTML = `
        <div class="tender-search-header">
            <div>
                <p class="subtitle">Create and manage job/tender requests. Each request represents one profile with specific services and seniority requirements.</p>
            </div>
            <button class="btn-primary" onclick="tenderSearchBuilder.showAddSearch()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Tender Request
            </button>
        </div>
        
        <div id="tender-search-list" class="tender-search-list">
            <!-- Search cards will be rendered here -->
        </div>
        
        <div id="tender-search-form" class="tender-search-form hidden">
            <!-- Form will be rendered here -->
        </div>
    `;

            tenderRequestsSection.appendChild(container);
            console.log('✅ Container appended');

            this.renderSearchList();
            console.log('✅ Search list rendered');
        }

        renderSearchList() {
            const container = document.getElementById('tender-search-list');
            if (!container) return;

            if (this.searches.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding: 60px 20px;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="M21 21l-4.35-4.35"></path>
                        </svg>
                        <h3>No Tender Requests Yet</h3>
                        <p>Create your first tender request to match CVs against job requirements</p>
                        <button class="btn-primary" onclick="tenderSearchBuilder.showAddSearch()">Create Your First Request</button>
                    </div>
                `;
                return;
            }

            const cards = this.searches.map(search => this.createSearchCard(search)).join('');
            container.innerHTML = `<div class="search-grid">${cards}</div>`;
        }

        createSearchCard(search) {
            const isActive = search.active;
            const activeClass = isActive ? 'search-card-active' : '';
            const activeBadge = isActive ? '<span class="badge active-badge">ACTIVE</span>' : '';

            // Get the single profile
            const profile = search.profiles && search.profiles[0];
            const profileDisplay = profile ? `
                <div class="profile-item">
                    <strong>${this.escapeHtml(profile.title)}</strong>
                    ${profile.description ? `<p>${this.escapeHtml(profile.description)}</p>` : ''}
                </div>
            ` : '<div class="profile-item"><em>No profile defined</em></div>';

            const servicesList = search.requestedServices.slice(0, 5).map(s =>
                `<span class="service-tag">${this.escapeHtml(s)}</span>`
            ).join('');
            const moreServices = search.requestedServices.length > 5
                ? `<span class="service-tag">+${search.requestedServices.length - 5} more</span>`
                : '';

            return `
                <div class="search-card ${activeClass}">
                    <div class="search-card-header">
                        <div class="search-card-title">
                            <div class="mnemonic-badge">${this.escapeHtml(search.mnemonic)}</div>
                            ${activeBadge}
                        </div>
                        <div class="search-card-actions">
                            ${!isActive ? `
                                <button class="btn-icon" onclick="tenderSearchBuilder.setActive('${search.mnemonic}')" title="Set as active">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
                                    </svg>
                                </button>
                            ` : ''}
                            <button class="btn-icon" onclick="tenderSearchBuilder.editSearch('${search.mnemonic}')" title="Edit">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-icon delete" onclick="tenderSearchBuilder.deleteSearch('${search.mnemonic}')" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <div class="search-card-body">
                        ${search.tenderId ? `<div class="search-detail"><strong>Tender ID:</strong> ${this.escapeHtml(search.tenderId)}</div>` : ''}
                        <div class="search-detail"><strong>Seniority:</strong> ${this.escapeHtml(search.seniority)}</div>
                        
                        <div class="search-detail">
                            <strong>Profile:</strong>
                            <div class="profiles-list">${profileDisplay}</div>
                        </div>
                        
                        <div class="search-detail">
                            <strong>Services (${search.requestedServices.length}):</strong>
                            <div class="services-list">${servicesList}${moreServices}</div>
                        </div>
                    </div>
                    
                    <div class="search-card-footer">
                        <small>Created: ${this.formatDate(search.createdAt)}</small>
                    </div>
                </div>
            `;
        }

        // ============================================================================
        // UI - ADD/EDIT FORM (SIMPLIFIED - SINGLE PROFILE)
        // ============================================================================

        showAddSearch() {
            this.editingSearch = null;
            this.renderSearchForm();
        }

        editSearch(mnemonic) {
            this.editingSearch = this.searches.find(s => s.mnemonic === mnemonic);
            if (this.editingSearch) {
                this.renderSearchForm();
            }
        }

        renderSearchForm() {
            const container = document.getElementById('tender-search-form');
            const listContainer = document.getElementById('tender-search-list');

            if (!container) return;

            // Hide list, show form
            if (listContainer) listContainer.classList.add('hidden');
            container.classList.remove('hidden');

            const search = this.editingSearch || {};
            const profile = search.profiles && search.profiles[0] ? search.profiles[0] : {};

            container.innerHTML = `
                <div class="form-container">
                    <div class="form-header">
                        <h3>${this.editingSearch ? 'Edit' : 'Create'} Tender Request</h3>
                        <button class="btn-secondary" onclick="tenderSearchBuilder.cancelForm()">Cancel</button>
                    </div>

                    <div class="form-section">
                        <h4>Request Information</h4>
                        <p class="text-muted" style="margin-bottom: var(--spacing-md);">
                            Define the tender request with one profile, seniority level, and required services. 
                            Matching will be based on these criteria.
                        </p>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Tender ID (Optional)</label>
                                <input type="text" id="tender-id" placeholder="e.g., TENDER-2025-001" value="${search.tenderId || ''}">
                            </div>

                            <div class="form-group">
                                <label>Seniority Level *</label>
                                <select id="seniority" required>
                                    <option value="">Select seniority...</option>
                                    <option value="Undefined" ${search.seniority === 'Undefined' ? 'selected' : ''}>Undefined</option>
                                    <option value="Intern" ${search.seniority === 'Intern' ? 'selected' : ''}>Intern/Trainee</option>
                                    <option value="Junior" ${search.seniority === 'Junior' ? 'selected' : ''}>Junior</option>
                                    <option value="Medior" ${search.seniority === 'Medior' ? 'selected' : ''}>Medior/Mid-level</option>
                                    <option value="Proficient" ${search.seniority === 'Proficient' ? 'selected' : ''}>Proficient</option>
                                    <option value="Senior" ${search.seniority === 'Senior' ? 'selected' : ''}>Senior</option>
                                    <option value="Lead" ${search.seniority === 'Lead' ? 'selected' : ''}>Lead</option>
                                    <option value="Principal" ${search.seniority === 'Principal' ? 'selected' : ''}>Principal/Staff</option>
                                    <option value="Manager" ${search.seniority === 'Manager' ? 'selected' : ''}>Manager</option>
                                    <option value="Director" ${search.seniority === 'Director' ? 'selected' : ''}>Director</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Requested Services * (one per line)</label>
                            <textarea id="requested-services" rows="4" placeholder="e.g.,&#10;Development&#10;Testing&#10;Documentation" required>${search.requestedServices ? search.requestedServices.join('\n') : ''}</textarea>
                            <small>Enter each service on a new line</small>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>Profile Definition</h4>
                        <p class="text-muted" style="margin-bottom: var(--spacing-md);">
                            Define the single profile for this tender request. This will be used to match candidates.
                        </p>
                        
                        <div class="form-group">
                            <label>Profile Title *</label>
                            <input type="text" 
                                   id="profile-title" 
                                   placeholder="e.g., Full Stack Developer" 
                                   value="${this.escapeHtml(profile.title || '')}"
                                   required>
                        </div>
                        
                        <div class="form-group">
                            <label>Profile Description</label>
                            <textarea id="profile-desc" 
                                      rows="3" 
                                      placeholder="Brief description of the role and requirements">${this.escapeHtml(profile.description || '')}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>Nature of Tasks (one per line)</label>
                            <textarea id="profile-tasks" 
                                      rows="5" 
                                      placeholder="e.g.,&#10;Develop web applications&#10;Write clean code&#10;Collaborate with team">${this.escapeHtml(this.arrayToText(profile.natureOfTasks))}</textarea>
                            <small>These tasks will be used for candidate matching</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Knowledge & Skills (one per line)</label>
                            <textarea id="profile-skills" 
                                      rows="5" 
                                      placeholder="e.g.,&#10;JavaScript&#10;React&#10;Node.js">${this.escapeHtml(this.arrayToText(profile.knowledgeAndSkills))}</textarea>
                            <small>Required skills for candidate matching</small>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button class="btn-secondary" onclick="tenderSearchBuilder.cancelForm()">Cancel</button>
                        <button class="btn-primary" onclick="tenderSearchBuilder.saveSearch()">${this.editingSearch ? 'Update' : 'Create'} Request</button>
                    </div>

                    <div id="tender-form-result"></div>
                </div>
            `;
        }

        cancelForm() {
            const container = document.getElementById('tender-search-form');
            const listContainer = document.getElementById('tender-search-list');

            if (container) container.classList.add('hidden');
            if (listContainer) listContainer.classList.remove('hidden');

            this.editingSearch = null;
        }

        async saveSearch() {
            const resultDiv = document.getElementById('tender-form-result');
            if (!resultDiv) return;

            const userId = window.CVManager.auth?.getCurrentUser()?.id;
            if (!userId) {
                resultDiv.innerHTML = '<div class="result-error">User not authenticated</div>';
                return;
            }

            const tenderId = document.getElementById('tender-id')?.value.trim();
            const seniority = document.getElementById('seniority')?.value;
            const servicesText = document.getElementById('requested-services')?.value;

            // Get profile data
            const profileTitle = document.getElementById('profile-title')?.value.trim();
            const profileDesc = document.getElementById('profile-desc')?.value.trim();
            const profileTasks = document.getElementById('profile-tasks')?.value;
            const profileSkills = document.getElementById('profile-skills')?.value;

            // Validation
            if (!seniority) {
                resultDiv.innerHTML = '<div class="result-error">Please select a seniority level</div>';
                return;
            }

            if (!servicesText) {
                resultDiv.innerHTML = '<div class="result-error">Please enter requested services</div>';
                return;
            }

            if (!profileTitle) {
                resultDiv.innerHTML = '<div class="result-error">Profile title is required</div>';
                return;
            }

            const requestedServices = this.textToArray(servicesText);

            // Build single profile object
            const profile = {
                title: profileTitle,
                description: profileDesc || '',
                natureOfTasks: this.textToArray(profileTasks),
                knowledgeAndSkills: this.textToArray(profileSkills)
            };

            try {
                const payload = {
                    userId,
                    tenderId: tenderId || null,
                    seniority,
                    requestedServices,
                    profiles: [profile] // Single profile array
                };

                const response = await this.authenticatedFetch(
                    `${API_BASE_URL}/api/tender-searches`,
                    {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    }
                );

                const result = await response.json();

                if (result.success) {
                    this.showToast('Tender request saved successfully!', 'success');
                    await this.loadSearches();
                    this.cancelForm();
                    this.renderSearchList();
                } else {
                    resultDiv.innerHTML = `<div class="result-error">Failed to save: ${result.error}</div>`;
                }
            } catch (error) {
                resultDiv.innerHTML = `<div class="result-error">Failed to save: ${error.message}</div>`;
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
                    `${API_BASE_URL}/api/tender-searches/${userId}/${mnemonic}/active`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ active: true })
                    }
                );

                const result = await response.json();

                if (result.success) {
                    this.showToast('Active tender request updated', 'success');
                    await this.loadSearches();
                    this.renderSearchList();
                    this.updateStatusBar();
                } else {
                    this.showToast(`Failed to set active: ${result.error}`, 'error');
                }
            } catch (error) {
                this.showToast('Failed to set active tender request', 'error');
            }
        }

        async deleteSearch(mnemonic) {
            if (!confirm('Are you sure you want to delete this tender request?')) {
                return;
            }

            const userId = window.CVManager.auth?.getCurrentUser()?.id;
            if (!userId) return;

            try {
                const response = await this.authenticatedFetch(
                    `${API_BASE_URL}/api/tender-searches/${userId}/${mnemonic}`,
                    {
                        method: 'DELETE'
                    }
                );

                const result = await response.json();

                if (result.success) {
                    this.showToast('Tender request deleted', 'success');
                    await this.loadSearches();
                    this.renderSearchList();
                } else {
                    this.showToast(`Failed to delete: ${result.error}`, 'error');
                }
            } catch (error) {
                this.showToast('Failed to delete tender request', 'error');
            }
        }

        // ============================================================================
        // UTILITY METHODS
        // ============================================================================

        textToArray(text) {
            if (!text) return [];
            return text.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
        }

        arrayToText(arr) {
            if (!arr || !Array.isArray(arr)) return '';
            return arr.join('\n');
        }

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

        // ============================================================================
        // STATUS BAR MANAGEMENT
        // ============================================================================

        updateStatusBar() {
            const statusBar = document.getElementById('tender-search-status');
            const searchName = document.getElementById('active-search-name');

            if (!statusBar || !searchName) return;

            if (this.activeSearch) {
                statusBar.classList.remove('hidden');

                const profile = this.activeSearch.profiles && this.activeSearch.profiles[0];
                const displayName = `${this.activeSearch.mnemonic} - ${this.activeSearch.seniority} ${profile?.title || 'Profile'}`;
                searchName.textContent = displayName;

                const color = this.getSearchColor(this.activeSearch.mnemonic);
                statusBar.setAttribute('data-search-color', color);
            } else {
                statusBar.classList.add('hidden');
            }
        }

        getSearchColor(mnemonic) {
            const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'teal', 'red', 'indigo'];

            let hash = 0;
            for (let i = 0; i < mnemonic.length; i++) {
                hash = ((hash << 5) - hash) + mnemonic.charCodeAt(i);
                hash = hash & hash;
            }

            return colors[Math.abs(hash) % colors.length];
        }

        setupStatusBarListeners() {
            const changeBtn = document.getElementById('change-search-btn');
            const deactivateBtn = document.getElementById('deactivate-search-btn');

            if (changeBtn) {
                changeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showSearchSelector();
                });
            }

            if (deactivateBtn) {
                deactivateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deactivateCurrentSearch();
                });
            }
        }

        showSearchSelector() {
            let modal = document.getElementById('search-selector-modal');

            if (modal) {
                modal.remove();
            }

            modal = document.createElement('div');
            modal.id = 'search-selector-modal';
            modal.className = 'modal';

            const searchCards = this.searches.map(search => {
                const color = this.getSearchColor(search.mnemonic);
                const isActive = search.active;

                return `
            <div class="search-selector-card ${isActive ? 'active' : ''}" 
                 data-search-color="${color}"
                 onclick="tenderSearchBuilder.selectSearch('${search.mnemonic}')">
                <div class="search-selector-header">
                    <div class="mnemonic-badge">${this.escapeHtml(search.mnemonic)}</div>
                    ${isActive ? '<span class="badge active-badge">ACTIVE</span>' : ''}
                </div>
                <div class="search-selector-body">
                    <div><strong>Seniority:</strong> ${this.escapeHtml(search.seniority)}</div>
                    <div><strong>Services:</strong> ${search.requestedServices.length}</div>
                </div>
            </div>
        `;
            }).join('');

            modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
                <h2>Select Active Tender Request</h2>
                <button class="modal-close" onclick="tenderSearchBuilder.closeSearchSelector()">&times;</button>
            </div>
            <div class="modal-body">
                ${this.activeSearch ? `
                    <div style="margin-bottom: var(--spacing-md); padding: var(--spacing-sm); background: var(--background); border-radius: var(--border-radius); display: flex; justify-content: space-between; align-items: center;">
                        <span>Current: <strong>${this.escapeHtml(this.activeSearch.mnemonic)}</strong></span>
                        <button class="btn-secondary btn-sm" onclick="tenderSearchBuilder.deactivateFromModal()">Deactivate Current</button>
                    </div>
                ` : ''}
                <div class="search-selector-grid">
                    ${searchCards || '<p style="text-align:center; padding:40px; color:var(--text-secondary);">No tender requests available. Create one first.</p>'}
                </div>
            </div>
        </div>
    `;

            document.body.appendChild(modal);
            modal.style.display = 'flex';

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeSearchSelector();
                }
            });
        }

        closeSearchSelector() {
            const modal = document.getElementById('search-selector-modal');
            if (modal) {
                modal.remove();
            }
        }

        async deactivateFromModal() {
            if (!this.activeSearch) return;

            if (!confirm('Deactivate the current tender request?')) {
                return;
            }

            const userId = window.CVManager.auth?.getCurrentUser()?.id;
            if (!userId) return;

            try {
                const response = await this.authenticatedFetch(
                    `${API_BASE_URL}/api/tender-searches/${userId}/${this.activeSearch.mnemonic}/active`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ active: false })
                    }
                );

                const result = await response.json();

                if (result.success) {
                    this.showToast('Tender request deactivated', 'success');
                    await this.loadSearches();
                    this.renderSearchList();
                    this.closeSearchSelector();
                } else {
                    this.showToast(`Failed to deactivate: ${result.error}`, 'error');
                }
            } catch (error) {
                console.error('Deactivate error:', error);
                this.showToast('Failed to deactivate tender request', 'error');
            }
        }

        async selectSearch(mnemonic) {
            await this.setActive(mnemonic);

            const modal = document.getElementById('search-selector-modal');
            if (modal) {
                const modalBody = modal.querySelector('.search-selector-grid');
                if (modalBody) {
                    const searchCards = this.searches.map(search => {
                        const color = this.getSearchColor(search.mnemonic);
                        const isActive = search.active;

                        return `
                    <div class="search-selector-card ${isActive ? 'active' : ''}" 
                         data-search-color="${color}"
                         onclick="tenderSearchBuilder.selectSearch('${search.mnemonic}')">
                        <div class="search-selector-header">
                            <div class="mnemonic-badge">${this.escapeHtml(search.mnemonic)}</div>
                            ${isActive ? '<span class="badge active-badge">ACTIVE</span>' : ''}
                        </div>
                        <div class="search-selector-body">
                            <div><strong>Seniority:</strong> ${this.escapeHtml(search.seniority)}</div>
                            <div><strong>Services:</strong> ${search.requestedServices.length}</div>
                        </div>
                    </div>
                `;
                    }).join('');

                    modalBody.innerHTML = searchCards || '<p style="text-align:center; padding:40px; color:var(--text-secondary);">No tender requests available.</p>';
                }

                setTimeout(() => {
                    modal.remove();
                }, 300);
            }
        }

        async deactivateCurrentSearch() {
            if (!this.activeSearch) return;

            if (!confirm('Deactivate the current tender request? You can reactivate it later.')) {
                return;
            }

            const userId = window.CVManager.auth?.getCurrentUser()?.id;
            if (!userId) return;

            try {
                const response = await this.authenticatedFetch(
                    `${API_BASE_URL}/api/tender-searches/${userId}/${this.activeSearch.mnemonic}/active`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ active: false })
                    }
                );

                const result = await response.json();

                if (result.success) {
                    this.showToast('Tender request deactivated', 'success');
                    await this.loadSearches();
                    this.renderSearchList();
                    this.updateStatusBar();
                } else {
                    this.showToast(`Failed to deactivate: ${result.error}`, 'error');
                }
            } catch (error) {
                console.error('Deactivate error:', error);
                this.showToast('Failed to deactivate tender request', 'error');
            }
        }

        getActiveSearch() {
            return this.activeSearch;
        }
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    let tenderSearchBuilder;

    document.addEventListener('DOMContentLoaded', () => {
        const checkAuthAndInit = () => {
            if (window.CVManager && window.CVManager.auth && window.CVManager.auth.isAuthenticated()) {
                tenderSearchBuilder = new TenderSearchBuilder();
                tenderSearchBuilder.init();

                window.tenderSearchBuilder = tenderSearchBuilder;

                console.log('✅ TenderSearchBuilder initialized (v3.0.0 - Simplified Single Profile)');
            } else {
                setTimeout(checkAuthAndInit, 100);
            }
        };

        setTimeout(checkAuthAndInit, 500);
    });

    console.log('✅ Tender Search Builder module loaded (v3.0.0 - Simplified Single Profile)');

})();