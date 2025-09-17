// Authentication module for CV Management System
(function() {
    'use strict';
    
    window.CVManager = window.CVManager || {};
    
    class AuthManager {
        constructor() {
            this.currentUser = null;
            this.users = [];
            this.init();
        }
        
        async init() {
            await this.loadUsers();
            this.checkSession();
            this.bindEvents();
        }
        
        async loadUsers() {
            try {
                // Try to load from localStorage first
                const stored = localStorage.getItem('cvmanager_users');
                if (stored) {
                    this.users = JSON.parse(stored);
                } else {
                    // Initialize with default user
                    this.users = [window.CVManager.config.defaultUser];
                    await this.saveUsers();
                }
            } catch (error) {
                console.error('Error loading users:', error);
                // Fallback to default user
                this.users = [window.CVManager.config.defaultUser];
            }
        }
        
        async saveUsers() {
            try {
                localStorage.setItem('cvmanager_users', JSON.stringify(this.users));
            } catch (error) {
                console.error('Error saving users:', error);
            }
        }
        
        checkSession() {
            const session = localStorage.getItem('cvmanager_session');
            if (session) {
                try {
                    const sessionData = JSON.parse(session);
                    const now = new Date().getTime();
                    
                    if (now - sessionData.timestamp < window.CVManager.config.app.sessionTimeout) {
                        this.currentUser = sessionData.user;
                        this.showApp();
                        return;
                    }
                } catch (error) {
                    console.error('Invalid session data');
                }
            }
            
            this.showAuth();
        }
        
        showAuth() {
            document.getElementById('auth-modal').classList.remove('hidden');
            document.getElementById('main-app').classList.add('hidden');
        }
        
        showApp() {
            document.getElementById('auth-modal').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            
            if (this.currentUser) {
                document.getElementById('user-name').textContent = this.currentUser.name;
            }
        }
        
        bindEvents() {
            // Form toggles
            document.getElementById('auth-switch').addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthMode();
            });
            
            // Form submissions
            document.getElementById('signin-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignIn();
            });
            
            document.getElementById('signup-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignUp();
            });
            
            // Logout
            document.getElementById('logout-btn').addEventListener('click', () => {
                this.logout();
            });
        }
        
        toggleAuthMode() {
            const signinForm = document.getElementById('signin-form');
            const signupForm = document.getElementById('signup-form');
            const title = document.getElementById('auth-title');
            const subtitle = document.getElementById('auth-subtitle');
            const switchText = document.getElementById('auth-switch-text');
            const switchLink = document.getElementById('auth-switch');
            
            if (signinForm.classList.contains('hidden')) {
                // Switch to sign in
                signinForm.classList.remove('hidden');
                signupForm.classList.add('hidden');
                title.textContent = 'Sign In';
                subtitle.textContent = 'Access your CV management dashboard';
                switchText.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch">Sign up</a>';
            } else {
                // Switch to sign up
                signinForm.classList.add('hidden');
                signupForm.classList.remove('hidden');
                title.textContent = 'Sign Up';
                subtitle.textContent = 'Create your CV management account';
                switchText.innerHTML = 'Already have an account? <a href="#" id="auth-switch">Sign in</a>';
            }
            
            // Re-bind the switch event
            document.getElementById('auth-switch').addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthMode();
            });
            
            this.clearError();
        }
        
        async handleSignIn() {
            const email = document.getElementById('signin-email').value.trim();
            const password = document.getElementById('signin-password').value;
            
            if (!this.validateEmail(email)) {
                this.showError('Please enter a valid email address');
                return;
            }
            
            if (!password) {
                this.showError('Please enter your password');
                return;
            }
            
            // Find user
            const user = this.users.find(u => u.email === email);
            if (!user || user.password !== password) {
                this.showError('Invalid email or password');
                return;
            }
            
            // Successful login
            this.currentUser = { ...user };
            delete this.currentUser.password; // Don't store password in session
            
            this.saveSession();
            this.showApp();
            this.clearForms();
        }
        
        async handleSignUp() {
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm').value;
            
            // Validation
            if (!name || name.length < window.CVManager.config.validation.name.minLength) {
                this.showError('Name must be at least 2 characters long');
                return;
            }
            
            if (!this.validateEmail(email)) {
                this.showError('Please enter a valid email address');
                return;
            }
            
            if (password.length < window.CVManager.config.validation.password.minLength) {
                this.showError('Password must be at least 6 characters long');
                return;
            }
            
            if (password !== confirmPassword) {
                this.showError('Passwords do not match');
                return;
            }
            
            // Check if user already exists
            if (this.users.find(u => u.email === email)) {
                this.showError('An account with this email already exists');
                return;
            }
            
            // Create new user
            const newUser = {
                id: this.generateId(),
                name,
                email,
                password,
                role: 'user',
                createdAt: new Date().toISOString()
            };
            
            this.users.push(newUser);
            await this.saveUsers();
            
            // Auto sign in
            this.currentUser = { ...newUser };
            delete this.currentUser.password;
            
            this.saveSession();
            this.showApp();
            this.clearForms();
        }
        
        validateEmail(email) {
            return window.CVManager.config.validation.email.test(email);
        }
        
        generateId() {
            return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        saveSession() {
            const sessionData = {
                user: this.currentUser,
                timestamp: new Date().getTime()
            };
            
            localStorage.setItem('cvmanager_session', JSON.stringify(sessionData));
        }
        
        logout() {
            this.currentUser = null;
            localStorage.removeItem('cvmanager_session');
            this.showAuth();
            this.clearForms();
        }
        
        clearForms() {
            document.getElementById('signin-form').reset();
            document.getElementById('signup-form').reset();
            this.clearError();
        }
        
        showError(message) {
            const errorDiv = document.getElementById('auth-error');
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
        
        clearError() {
            const errorDiv = document.getElementById('auth-error');
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
        }
        
        getCurrentUser() {
            return this.currentUser;
        }
    }
    
    // Initialize auth manager when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        window.CVManager.auth = new AuthManager();
    });
    
})();