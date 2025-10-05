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

        const result = await authService.authenticateUser(email, password);
        
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
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required'
            });
        }

        const result = await authService.verifyToken(token);
        
        if (result.success) {
            res.json({
                success: true,
                data: {
                    user: result.user
                }
            });
        } else {
            res.status(401).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Token verification error:', error);
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