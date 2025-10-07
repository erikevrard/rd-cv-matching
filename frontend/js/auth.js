// Backend-integrated Authentication module for v2.2.0
(function () {
    'use strict';

    window.CVManager = window.CVManager || {};

    // API Configuration
    const API_BASE_URL = 'http://localhost:3001';

    class BackendAuthManager {
        constructor() {
            this.currentUser = null;
            this.token = null;
            this.init();
        }

        async init() {
            this.loadStoredSession();
            this.checkSession();
            this.bindEvents();
        }

        loadStoredSession() {
            // Load token from localStorage
            this.token = localStorage.getItem('cvmanager_auth_token');
            
            // Load user from sessionStorage
            const storedUser = sessionStorage.getItem('cvmanager_user');
            if (storedUser) {
                try {
                    this.currentUser = JSON.parse(storedUser);
                } catch (error) {
                    console.error('Error parsing stored user:', error);
                    this.clearSession();
                }
            }
        }

        async checkSession() {
            // If we have a token and user, verify the token is still valid
            if (this.token && this.currentUser) {
                try {
                    const isValid = await this.verifyToken();
                    if (isValid) {
                        this.showApp();
                        return;
                    }
                } catch (error) {
                    console.error('Session verification failed:', error);
                }
            }

            // No valid session, show auth
            this.clearSession();
            this.showAuth();
        }

        async verifyToken() {
            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token: this.token })
                });

                const result = await response.json();
                
                if (result.success) {
                    // Update current user with verified data
                    this.currentUser = result.data.user;
                    this.saveSession();
                    return true;
                }
                
                return false;
            } catch (error) {
                console.error('Token verification error:', error);
                return false;
            }
        }

        showAuth() {
            document.getElementById('auth-modal')?.classList.remove('hidden');
            document.getElementById('main-app')?.classList.add('hidden');
        }

        showApp() {
            document.getElementById('auth-modal')?.classList.add('hidden');
            document.getElementById('main-app')?.classList.remove('hidden');

            if (this.currentUser) {
                const userNameEl = document.getElementById('user-name');
                if (userNameEl) {
                    userNameEl.textContent = this.currentUser.name;
                }
            }

            // Initialize CV Pool Manager after authentication
            this.initializeCVManager();
        }

        initializeCVManager() {
            // Only initialize if not already initialized and CVPoolManager class exists
            if (typeof CVPoolManager !== 'undefined' && !window.cvPoolManager) {
                window.cvPoolManager = new CVPoolManager();
                console.log('CVPoolManager initialized after authentication');
            }
        }

        bindEvents() {
            // Form toggle
            document.getElementById('auth-switch')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthMode();
            });

            // Form submissions
            document.getElementById('signin-form')?.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignIn();
            });

            document.getElementById('signup-form')?.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignUp();
            });

            // Logout
            document.getElementById('logout-btn')?.addEventListener('click', () => {
                this.logout();
            });
        }

        toggleAuthMode() {
            const signinForm = document.getElementById('signin-form');
            const signupForm = document.getElementById('signup-form');
            const title = document.getElementById('auth-title');
            const subtitle = document.getElementById('auth-subtitle');
            const switchText = document.getElementById('auth-switch-text');

            if (signinForm?.classList.contains('hidden')) {
                // Switch to sign in
                signinForm?.classList.remove('hidden');
                signupForm?.classList.add('hidden');
                if (title) title.textContent = 'Sign In';
                if (subtitle) subtitle.textContent = 'Access your CV management dashboard';
                if (switchText) switchText.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch">Sign up</a>';
            } else {
                // Switch to sign up
                signinForm?.classList.add('hidden');
                signupForm?.classList.remove('hidden');
                if (title) title.textContent = 'Sign Up';
                if (subtitle) subtitle.textContent = 'Create your CV management account';
                if (switchText) switchText.innerHTML = 'Already have an account? <a href="#" id="auth-switch">Sign in</a>';
            }

            // Re-bind the switch event
            document.getElementById('auth-switch')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthMode();
            });

            this.clearError();
        }

        async handleSignIn() {
            const email = document.getElementById('signin-email')?.value.trim();
            const password = document.getElementById('signin-password')?.value;

            // Basic validation
            if (!this.validateEmail(email)) {
                this.showError('Please enter a valid email address');
                return;
            }

            if (!password) {
                this.showError('Please enter your password');
                return;
            }

            // Show loading state
            const submitBtn = document.querySelector('#signin-form button[type="submit"]');
            const originalText = submitBtn?.textContent;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in...';
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();

                if (result.success) {
                    // Store token and user
                    this.token = result.data.token;
                    this.currentUser = result.data.user;
                    
                    this.saveSession();
                    this.showApp();
                    this.clearForms();

                    console.log('✅ User authenticated successfully:', this.currentUser.email);
                } else {
                    this.showError(result.error || 'Login failed');
                }
            } catch (error) {
                console.error('Login error:', error);
                this.showError('Unable to connect to server. Please try again.');
            } finally {
                // Restore button state
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            }
        }

        async handleSignUp() {
            const name = document.getElementById('signup-name')?.value.trim();
            const email = document.getElementById('signup-email')?.value.trim();
            const password = document.getElementById('signup-password')?.value;
            const confirmPassword = document.getElementById('signup-confirm')?.value;

            // Validation
            if (!name || name.length < 2) {
                this.showError('Name must be at least 2 characters long');
                return;
            }

            if (!this.validateEmail(email)) {
                this.showError('Please enter a valid email address');
                return;
            }

            if (password.length < 6) {
                this.showError('Password must be at least 6 characters long');
                return;
            }

            if (password !== confirmPassword) {
                this.showError('Passwords do not match');
                return;
            }

            // Show loading state
            const submitBtn = document.querySelector('#signup-form button[type="submit"]');
            const originalText = submitBtn?.textContent;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating account...';
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, email, password })
                });

                const result = await response.json();

                if (result.success) {
                    // Store token and user
                    this.token = result.data.token;
                    this.currentUser = result.data.user;
                    
                    this.saveSession();
                    this.showApp();
                    this.clearForms();

                    console.log('✅ New user registered:', this.currentUser.email);
                } else {
                    this.showError(result.error || 'Registration failed');
                }
            } catch (error) {
                console.error('Registration error:', error);
                this.showError('Unable to connect to server. Please try again.');
            } finally {
                // Restore button state
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            }
        }

        validateEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        }

        saveSession() {
            // Store token in localStorage (persists across sessions)
            localStorage.setItem('cvmanager_auth_token', this.token);
            
            // Store user in sessionStorage (cleared when browser closes)
            sessionStorage.setItem('cvmanager_user', JSON.stringify(this.currentUser));
        }

        clearSession() {
            this.token = null;
            this.currentUser = null;
            localStorage.removeItem('cvmanager_auth_token');
            sessionStorage.removeItem('cvmanager_user');
        }

        logout() {
            this.clearSession();

            // Clear any cached data
            if (window.cvPoolManager) {
                window.cvPoolManager = null;
            }

            this.showAuth();
            this.clearForms();

            console.log('✅ User logged out successfully');
        }

        clearForms() {
            document.getElementById('signin-form')?.reset();
            document.getElementById('signup-form')?.reset();
            this.clearError();
        }

        showError(message) {
            const errorDiv = document.getElementById('auth-error');
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.classList.remove('hidden');
            }
        }

        clearError() {
            const errorDiv = document.getElementById('auth-error');
            if (errorDiv) {
                errorDiv.classList.add('hidden');
                errorDiv.textContent = '';
            }
        }

        // Public API for other modules
        getCurrentUser() {
            return this.currentUser;
        }

        getToken() {
            return this.token;
        }

        isAuthenticated() {
            return !!(this.token && this.currentUser);
        }

        // Make authenticated API calls
        async authenticatedFetch(url, options = {}) {
            if (!this.token) {
                throw new Error('Not authenticated');
            }

            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
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

                // Handle 401 Unauthorized
                if (response.status === 401) {
                    console.warn('Authentication failed - logging out');
                    this.logout();
                    throw new Error('Session expired. Please log in again.');
                }

                return response;
            } catch (error) {
                console.error('Authenticated fetch error:', error);
                throw error;
            }
        }
    }

    // Initialize auth manager when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        window.CVManager.auth = new BackendAuthManager();
    });

})();