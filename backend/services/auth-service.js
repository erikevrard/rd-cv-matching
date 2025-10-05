// Backend services/auth-service.js - Authentication business logic
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

class AuthService {
    constructor() {
        this.usersFilePath = path.join(__dirname, '../data/users/users.json');
        this.saltRounds = 12;
    }

    async initializeUsersFile() {
        try {
            await fs.access(this.usersFilePath);
        } catch {
            // File doesn't exist, create with default user
            const defaultUser = {
                id: 'user_default_erik',
                name: 'Erik Evrard',
                email: 'erik@evrard.net',
                passwordHash: await bcrypt.hash('abc123', this.saltRounds),
                role: 'admin',
                createdAt: new Date().toISOString(),
                lastLogin: null
            };

            await fs.writeFile(
                this.usersFilePath, 
                JSON.stringify([defaultUser], null, 2)
            );
            
            console.log('Created default user: erik@evrard.net / abc123');
        }
    }

    async loadUsers() {
        try {
            await this.initializeUsersFile();
            const data = await fs.readFile(this.usersFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading users:', error);
            return [];
        }
    }

    async saveUsers(users) {
        try {
            await fs.writeFile(this.usersFilePath, JSON.stringify(users, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving users:', error);
            return false;
        }
    }

    async authenticateUser(email, password) {
        try {
            const users = await this.loadUsers();
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

            if (!user) {
                return { success: false, error: 'Invalid email or password' };
            }

            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            
            if (!isValidPassword) {
                return { success: false, error: 'Invalid email or password' };
            }

            // Update last login
            user.lastLogin = new Date().toISOString();
            await this.saveUsers(users);

            // Generate session token (simple approach)
            const token = this.generateSessionToken(user.id);

            // Return user data without password hash
            const { passwordHash, ...userWithoutPassword } = user;

            return {
                success: true,
                user: userWithoutPassword,
                token: token
            };

        } catch (error) {
            console.error('Authentication error:', error);
            return { success: false, error: 'Authentication failed' };
        }
    }

    async registerUser({ name, email, password }) {
        try {
            const users = await this.loadUsers();

            // Check if user already exists
            const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (existingUser) {
                return { success: false, error: 'User with this email already exists' };
            }

            // Validate input
            if (!this.validateUserInput({ name, email, password })) {
                return { success: false, error: 'Invalid user data' };
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, this.saltRounds);

            // Create new user
            const newUser = {
                id: uuidv4(),
                name: name.trim(),
                email: email.toLowerCase().trim(),
                passwordHash,
                role: 'user',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            };

            users.push(newUser);
            await this.saveUsers(users);

            // Generate session token
            const token = this.generateSessionToken(newUser.id);

            // Return user data without password hash
            const { passwordHash: _, ...userWithoutPassword } = newUser;

            return {
                success: true,
                user: userWithoutPassword,
                token: token
            };

        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Registration failed' };
        }
    }

    async verifyToken(token) {
        try {
            // Simple token verification (in production, use JWT or similar)
            const tokenData = this.parseSessionToken(token);
            
            if (!tokenData || !tokenData.userId || !tokenData.timestamp) {
                return { success: false, error: 'Invalid token' };
            }

            // Check token expiry (24 hours)
            const tokenAge = Date.now() - tokenData.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            if (tokenAge > maxAge) {
                return { success: false, error: 'Token expired' };
            }

            // Get user data
            const users = await this.loadUsers();
            const user = users.find(u => u.id === tokenData.userId);

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            // Return user data without password hash
            const { passwordHash, ...userWithoutPassword } = user;

            return {
                success: true,
                user: userWithoutPassword
            };

        } catch (error) {
            console.error('Token verification error:', error);
            return { success: false, error: 'Token verification failed' };
        }
    }

    generateSessionToken(userId) {
        // Simple token generation (in production, use JWT)
        const tokenData = {
            userId,
            timestamp: Date.now(),
            random: Math.random().toString(36)
        };
        
        return Buffer.from(JSON.stringify(tokenData)).toString('base64');
    }

    parseSessionToken(token) {
        try {
            const decoded = Buffer.from(token, 'base64').toString('utf8');
            return JSON.parse(decoded);
        } catch {
            return null;
        }
    }

    validateUserInput({ name, email, password }) {
        // Name validation
        if (!name || name.trim().length < 2 || name.trim().length > 50) {
            return false;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return false;
        }

        // Password validation
        if (!password || password.length < 8) {
            return false;
        }

        // Check for uppercase, number, and special character
        if (!/[A-Z]/.test(password)) {
            return false;
        }
        if (!/\d/.test(password)) {
            return false;
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return false;
        }

        return true;
    }

    async getAllUsers() {
        // Development only - get all users without password hashes
        const users = await this.loadUsers();
        return users.map(user => {
            const { passwordHash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });
    }

    async getUserById(userId) {
        const users = await this.loadUsers();
        const user = users.find(u => u.id === userId);
        
        if (user) {
            const { passwordHash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        }
        
        return null;
    }

    async updateUserProfile(userId, updates) {
        try {
            const users = await this.loadUsers();
            const userIndex = users.findIndex(u => u.id === userId);

            if (userIndex === -1) {
                return { success: false, error: 'User not found' };
            }

            // Only allow certain fields to be updated
            const allowedUpdates = ['name'];
            const filteredUpdates = {};

            allowedUpdates.forEach(field => {
                if (updates[field] !== undefined) {
                    filteredUpdates[field] = updates[field];
                }
            });

            // Update user
            users[userIndex] = {
                ...users[userIndex],
                ...filteredUpdates,
                updatedAt: new Date().toISOString()
            };

            await this.saveUsers(users);

            const { passwordHash, ...userWithoutPassword } = users[userIndex];
            return { success: true, user: userWithoutPassword };

        } catch (error) {
            console.error('Update user profile error:', error);
            return { success: false, error: 'Failed to update profile' };
        }
    }

    async changePassword(userId, currentPassword, newPassword) {
        try {
            const users = await this.loadUsers();
            const user = users.find(u => u.id === userId);

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
            
            if (!isValidPassword) {
                return { success: false, error: 'Current password is incorrect' };
            }

            // Validate new password
            if (!this.validateUserInput({ name: 'test', email: 'test@test.com', password: newPassword })) {
                return { success: false, error: 'New password does not meet requirements' };
            }

            // Hash new password
            const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);
            
            // Update user
            user.passwordHash = newPasswordHash;
            user.updatedAt = new Date().toISOString();

            await this.saveUsers(users);

            return { success: true };

        } catch (error) {
            console.error('Change password error:', error);
            return { success: false, error: 'Failed to change password' };
        }
    }
}

module.exports = new AuthService();