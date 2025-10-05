// Backend routes/settings.js - Settings management endpoints
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Helper function to get user settings file path
function getSettingsPath(userId) {
    return path.join(__dirname, '../data/settings', `${userId}.json`);
}

// Helper function to get default settings
function getDefaultSettings() {
    return {
        aiProvider: {
            provider: 'claude',
            model: 'claude-3-haiku-20240307',
            apiUrl: 'https://api.anthropic.com/v1/messages',
            apiKey: '',
            enabled: false
        },
        parsingPrompt: `Extract CV information as JSON:
{
  "firstName": "first name or null",
  "lastName": "last name or null", 
  "email": "email or null",
  "phone": "phone or null",
  "address": "address or null",
  "uniqueIdentifier": "any ID number or null",
  "confidence": {
    "name": "high|medium|low",
    "contact": "high|medium|low", 
    "overall": "high|medium|low"
  },
  "extractionNotes": "any notes about ambiguities"
}

CV TEXT:`,
        preferences: {
            autoRefresh: false,
            theme: 'light',
            notifications: true
        },
        lastUpdated: new Date().toISOString()
    };
}

// GET /api/settings/:userId - Get user settings
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const settingsPath = getSettingsPath(userId);

        try {
            const settingsData = await fs.readFile(settingsPath, 'utf8');
            const settings = JSON.parse(settingsData);
            
            // Never send API keys in full - mask them
            if (settings.aiProvider && settings.aiProvider.apiKey) {
                settings.aiProvider.apiKey = settings.aiProvider.apiKey ? '[SET]' : '';
            }

            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            // File doesn't exist - return default settings
            const defaultSettings = getDefaultSettings();
            
            // Save default settings for this user
            await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
            
            res.json({
                success: true,
                data: defaultSettings
            });
        }
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load settings'
        });
    }
});

// POST /api/settings/ai-provider - Update AI provider settings
router.post('/ai-provider', async (req, res) => {
    try {
        const { userId, provider, model, apiUrl, apiKey, enabled, parsingPrompt } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const settingsPath = getSettingsPath(userId);
        let currentSettings = getDefaultSettings();

        // Load existing settings if they exist
        try {
            const existingData = await fs.readFile(settingsPath, 'utf8');
            currentSettings = JSON.parse(existingData);
        } catch (error) {
            // File doesn't exist, use defaults
        }

        // Update AI provider settings
        currentSettings.aiProvider = {
            provider: provider || currentSettings.aiProvider.provider,
            model: model || currentSettings.aiProvider.model,
            apiUrl: apiUrl || currentSettings.aiProvider.apiUrl,
            apiKey: apiKey || currentSettings.aiProvider.apiKey,
            enabled: enabled !== undefined ? enabled : currentSettings.aiProvider.enabled
        };

        // Update parsing prompt if provided
        if (parsingPrompt !== undefined) {
            currentSettings.parsingPrompt = parsingPrompt;
        }

        currentSettings.lastUpdated = new Date().toISOString();

        // Save updated settings
        await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2));

        // Return success (mask API key in response)
        const responseSettings = { ...currentSettings };
        if (responseSettings.aiProvider.apiKey) {
            responseSettings.aiProvider.apiKey = '[SET]';
        }

        res.json({
            success: true,
            data: responseSettings
        });

    } catch (error) {
        console.error('Save AI provider settings error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save settings'
        });
    }
});

// POST /api/settings/test - Test AI provider connection
router.post('/test', async (req, res) => {
    try {
        const { provider, model, apiUrl, apiKey } = req.body;

        if (!provider || !apiKey) {
            return res.status(400).json({
                success: false,
                data: {
                    success: false,
                    error: 'Provider and API key are required'
                }
            });
        }

        const startTime = Date.now();

        // Test the AI provider connection
        let testResult;
        
        if (provider === 'claude') {
            testResult = await testClaudeConnection(apiUrl, apiKey, model);
        } else if (provider === 'openai') {
            testResult = await testOpenAIConnection(apiUrl, apiKey, model);
        } else {
            testResult = { success: false, error: 'Unsupported provider' };
        }

        const responseTime = Date.now() - startTime;

        res.json({
            success: true,
            data: {
                success: testResult.success,
                error: testResult.error,
                responseTime: responseTime
            }
        });

    } catch (error) {
        console.error('Test connection error:', error);
        res.status(500).json({
            success: false,
            data: {
                success: false,
                error: 'Connection test failed'
            }
        });
    }
});

// Test Claude API connection
async function testClaudeConnection(apiUrl, apiKey, model) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 10,
                messages: [
                    { role: 'user', content: 'Test connection. Reply with "OK".' }
                ]
            })
        });

        if (response.ok) {
            return { success: true };
        } else {
            const errorData = await response.json();
            return { 
                success: false, 
                error: errorData.error?.message || `HTTP ${response.status}` 
            };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Test OpenAI API connection
async function testOpenAIConnection(apiUrl, apiKey, model) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'user', content: 'Test connection. Reply with "OK".' }
                ],
                max_tokens: 10
            })
        });

        if (response.ok) {
            return { success: true };
        } else {
            const errorData = await response.json();
            return { 
                success: false, 
                error: errorData.error?.message || `HTTP ${response.status}` 
            };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// PUT /api/settings/preferences - Update user preferences
router.put('/preferences', async (req, res) => {
    try {
        const { userId, preferences } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const settingsPath = getSettingsPath(userId);
        let currentSettings = getDefaultSettings();

        // Load existing settings
        try {
            const existingData = await fs.readFile(settingsPath, 'utf8');
            currentSettings = JSON.parse(existingData);
        } catch (error) {
            // File doesn't exist, use defaults
        }

        // Update preferences
        currentSettings.preferences = {
            ...currentSettings.preferences,
            ...preferences
        };
        
        currentSettings.lastUpdated = new Date().toISOString();

        // Save updated settings
        await fs.writeFile(settingsPath, JSON.stringify(currentSettings, null, 2));

        res.json({
            success: true,
            data: currentSettings.preferences
        });

    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update preferences'
        });
    }
});

module.exports = router;