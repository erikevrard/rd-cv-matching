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

    // New processCVText – Begin
    async processCVText(extractedText, userId) {
        try {
            // Simulate AI processing delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Generate mock extracted data with European names
            const mockData = this.generateMockExtraction();

            return {
                success: true,
                data: {
                    ...mockData,
                    extractedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('AI processing error:', error);
            return {
                success: false,
                error: `AI processing failed: ${error.message}`
            };
        }
    }
    // New processCVText – End

    // ------begin of generateMockExtraction------
    generateMockExtraction() {
        const firstNames = [
            'Pieter', 'Sophie', 'Luc', 'Marie', 'Jan', 'Emma',
            'João', 'Ana', 'Miguel', 'Catarina', 'Pedro', 'Inês',
            'Ion', 'Elena', 'Andrei', 'Maria', 'Mihai', 'Alexandra',
            'Klaus', 'Anna', 'Stefan', 'Julia', 'Thomas', 'Laura',
            'Pierre', 'Camille', 'Lucas', 'Léa', 'Antoine', 'Chloé'
        ];

        const lastNames = [
            'Janssens', 'Dubois', 'Peeters', 'Lambert', 'Willems', 'Claes',
            'Silva', 'Santos', 'Ferreira', 'Oliveira', 'Costa', 'Rodrigues',
            'Popescu', 'Ionescu', 'Popa', 'Dumitrescu', 'Stoica', 'Gheorghiu',
            'Müller', 'Schmidt', 'Weber', 'Wagner', 'Becker', 'Hoffmann',
            'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit'
        ];

        const companies = [
            'Randstad Digital Belgium', 'TechConsult Brussels', 'DataFlow NV',
            'Innovate Solutions SA', 'EuroTech Partners', 'Digital Minds BVBA',
            'Porto Software House', 'Lisboa Tech Hub', 'Softinsa',
            'Bucharest IT Solutions', 'Romanian Software Group', 'TechRO',
            'Berlin Digital GmbH', 'München Tech AG', 'Hamburg Consulting',
            'Paris Innovation Lab', 'Lyon Tech Solutions', 'Marseille Digital'
        ];

        const profiles = [
            'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
            'DevOps Engineer', 'Data Engineer', 'Cloud Architect',
            'UI/UX Designer', 'Product Manager', 'Business Analyst',
            'Scrum Master', 'Technical Lead', 'Solutions Architect',
            'Data Scientist', 'QA Engineer', 'Security Specialist',
            'Mobile Developer', 'System Administrator', 'Database Administrator'
        ];

        const seniorities = ['Junior', 'Medior', 'Senior', 'Lead', 'Principal'];

        const cities = [
            'Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Leuven',
            'Lisbon', 'Porto', 'Braga', 'Coimbra', 'Faro',
            'Bucharest', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Brașov',
            'Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne',
            'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice'
        ];

        const streets = [
            'Rue de la Loi', 'Avenue Louise', 'Chaussée de Charleroi',
            'Rua Augusta', 'Avenida da Liberdade', 'Praça do Comércio',
            'Strada Victoriei', 'Bulevardul Unirii', 'Calea Dorobanților',
            'Hauptstraße', 'Bahnhofstraße', 'Königsallee',
            'Rue de Rivoli', 'Boulevard Haussmann', 'Avenue des Champs-Élysées'
        ];

        const confidenceLevels = ['high', 'medium', 'low'];

        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const streetNumber = Math.floor(Math.random() * 200) + 1;
        const postalCode = 1000 + Math.floor(Math.random() * 9000);
        const city = cities[Math.floor(Math.random() * cities.length)];
        const street = streets[Math.floor(Math.random() * streets.length)];

        return {
            firstName: firstName,
            lastName: lastName,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
            phone: `+32 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 90) + 10}`,
            address: `${street} ${streetNumber}, ${postalCode} ${city}`,
            uniqueIdentifier: `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 900000) + 100000}`,
            company: companies[Math.floor(Math.random() * companies.length)],
            profile: profiles[Math.floor(Math.random() * profiles.length)],
            seniority: seniorities[Math.floor(Math.random() * seniorities.length)],
            confidence: {
                name: confidenceLevels[Math.floor(Math.random() * confidenceLevels.length)],
                contact: confidenceLevels[Math.floor(Math.random() * confidenceLevels.length)],
                overall: confidenceLevels[Math.floor(Math.random() * confidenceLevels.length)]
            },
            extractionNotes: Math.random() > 0.7 ? 'Simulated extraction - some fields may require verification' : null
        };
    }

    // ------end of generateMockExtraction------

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