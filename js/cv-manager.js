// CV Management module
(function() {
    'use strict';
    
    window.CVManager = window.CVManager || {};
    
    class CVManager {
        constructor() {
            this.cvs = [];
            this.filteredCVs = [];
            this.currentFilter = {
                search: '',
                company: '',
                profile: ''
            };
            this.init();
        }
        
        async init() {
            await this.loadCVs();
            this.bindEvents();
            this.updateDisplay();
        }
        
        async loadCVs() {
            try {
                const stored = localStorage.getItem('cvmanager_cvs');
                if (stored) {
                    this.cvs = JSON.parse(stored);
                } else {
                    this.cvs = [];
                }
                this.applyFilters();
            } catch (error) {
                console.error('Error loading CVs:', error);
                this.cvs = [];
            }
        }
        
        async saveCVs() {
            try {
                localStorage.setItem('cvmanager_cvs', JSON.stringify(this.cvs));
            } catch (error) {
                console.error('Error saving CVs:', error);
            }
        }
        
        bindEvents() {
            // Upload button
            document.getElementById('upload-btn').addEventListener('click', () => {
                this.toggleUploadArea(true);
            });
            
            // Cancel upload
            document.getElementById('cancel-upload').addEventListener('click', () => {
                this.toggleUploadArea(false);
            });
            
            // File input
            const fileInput = document.getElementById('file-input');
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files);
            });
            
            // Drag and drop
            const uploadZone = document.getElementById('upload-zone');
            uploadZone.addEventListener('click', () => {
                fileInput.click();
            });
            
            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadZone.classList.add('drag-over');
            });
            
            uploadZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('drag-over');
            });
            
            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('drag-over');
                this.handleFileSelect(e.dataTransfer.files);
            });
            
            // Search and filters
            document.getElementById('cv-search').addEventListener('input', (e) => {
                this.currentFilter.search = e.target.value;
                this.debounceFilter();
            });
            
            document.getElementById('company-filter').addEventListener('change', (e) => {
                this.currentFilter.company = e.target.value;
                this.applyFilters();
            });
            
            document.getElementById('profile-filter').addEventListener('change', (e) => {
                this.currentFilter.profile = e.target.value;
                this.applyFilters();
            });
        }
        
        debounceFilter() {
            clearTimeout(this.filterTimeout);
            this.filterTimeout = setTimeout(() => {
                this.applyFilters();
            }, window.CVManager.config.ui.searchDelay);
        }
        
        toggleUploadArea(show) {
            const uploadArea = document.getElementById('upload-area');
            if (show) {
                uploadArea.classList.remove('hidden');
            } else {
                uploadArea.classList.add('hidden');
                document.getElementById('file-input').value = '';
            }
        }
        
        async handleFileSelect(files) {
            if (!files || files.length === 0) return;
            
            const validFiles = Array.from(files).filter(file => {
                const extension = file.name.split('.').pop().toLowerCase();
                const isValidType = window.CVManager.config.app.allowedFileTypes.includes(extension);
                const isValidSize = file.size <= window.CVManager.config.app.maxFileSize;
                
                if (!isValidType) {
                    this.showToast(`Invalid file type: ${file.name}`, 'error');
                    return false;
                }
                
                if (!isValidSize) {
                    this.showToast(`File too large: ${file.name}`, 'error');
                    return false;
                }
                
                return true;
            });
            
            if (validFiles.length === 0) return;
            
            this.toggleUploadArea(false);
            
            // Process files one by one
            for (const file of validFiles) {
                await this.processFile(file);
            }
        }
        
        async processFile(file) {
            this.showLoading(`Processing ${file.name}...`);
            
            try {
                // Simulate file processing with sample data
                await this.delay(window.CVManager.config.processing.sampleDelay);
                
                // Get random sample data
                const sampleData = this.getRandomSampleData();
                
                // Create CV record
                const cvRecord = {
                    id: this.generateId(),
                    filename: file.name,
                    fileType: file.name.split('.').pop().toLowerCase(),
                    fileSize: file.size,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: window.CVManager.auth?.getCurrentUser()?.email || 'unknown',
                    ...sampleData,
                    // Store file as base64 (for demo purposes - in real app would store on server)
                    fileData: await this.fileToBase64(file)
                };
                
                this.cvs.unshift(cvRecord); // Add to beginning
                await this.saveCVs();
                this.applyFilters();
                this.updateDisplay();
                
                this.showToast(`Successfully processed ${file.name}`, 'success');
                
            } catch (error) {
                console.error('Error processing file:', error);
                this.showToast(`Error processing ${file.name}`, 'error');
            } finally {
                this.hideLoading();
            }
        }
        
        fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        }
        
        getRandomSampleData() {
            const samples = window.CVManager.config.sampleCVData;
            const randomSample = samples[Math.floor(Math.random() * samples.length)];
            
            // Add some randomization
            const companies = ['TechCorp Belgium', 'StartupXYZ', 'DataSoft', 'InnovateNV', 'CodeCrafters'];
            const profiles = ['Full Stack Developer', 'DevOps Engineer', 'Data Scientist', 'Frontend Developer', 'Backend Developer'];
            const seniorities = ['Junior', 'Mid-level', 'Senior'];
            
            return {
                ...randomSample,
                company: companies[Math.floor(Math.random() * companies.length)],
                profile: profiles[Math.floor(Math.random() * profiles.length)],
                seniority: seniorities[Math.floor(Math.random() * seniorities.length)]
            };
        }
        
        applyFilters() {
            let filtered = [...this.cvs];
            
            // Search filter
            if (this.currentFilter.search) {
                const searchTerm = this.currentFilter.search.toLowerCase();
                filtered = filtered.filter(cv => 
                    cv.name.toLowerCase().includes(searchTerm) ||
                    cv.company.toLowerCase().includes(searchTerm) ||
                    cv.profile.toLowerCase().includes(searchTerm) ||
                    cv.skills.some(skill => skill.toLowerCase().includes(searchTerm))
                );
            }
            
            // Company filter
            if (this.currentFilter.company) {
                filtered = filtered.filter(cv => cv.company === this.currentFilter.company);
            }
            
            // Profile filter
            if (this.currentFilter.profile) {
                filtered = filtered.filter(cv => cv.profile === this.currentFilter.profile);
            }
            
            this.filteredCVs = filtered;
            this.updateDisplay();
        }
        
        updateDisplay() {
            this.updateTable();
            this.updateStats();
            this.updateFilters();
        }
        
        updateTable() {
            const tbody = document.getElementById('cv-table-body');
            const emptyState = document.getElementById('empty-state');
            
            if (this.filteredCVs.length === 0) {
                tbody.innerHTML = '';
                emptyState.classList.remove('hidden');
                return;
            }
            
            emptyState.classList.add('hidden');
            
            tbody.innerHTML = this.filteredCVs.map(cv => `
                <tr>
                    <td>
                        <div>
                            <strong>${this.escapeHtml(cv.name)}</strong>
                            <br>
                            <small class="text-muted">${this.escapeHtml(cv.email || 'No email')}</small>
                        </div>
                    </td>
                    <td>${this.escapeHtml(cv.company)}</td>
                    <td>${this.escapeHtml(cv.profile)}</td>
                    <td>
                        <span class="badge ${cv.seniority.toLowerCase().replace('-', '')}">${this.escapeHtml(cv.seniority)}</span>
                    </td>
                    <td>${cv.fileType.toUpperCase()}</td>
                    <td>${this.formatDate(cv.uploadedAt)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon" onclick="window.CVManager.cvManager.viewCV('${cv.id}')" title="View CV">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                            <button class="btn-icon" onclick="window.CVManager.cvManager.downloadCV('${cv.id}')" title="Download CV">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7,10 12,15 17,10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </button>
                            <button class="btn-icon delete" onclick="window.CVManager.cvManager.deleteCV('${cv.id}')" title="Delete CV">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        
        updateStats() {
            document.getElementById('cv-count').textContent = 
                `${this.filteredCVs.length} CV${this.filteredCVs.length !== 1 ? 's' : ''}`;
        }
        
        updateFilters() {
            // Update company filter options
            const companyFilter = document.getElementById('company-filter');
            const companies = [...new Set(this.cvs.map(cv => cv.company))].sort();
            
            companyFilter.innerHTML = '<option value="">All Companies</option>' +
                companies.map(company => 
                    `<option value="${this.escapeHtml(company)}" ${this.currentFilter.company === company ? 'selected' : ''}>${this.escapeHtml(company)}</option>`
                ).join('');
            
            // Update profile filter options
            const profileFilter = document.getElementById('profile-filter');
            const profiles = [...new Set(this.cvs.map(cv => cv.profile))].sort();
            
            profileFilter.innerHTML = '<option value="">All Profiles</option>' +
                profiles.map(profile => 
                    `<option value="${this.escapeHtml(profile)}" ${this.currentFilter.profile === profile ? 'selected' : ''}>${this.escapeHtml(profile)}</option>`
                ).join('');
        }
        
        async deleteCV(id) {
            if (!confirm('Are you sure you want to delete this CV? This action cannot be undone.')) {
                return;
            }
            
            this.cvs = this.cvs.filter(cv => cv.id !== id);
            await this.saveCVs();
            this.applyFilters();
            this.showToast('CV deleted successfully', 'success');
        }
        
        viewCV(id) {
            const cv = this.cvs.find(cv => cv.id === id);
            if (cv) {
                // For demo purposes, show basic info in alert
                // In real app, would open modal or navigate to detail page
                alert(`CV Details:\n\nName: ${cv.name}\nCompany: ${cv.company}\nProfile: ${cv.profile}\nSeniority: ${cv.seniority}\nSkills: ${cv.skills.join(', ')}`);
            }
        }
        
        downloadCV(id) {
            const cv = this.cvs.find(cv => cv.id === id);
            if (cv && cv.fileData) {
                // Create download link
                const link = document.createElement('a');
                link.href = cv.fileData;
                link.download = cv.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.showToast('CV download started', 'success');
            } else {
                this.showToast('CV file not available', 'error');
            }
        }
        
        // Utility methods
        generateId() {
            return 'cv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }
        
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        showLoading(message = 'Loading...') {
            const overlay = document.getElementById('loading-overlay');
            const messageEl = overlay.querySelector('p');
            messageEl.textContent = message;
            overlay.classList.remove('hidden');
        }
        
        hideLoading() {
            document.getElementById('loading-overlay').classList.add('hidden');
        }
        
        showToast(message, type = 'info') {
            // Simple toast notification
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            
            // Style the toast
            Object.assign(toast.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                padding: '12px 24px',
                backgroundColor: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6',
                color: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                zIndex: '9999',
                fontSize: '14px',
                fontWeight: '500',
                maxWidth: '300px',
                wordWrap: 'break-word'
            });
            
            document.body.appendChild(toast);
            
            // Animate in
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'transform 0.3s ease';
            
            setTimeout(() => {
                toast.style.transform = 'translateX(0)';
            }, 10);
            
            // Remove after delay
            setTimeout(() => {
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        document.body.removeChild(toast);
                    }
                }, 300);
            }, window.CVManager.config.ui.toastDuration);
        }
    }
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        // Wait for auth to be ready
        const initCV = () => {
            if (window.CVManager.auth) {
                window.CVManager.cvManager = new CVManager();
            } else {
                setTimeout(initCV, 100);
            }
        };
        initCV();
    });
    
})();