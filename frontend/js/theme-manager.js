// Theme management module for dark/light mode switching
(function() {
    'use strict';
    
    window.CVManager = window.CVManager || {};
    
    class ThemeManager {
        constructor() {
            this.currentTheme = 'light';
            this.init();
        }
        
        init() {
            this.loadSavedTheme();
            this.createThemeToggle();
            this.applyTheme();
            this.bindEvents();
        }
        
        loadSavedTheme() {
            // Check for saved theme preference or default to light
            const savedTheme = localStorage.getItem('cvmanager_theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            this.currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        }
        
        createThemeToggle() {
            // Find the user menu and add theme toggle
            const userMenu = document.querySelector('.user-menu');
            if (!userMenu) return;
            
            // Create theme toggle HTML
            const themeToggleHTML = `
                <div class="theme-toggle" id="theme-toggle" title="Toggle dark/light mode">
                    <svg class="theme-icon sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                    <div class="theme-toggle-switch" id="theme-switch"></div>
                    <svg class="theme-icon moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                </div>
            `;
            
            // Insert before the user name
            const userName = userMenu.querySelector('#user-name');
            if (userName) {
                userName.insertAdjacentHTML('beforebegin', themeToggleHTML);
            } else {
                // If no user name found, append to user menu
                userMenu.insertAdjacentHTML('beforeend', themeToggleHTML);
            }
        }
        
        bindEvents() {
            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', () => {
                    this.toggleTheme();
                });
            }
            
            // Listen for system theme changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                // Only auto-switch if user hasn't set a preference
                if (!localStorage.getItem('cvmanager_theme')) {
                    this.currentTheme = e.matches ? 'dark' : 'light';
                    this.applyTheme();
                }
            });
            
            // Add keyboard shortcut (Ctrl/Cmd + Shift + D)
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
                    e.preventDefault();
                    this.toggleTheme();
                }
            });
        }
        
        toggleTheme() {
            this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
            this.applyTheme();
            this.saveTheme();
            
            // Dispatch custom event for other components
            window.dispatchEvent(new CustomEvent('themeChanged', {
                detail: { theme: this.currentTheme }
            }));
        }
        
        applyTheme() {
            const html = document.documentElement;
            const themeSwitch = document.getElementById('theme-switch');
            const themeToggle = document.getElementById('theme-toggle');
            
            // Apply theme to document
            html.setAttribute('data-theme', this.currentTheme);
            
            // Update toggle switch appearance
            if (themeSwitch) {
                if (this.currentTheme === 'dark') {
                    themeSwitch.classList.add('active');
                } else {
                    themeSwitch.classList.remove('active');
                }
            }
            
            if (themeToggle) {
                if (this.currentTheme === 'dark') {
                    themeToggle.classList.add('active');
                    themeToggle.title = 'Switch to light mode (Ctrl+Shift+D)';
                } else {
                    themeToggle.classList.remove('active');
                    themeToggle.title = 'Switch to dark mode (Ctrl+Shift+D)';
                }
            }
            
            // Update meta theme-color for mobile browsers
            this.updateMetaThemeColor();
        }
        
        updateMetaThemeColor() {
            let themeColorMeta = document.querySelector('meta[name="theme-color"]');
            
            if (!themeColorMeta) {
                themeColorMeta = document.createElement('meta');
                themeColorMeta.name = 'theme-color';
                document.head.appendChild(themeColorMeta);
            }
            
            // Set theme color based on current theme
            const themeColor = this.currentTheme === 'dark' ? '#1e293b' : '#ffffff';
            themeColorMeta.content = themeColor;
        }
        
        saveTheme() {
            localStorage.setItem('cvmanager_theme', this.currentTheme);
        }
        
        getCurrentTheme() {
            return this.currentTheme;
        }
        
        setTheme(theme) {
            if (theme === 'light' || theme === 'dark') {
                this.currentTheme = theme;
                this.applyTheme();
                this.saveTheme();
            }
        }
        
        // Method for other components to check if dark mode is active
        isDarkMode() {
            return this.currentTheme === 'dark';
        }
        
        // Method for components that need to adjust based on theme
        onThemeChange(callback) {
            window.addEventListener('themeChanged', (e) => {
                callback(e.detail.theme);
            });
        }
    }
    
    // Initialize theme manager when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        window.CVManager.themeManager = new ThemeManager();
    });
    
    // Also expose it globally for easy access
    window.ThemeManager = ThemeManager;
    
})();