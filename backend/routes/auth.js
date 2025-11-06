// Backend routes/auth.js - Authentication endpoints
const express = require('express');
const authService = require('../services/auth-service');
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        const result = await authService.authenticateUser({email, password});
        
        if (result.success) {
            res.json({
                success: true,
                data: {
                    user: result.user,
                    token: result.token
                }
            });
        } else {
            res.status(401).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
});

// TEMPORARY: Reset password endpoint (remove after use)
router.post('/reset-password-dev', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    
    const { email, newPassword } = req.body;
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Load users
    const authService = require('../services/auth-service');
    const users = await authService.getAllUsers();
    const user = users.find(u => u.email === email);
    
    if (user) {
        user.passwordHash = passwordHash;
        await authService.saveUsers(users);
        res.json({ success: true, message: 'Password reset' });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Name, email and password are required'
            });
        }

        const result = await authService.registerUser({ name, email, password });
        
        if (result.success) {
            res.status(201).json({
                success: true,
                data: {
                    user: result.user,
                    token: result.token
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed'
        });
    }
});

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
    try {
        console.log('=== VERIFY TOKEN ===');
        console.log('Request body:', req.body);
        
        const { token } = req.body;

        if (!token) {
            console.log('No token provided');
            return res.status(400).json({
                success: false,
                error: 'Token is required'
            });
        }

        console.log('Token received:', token.substring(0, 20) + '...');

        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            console.log('Token decoded:', decoded);
            
            const authService = require('../services/auth-service');
            const user = await authService.getUserById(decoded.sub);
            
            console.log('User found:', !!user);

            if (!user || !user.active) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or inactive user'
                });
            }

            const { passwordHash, ...userData } = user;

            res.json({
                success: true,
                data: {
                    user: userData
                }
            });

        } catch (jwtError) {
            console.log('JWT Error:', jwtError.message);
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

    } catch (error) {
        console.error('Verify endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Token verification failed'
        });
    }
});

// GET /api/auth/users (development only)
router.get('/users', async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(404).json({ error: 'Not found' });
        }

        const users = await authService.getAllUsers();
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get users'
        });
    }
});

module.exports = router;