// Backend services/ai-service.js - AI integration service
const fs = require('fs').promises;
const path = require('path');

class AIService {
    constructor() {
        this.settingsPath = path.join(__dirname, '../data/settings');
    }

    async getUserSettings(userId) {
        try {
            const settingsFile = path.join(this.settingsPath, `${userId}.json`);
            const data = await fs.readFile(settingsFile, 'utf8');
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    async processCVText(extractedText, userId) {
        try {
            const settings = await this.getUserSettings(userId);
            
            if (!settings || !settings.aiProvider || !settings.aiProvider.enabled) {
                return {
                    success: false,
                    error: 'AI processing not enabled'
                };
            }

            const { provider, model, apiUrl, apiKey } = settings.aiProvider;
            const parsingPrompt = settings.parsingPrompt || this.getDefaultPrompt();

            if (!apiKey) {
                return {
                    success: false,
                    error: 'AI API key not configured'
                };
            }

            // Prepare the prompt with CV text
            const fullPrompt = parsingPrompt.replace('{CV_TEXT}', extractedText);

            let result;
            if (provider === 'claude') {
                result = await this.processWithClaude(apiUrl, apiKey, model, fullPrompt);
            } else if (provider === 'openai') {
                result = await this.processWithOpenAI(apiUrl, apiKey, model, fullPrompt);
            } else {
                return {
                    success: false,
                    error: `Unsupported AI provider: ${provider}`
                };
            }

            if (result.success) {
                // Parse and validate the AI response
                const parsedData = this.parseAIResponse(result.response);
                return {
                    success: true,
                    data: parsedData
                };
            } else {
                return result;
            }

        } catch (error) {
            console.error('AI processing error:', error);
            return {
                success: false,
                error: `AI processing failed: ${error.message}`
            };
        }
    }

    async processWithClaude(apiUrl, apiKey, model, prompt) {
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
                    max_tokens: 2000,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                return {
                    success: false,
                    error: errorData.error?.message || `Claude API error: ${response.status}`
                };
            }

            const data = await response.json();
            return {
                success: true,
                response: data.content[0].text
            };

        } catch (error) {
            return {
                success: false,
                error: `Claude API request failed: ${error.message}`
            };
        }
    }

    async processWithOpenAI(apiUrl, apiKey, model, prompt) {
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
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 2000,
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                return {
                    success: false,
                    error: errorData.error?.message || `OpenAI API error: ${response.status}`
                };
            }

            const data = await response.json();
            return {
                success: true,
                response: data.choices[0].message.content
            };

        } catch (error) {
            return {
                success: false,
                error: `OpenAI API request failed: ${error.message}`
            };
        }
    }

    parseAIResponse(responseText) {
        try {
            // Clean up the response text - remove markdown code blocks if present
            let cleanText = responseText.trim();
            
            // Remove ```json and ``` markers if present
            cleanText = cleanText.replace(/```json\s*\n?/g, '');
            cleanText = cleanText.replace(/```\s*$/g, '');
            cleanText = cleanText.trim();

            // Try to parse as JSON
            const parsed = JSON.parse(cleanText);

            // Validate required fields and add defaults
            const result = {
                firstName: parsed.firstName || null,
                lastName: parsed.lastName || null,
                email: parsed.email || null,
                phone: parsed.phone || null,
                address: parsed.address || null,
                uniqueIdentifier: parsed.uniqueIdentifier || null,
                confidence: {
                    name: this.validateConfidence(parsed.confidence?.name) || 'low',
                    contact: this.validateConfidence(parsed.confidence?.contact) || 'low',
                    overall: this.validateConfidence(parsed.confidence?.overall) || 'low'
                },
                extractionNotes: parsed.extractionNotes || null,
                extractedAt: new Date().toISOString()
            };

            return result;

        } catch (error) {
            console.error('Failed to parse AI response:', error);
            
            // Return a fallback structure with notes about the parsing failure
            return {
                firstName: null,
                lastName: null,
                email: null,
                phone: null,
                address: null,
                uniqueIdentifier: null,
                confidence: {
                    name: 'low',
                    contact: 'low',
                    overall: 'low'
                },
                extractionNotes: `AI response parsing failed: ${error.message}. Raw response: ${responseText.substring(0, 200)}...`,
                extractedAt: new Date().toISOString()
            };
        }
    }

    validateConfidence(confidence) {
        const validLevels = ['high', 'medium', 'low'];
        if (typeof confidence === 'string' && validLevels.includes(confidence.toLowerCase())) {
            return confidence.toLowerCase();
        }
        return 'low';
    }

    getDefaultPrompt() {
        return `Extract CV information as JSON:
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

CV TEXT:
{CV_TEXT}`;
    }

    async testConnection(provider, apiUrl, apiKey, model) {
        try {
            const testPrompt = 'Test connection. Reply with only "OK".';
            
            let result;
            if (provider === 'claude') {
                result = await this.processWithClaude(apiUrl, apiKey, model, testPrompt);
            } else if (provider === 'openai') {
                result = await this.processWithOpenAI(apiUrl, apiKey, model, testPrompt);
            } else {
                return {
                    success: false,
                    error: 'Unsupported provider'
                };
            }

            return result;

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getUsageStats(userId) {
        // This would track AI usage per user in a production system
        // For now, return placeholder data
        return {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            tokensUsed: 0,
            lastUsed: null
        };
    }
}

module.exports = new AIService();