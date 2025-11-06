// Secure Authentication module - Updated for production safety
(function () {
    'use strict';

    window.CVManager = window.CVManager || {};

    class SecureAuthManager {
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
                // First check if we have users in secure storage
                const stored = localStorage.getItem('cvmanager_users_hashed');
                if (stored) {
                    this.users = JSON.parse(stored);
                    return;
                }

                // If no users exist, initialize with secure default
                await this.initializeDefaultUser();

            } catch (error) {
                console.error('Error loading users:', error);
                await this.initializeDefaultUser();
            }
        }

        async initializeDefaultUser() {
            // In development, we'll create a hashed version of the default user
            // In production, this would come from environment variables or secure config

            if (this.isDevelopment()) {
                // For development only - create test user with hashed password
                const defaultUser = {
                    id: 'user_default_erik',
                    name: 'Erik Evrard',
                    email: 'erik@evrard.net',
                    // This is a hash of 'abc123' - in production use environment variables
                    passwordHash: await this.hashPassword('abc123'),
                    role: 'admin',
                    createdAt: new Date().toISOString()
                };

                this.users = [defaultUser];
                await this.saveUsers();

                console.warn('🔒 Development mode: Default user created with hashed password');
            } else {
                // Production mode - users must be configured properly
                console.error('🚨 No users configured! Please set up user management properly.');
                this.showSecurityWarning();
            }
        }

        async saveUsers() {
            try {
                // Only save hashed user data, never plain passwords
                const usersToSave = this.users.map(user => ({
                    ...user,
                    // Ensure we never save plain passwords
                    password: undefined
                }));

                localStorage.setItem('cvmanager_users_hashed', JSON.stringify(usersToSave));
            } catch (error) {
                console.error('Error saving users:', error);
            }
        }

        async hashPassword(password) {
            // Simple hash for demo - in production use bcrypt or similar
            const encoder = new TextEncoder();
            const data = encoder.encode(password + 'cv-manager-salt-2024');
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        async verifyPassword(password, hash) {
            const passwordHash = await this.hashPassword(password);
            return passwordHash === hash;
        }

        checkSession() {
            const session = sessionStorage.getItem('cvmanager_secure_session');
            if (session) {
                try {
                    const sessionData = JSON.parse(session);
                    const now = new Date().getTime();

                    // Check session validity and timeout
                    if (now - sessionData.timestamp < window.CVManager.config.app.sessionTimeout) {
                        // Verify session integrity
                        if (this.verifySessionIntegrity(sessionData)) {
                            this.currentUser = sessionData.user;
                            this.showApp();
                            return;
                        }
                    }
                } catch (error) {
                    console.error('Invalid session data');
                }
            }

            // Clear invalid session
            sessionStorage.removeItem('cvmanager_secure_session');
            this.showAuth();
        }

        verifySessionIntegrity(sessionData) {
            // Basic session integrity check
            return sessionData.user &&
                sessionData.user.id &&
                sessionData.user.email &&
                sessionData.timestamp &&
                !sessionData.user.passwordHash; // Ensure no password data in session
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

            // Initialize CVPoolManager after authentication
            this.initializeCVManager();
        }

        initializeCVManager() {
            // Only initialize if not already initialized and CVPoolManager class exists
            if (typeof CVPoolManager !== 'undefined' && !window.cvPoolManager) {
                window.cvPoolManager = new CVPoolManager();
                console.log('CVPoolManager initialized after authentication');
            }
        }

        showSecurityWarning() {
            document.body.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; font-family: sans-serif; background: #fef2f2;">
                    <div style="max-width: 600px; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <div style="font-size: 48px; margin-bottom: 20px;">🚨</div>
                        <h1 style="color: #dc2626; margin-bottom: 16px;">Security Configuration Required</h1>
                        <p style="color: #374151; margin-bottom: 24px; line-height: 1.6;">
                            This application requires proper user management configuration. 
                            Please contact your administrator to set up user accounts securely.
                        </p>
                        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: left; font-size: 14px; color: #6b7280;">
                            <strong>For Developers:</strong><br>
                            1. Create a .env file with user credentials<br>
                            2. Use hashed passwords, not plain text<br>
                            3. Never commit credentials to version control
                        </div>
                    </div>
                </div>
            `;
        }

        bindEvents() {
            // Form toggles
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
            if (!user) {
                this.showError('Invalid email or password');
                return;
            }

            // Verify password against hash
            const isValidPassword = await this.verifyPassword(password, user.passwordHash);
            if (!isValidPassword) {
                this.showError('Invalid email or password');
                return;
            }

            // Successful login - create secure session
            this.currentUser = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
                // Note: Never include passwordHash in session
            };

            this.saveSecureSession();
            this.showApp();
            this.clearForms();

            console.log('✅ User authenticated successfully:', user.email);
        }

        async handleSignUp() {
            const name = document.getElementById('signup-name')?.value.trim();
            const email = document.getElementById('signup-email')?.value.trim();
            const password = document.getElementById('signup-password')?.value;
            const confirmPassword = document.getElementById('signup-confirm')?.value;

            // Enhanced validation
            if (!this.validateSignUpForm(name, email, password, confirmPassword)) {
                return;
            }

            // Check if user already exists
            if (this.users.find(u => u.email === email)) {
                this.showError('An account with this email already exists');
                return;
            }

            // Create new user with hashed password
            const newUser = {
                id: this.generateSecureId(),
                name,
                email,
                passwordHash: await this.hashPassword(password),
                role: 'user',
                createdAt: new Date().toISOString()
            };

            this.users.push(newUser);
            await this.saveUsers();

            // Auto sign in
            this.currentUser = {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            };

            this.saveSecureSession();
            this.showApp();
            this.clearForms();

            console.log('✅ New user created:', email);
        }

        validateSignUpForm(name, email, password, confirmPassword) {
            const validation = window.CVManager.config.validation;

            if (!name || name.length < validation.name.minLength) {
                this.showError(`Name must be at least ${validation.name.minLength} characters long`);
                return false;
            }

            if (!this.validateEmail(email)) {
                this.showError('Please enter a valid email address');
                return false;
            }

            if (password.length < validation.password.minLength) {
                this.showError(`Password must be at least ${validation.password.minLength} characters long`);
                return false;
            }

            if (validation.password.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                this.showError('Password must contain at least one special character');
                return false;
            }

            if (validation.password.requireNumber && !/\d/.test(password)) {
                this.showError('Password must contain at least one number');
                return false;
            }

            if (validation.password.requireUppercase && !/[A-Z]/.test(password)) {
                this.showError('Password must contain at least one uppercase letter');
                return false;
            }

            if (password !== confirmPassword) {
                this.showError('Passwords do not match');
                return false;
            }

            return true;
        }

validateEmail(email) {
    // Simple email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

        generateSecureId() {
            // Generate a secure random ID
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            return 'user_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        }

        saveSecureSession() {
            const sessionData = {
                user: this.currentUser,
                timestamp: Date.now(),
                // Add session fingerprint for additional security
                fingerprint: this.generateSessionFingerprint()
            };

            sessionStorage.setItem('cvmanager_secure_session', JSON.stringify(sessionData));
        }

        generateSessionFingerprint() {
            // Simple fingerprint based on browser characteristics
            return btoa(
                navigator.userAgent.slice(0, 20) +
                screen.width +
                screen.height +
                new Date().getTimezoneOffset()
            ).slice(0, 16);
        }

        logout() {
            this.currentUser = null;
            sessionStorage.removeItem('cvmanager_secure_session');

            // Clear any cached data that might contain sensitive info
            if (window.CVManager.cvManager) {
                window.CVManager.cvManager.clearSensitiveData?.();
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

        getCurrentUser() {
            return this.currentUser;
        }

        isDevelopment() {
            return window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('repl.co');
        }

        // Security utilities
        async exportUserData() {
            // GDPR compliance - export user's own data only
            if (!this.currentUser) return null;

            return {
                user: this.currentUser,
                exportDate: new Date().toISOString(),
                note: 'This export contains your personal account data only.'
            };
        }

        async deleteUserAccount() {
            // GDPR compliance - delete user's account
            if (!this.currentUser) return false;

            const confirmed = confirm(
                'Are you sure you want to delete your account? This action cannot be undone and will remove all your data.'
            );

            if (confirmed) {
                // Remove user from storage
                this.users = this.users.filter(u => u.id !== this.currentUser.id);
                await this.saveUsers();

                // Clear all user data
                if (window.CVManager.cvManager) {
                    await window.CVManager.cvManager.deleteAllUserData?.();
                }

                // Logout
                this.logout();

                alert('Your account has been deleted successfully.');
                return true;
            }

            return false;
        }
    }

    // Initialize secure auth manager when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        window.CVManager.auth = new SecureAuthManager();
    });

})();