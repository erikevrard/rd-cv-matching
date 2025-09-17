// UI management module
(function() {
    'use strict';
    
    window.CVManager = window.CVManager || {};
    
    class UIManager {
        constructor() {
            this.activeTab = 'cv-pool';
            this.init();
        }
        
        init() {
            this.bindTabNavigation();
            this.setupResponsiveHandling();
        }
        
        bindTabNavigation() {
            const navTabs = document.querySelectorAll('.nav-tab');
            
            navTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const targetTab = tab.dataset.tab;
                    this.switchTab(targetTab);
                });
            });
        }
        
        switchTab(tabId) {
            // Update active tab
            this.activeTab = tabId;
            
            // Update navigation
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('active');
                if (tab.dataset.tab === tabId) {
                    tab.classList.add('active');
                }
            });
            
            // Update content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            const activeContent = document.getElementById(tabId);
            if (activeContent) {
                activeContent.classList.add('active');
            }
            
            // Handle specific tab initialization
            this.handleTabChange(tabId);
        }
        
        handleTabChange(tabId) {
            switch(tabId) {
                case 'cv-pool':
                    // Refresh CV table if needed
                    if (window.CVManager.cvManager) {
                        window.CVManager.cvManager.updateDisplay();
                    }
                    break;
                case 'profiles':
                    this.initProfilesTab();
                    break;
                case 'matching':
                    this.initMatchingTab();
                    break;
                case 'reports':
                    this.initReportsTab();
                    break;
            }
        }
        
        initProfilesTab() {
            // Initialize profiles functionality when implemented
            console.log('Profiles tab activated');
        }
        
        initMatchingTab() {
            // Initialize matching functionality when implemented
            console.log('Matching tab activated');
        }
        
        initReportsTab() {
            // Initialize reports functionality when implemented  
            console.log('Reports tab activated');
        }
        
        setupResponsiveHandling() {
            // Handle responsive behavior
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    this.handleResize();
                }, 100);
            });
            
            // Initial resize handling
            this.handleResize();
        }
        
        handleResize() {
            const isMobile = window.innerWidth <= 768;
            const isTablet = window.innerWidth <= 1024;
            
            // Add responsive classes to body
            document.body.classList.toggle('mobile', isMobile);
            document.body.classList.toggle('tablet', isTablet && !isMobile);
            document.body.classList.toggle('desktop', !isTablet);
            
            // Handle table responsiveness
            this.handleTableResponsiveness(isMobile);
        }
        
        handleTableResponsiveness(isMobile) {
            const table = document.querySelector('.cv-table');
            if (!table) return;
            
            if (isMobile) {
                // On mobile, we could implement card view instead of table
                // For now, just ensure horizontal scroll works
                const container = table.closest('.table-wrapper');
                if (container) {
                    container.style.overflowX = 'auto';
                }
            }
        }
        
        // Utility methods for other modules to use
        showModal(content, options = {}) {
            const modal = this.createModal(content, options);
            document.body.appendChild(modal);
            
            // Animate in
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            
            return modal;
        }
        
        createModal(content, options) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            
            if (options.title) {
                const header = document.createElement('div');
                header.className = 'modal-header';
                header.innerHTML = `
                    <h3>${this.escapeHtml(options.title)}</h3>
                    <button class="btn-icon close-modal">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                `;
                modalContent.appendChild(header);
            }
            
            const body = document.createElement('div');
            body.className = 'modal-body';
            body.innerHTML = content;
            modalContent.appendChild(body);
            
            modal.appendChild(modalContent);
            
            // Close functionality
            const closeModal = () => {
                modal.remove();
            };
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
            
            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', closeModal);
            }
            
            // ESC key support
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);
            
            return modal;
        }
        
        showConfirmDialog(message, callback) {
            const content = `
                <div style="text-align: center; padding: 20px;">
                    <p style="margin-bottom: 20px; font-size: 16px;">${this.escapeHtml(message)}</p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button class="btn-secondary cancel-btn">Cancel</button>
                        <button class="btn-primary confirm-btn">Confirm</button>
                    </div>
                </div>
            `;
            
            const modal = this.showModal(content, { title: 'Confirm Action' });
            
            modal.querySelector('.cancel-btn').addEventListener('click', () => {
                modal.remove();
                if (callback) callback(false);
            });
            
            modal.querySelector('.confirm-btn').addEventListener('click', () => {
                modal.remove();
                if (callback) callback(true);
            });
        }
        
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
            
            // Add icon based on type
            const icons = {
                info: '📝',
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
            
            // Animate in
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);
            
            // Auto remove
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, duration);
        }
        
        // Loading states
        setLoading(element, loading = true) {
            if (loading) {
                element.classList.add('loading');
                element.disabled = true;
                
                const originalText = element.textContent;
                element.dataset.originalText = originalText;
                element.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        Loading...
                    </div>
                `;
            } else {
                element.classList.remove('loading');
                element.disabled = false;
                element.textContent = element.dataset.originalText || '';
            }
        }
        
        // Form utilities
        validateForm(form) {
            const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
            let isValid = true;
            
            inputs.forEach(input => {
                const isInputValid = this.validateInput(input);
                if (!isInputValid) isValid = false;
            });
            
            return isValid;
        }
        
        validateInput(input) {
            const value = input.value.trim();
            const isValid = value !== '';
            
            input.classList.toggle('invalid', !isValid);
            
            // Remove existing error message
            const existingError = input.parentNode.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }
            
            // Add error message if invalid
            if (!isValid) {
                const error = document.createElement('div');
                error.className = 'field-error';
                error.textContent = `${input.previousElementSibling.textContent} is required`;
                error.style.color = '#ef4444';
                error.style.fontSize = '12px';
                error.style.marginTop = '4px';
                input.parentNode.appendChild(error);
            }
            
            return isValid;
        }
        
        // Utility methods
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }
        
        getActiveTab() {
            return this.activeTab;
        }
    }
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        window.CVManager.ui = new UIManager();
    });
    
})();
            