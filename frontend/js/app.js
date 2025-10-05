// Main application initialization and coordination
(function() {
    'use strict';
    
    window.CVManager = window.CVManager || {};
    
    class App {
        constructor() {
            this.initialized = false;
            this.modules = {};
        }
        
        async init() {
            if (this.initialized) return;
            
            try {
                console.log('Initializing CV Management System...');
                
                // Wait for all modules to be available
                await this.waitForModules();
                
                // Initialize error handling
                this.setupErrorHandling();
                
                // Initialize keyboard shortcuts
                this.setupKeyboardShortcuts();
                
                // Initialize tooltips and other UI enhancements
                this.setupUIEnhancements();
                
                // Set up periodic tasks
                this.setupPeriodicTasks();
                
                this.initialized = true;
                console.log('CV Management System initialized successfully');
                
            } catch (error) {
                console.error('Failed to initialize application:', error);
                this.showCriticalError('Application failed to initialize. Please refresh the page.');
            }
        }
        
        async waitForModules() {
            // Wait for all required modules to be loaded
            const maxWait = 5000; // 5 seconds
            const checkInterval = 100; // 100ms
            let waited = 0;
            
            while (waited < maxWait) {
                if (window.CVManager.auth && 
                    window.CVManager.ui && 
                    window.CVManager.cvManager &&
                    window.CVManager.config) {
                    return;
                }
                
                await this.delay(checkInterval);
                waited += checkInterval;
            }
            
            throw new Error('Required modules failed to load within timeout');
        }
        
        setupErrorHandling() {
            // Global error handler
            window.addEventListener('error', (event) => {
                console.error('Global error:', event.error);
                this.handleError(event.error);
            });
            
            // Unhandled promise rejection handler
            window.addEventListener('unhandledrejection', (event) => {
                console.error('Unhandled promise rejection:', event.reason);
                this.handleError(event.reason);
                event.preventDefault();
            });
        }
        
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (event) => {
                // Only handle shortcuts when not typing in inputs
                if (event.target.tagName === 'INPUT' || 
                    event.target.tagName === 'TEXTAREA' || 
                    event.target.contentEditable === 'true') {
                    return;
                }
                
                // Handle keyboard shortcuts
                if (event.ctrlKey || event.metaKey) {
                    switch(event.key) {
                        case '1':
                            event.preventDefault();
                            window.CVManager.ui.switchTab('cv-pool');
                            break;
                        case '2':
                            event.preventDefault();
                            window.CVManager.ui.switchTab('profiles');
                            break;
                        case '3':
                            event.preventDefault();
                            window.CVManager.ui.switchTab('matching');
                            break;
                        case '4':
                            event.preventDefault();
                            window.CVManager.ui.switchTab('reports');
                            break;
                        case 'u':
                            event.preventDefault();
                            if (window.CVManager.ui.getActiveTab() === 'cv-pool') {
                                document.getElementById('upload-btn').click();
                            }
                            break;
                    }
                }
                
                // ESC key handling
                if (event.key === 'Escape') {
                    // Close upload area if open
                    const uploadArea = document.getElementById('upload-area');
                    if (uploadArea && !uploadArea.classList.contains('hidden')) {
                        document.getElementById('cancel-upload').click();
                    }
                }
            });
        }
        
        setupUIEnhancements() {
            // Add tooltips for keyboard shortcuts
            this.addKeyboardShortcutTooltips();
            
            // Setup focus management
            this.setupFocusManagement();
            
            // Add loading states for buttons
            this.enhanceButtons();
        }
        
        addKeyboardShortcutTooltips() {
            const shortcuts = [
                { element: '.nav-tab[data-tab="cv-pool"]', shortcut: 'Ctrl+1' },
                { element: '.nav-tab[data-tab="profiles"]', shortcut: 'Ctrl+2' },
                { element: '.nav-tab[data-tab="matching"]', shortcut: 'Ctrl+3' },
                { element: '.nav-tab[data-tab="reports"]', shortcut: 'Ctrl+4' },
                { element: '#upload-btn', shortcut: 'Ctrl+U' }
            ];
            
            shortcuts.forEach(({ element, shortcut }) => {
                const el = document.querySelector(element);
                if (el) {
                    const originalTitle = el.title || '';
                    el.title = originalTitle ? `${originalTitle} (${shortcut})` : shortcut;
                }
            });
        }
        
        setupFocusManagement() {
            // Improve focus management for accessibility
            document.addEventListener('focusin', (event) => {
                const focusedElement = event.target;
                
                // Add focus indicator class for custom styling
                focusedElement.classList.add('focused');
            });
            
            document.addEventListener('focusout', (event) => {
                const blurredElement = event.target;
                blurredElement.classList.remove('focused');
            });
        }
        
        enhanceButtons() {
            // Add loading states and prevent double-clicks
            document.addEventListener('click', (event) => {
                const button = event.target.closest('button');
                if (button && !button.disabled) {
                    // Prevent rapid double-clicks
                    if (button.dataset.lastClick) {
                        const timeSinceLastClick = Date.now() - parseInt(button.dataset.lastClick);
                        if (timeSinceLastClick < 300) {
                            event.preventDefault();
                            return;
                        }
                    }
                    button.dataset.lastClick = Date.now().toString();
                }
            });
        }
        
        setupPeriodicTasks() {
            // Clean up old notifications
            setInterval(() => {
                this.cleanupOldNotifications();
            }, 30000); // Every 30 seconds
            
            // Auto-save session data
            setInterval(() => {
                this.autoSaveSession();
            }, 60000); // Every minute
            
            // Check for updates or maintenance messages
            setInterval(() => {
                this.checkForUpdates();
            }, 300000); // Every 5 minutes
        }
        
        cleanupOldNotifications() {
            const notifications = document.querySelectorAll('.notification, .toast');
            notifications.forEach(notification => {
                const age = Date.now() - parseInt(notification.dataset.created || '0');
                if (age > 10000) { // Remove after 10 seconds
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }
            });
        }
        
        autoSaveSession() {
            // Extend session if user is active
            const session = localStorage.getItem('cvmanager_session');
            if (session && window.CVManager.auth?.getCurrentUser()) {
                try {
                    const sessionData = JSON.parse(session);
                    sessionData.timestamp = Date.now();
                    localStorage.setItem('cvmanager_session', JSON.stringify(sessionData));
                } catch (error) {
                    console.error('Error auto-saving session:', error);
                }
            }
        }
        
        checkForUpdates() {
            // In a real application, this would check for updates from a server
            // For now, just log that the check occurred
            console.debug('Checking for updates...');
        }
        
        handleError(error) {
            // Categorize and handle different types of errors
            if (error.name === 'NetworkError') {
                this.showError('Network connection error. Please check your internet connection.');
            } else if (error.name === 'QuotaExceededError') {
                this.showError('Storage quota exceeded. Please clear some data or contact support.');
            } else if (error.message?.includes('CV processing')) {
                this.showError('Error processing CV file. Please try a different file or contact support.');
            } else {
                this.showError('An unexpected error occurred. If this persists, please contact support.');
            }
        }
        
        showError(message) {
            if (window.CVManager.ui) {
                window.CVManager.ui.showNotification(message, 'error', 5000);
            } else {
                alert(message);
            }
        }
        
        showCriticalError(message) {
            // For critical errors that prevent the app from functioning
            document.body.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
                    <div style="max-width: 500px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                        <h1 style="color: #ef4444; margin-bottom: 16px;">Application Error</h1>
                        <p style="color: #64748b; margin-bottom: 24px;">${message}</p>
                        <button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px;">
                            Reload Application
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Utility methods
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        // Public API for other modules
        getModule(name) {
            return this.modules[name];
        }
        
        registerModule(name, module) {
            this.modules[name] = module;
        }
        
        // Debug utilities (only in development)
        debug() {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return {
                    app: this,
                    config: window.CVManager.config,
                    auth: window.CVManager.auth,
                    ui: window.CVManager.ui,
                    cvManager: window.CVManager.cvManager,
                    clearAll: () => {
                        localStorage.clear();
                        sessionStorage.clear();
                        location.reload();
                    },
                    addTestCVs: (count = 5) => {
                        const samples = window.CVManager.config.sampleCVData;
                        for (let i = 0; i < count; i++) {
                            const sample = samples[i % samples.length];
                            const testCV = {
                                id: 'test_' + Date.now() + '_' + i,
                                filename: `test-cv-${i + 1}.pdf`,
                                fileType: 'pdf',
                                fileSize: Math.floor(Math.random() * 1000000) + 100000,
                                uploadedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                                uploadedBy: 'test@example.com',
                                ...sample,
                                name: `${sample.name} ${i + 1}`
                            };
                            window.CVManager.cvManager.cvs.push(testCV);
                        }
                        window.CVManager.cvManager.saveCVs();
                        window.CVManager.cvManager.updateDisplay();
                        console.log(`Added ${count} test CVs`);
                    }
                };
            }
            return null;
        }
    }
    
    // Initialize the application
    window.CVManager.app = new App();
    
    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.CVManager.app.init();
        });
    } else {
        window.CVManager.app.init();
    }
    
    // Expose debug utilities in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.debug = () => window.CVManager.app.debug();
        console.log('🔧 Debug utilities available via window.debug()');
    }
    
})();