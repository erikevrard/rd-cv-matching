// backend/services/llm-caller.js
const https = require('https');
const http = require('http');

class LLMCaller {
  constructor() {
    this.supportedProviders = ['anthropic', 'openai', 'llama', 'gemini'];
  }

  /**
   * Main entry point - calls appropriate LLM based on config
   * @param {Object} llmConfig - LLM configuration from llm-service
   * @param {String} promptText - The complete prompt text
   * @param {Number} timeoutMs - Request timeout
   * @returns {Promise<Object>} { success, data: { text, usage }, error? }
   */
  async call(llmConfig, promptText, timeoutMs = 30000) {
    if (!llmConfig) {
      return { success: false, error: 'No LLM configuration provided' };
    }

    const provider = this.detectProvider(llmConfig);
    
    try {
      switch (provider) {
        case 'anthropic':
          return await this.callAnthropic(llmConfig, promptText, timeoutMs);
        case 'openai':
          return await this.callOpenAI(llmConfig, promptText, timeoutMs);
        case 'llama':
          return await this.callLlama(llmConfig, promptText, timeoutMs);
        case 'gemini':
          return await this.callGemini(llmConfig, promptText, timeoutMs);
        default:
          return await this.callGeneric(llmConfig, promptText, timeoutMs);
      }
    } catch (error) {
      console.error('LLM call error:', error);
      return { 
        success: false, 
        error: `LLM call failed: ${error.message}` 
      };
    }
  }

  /**
   * Detect provider from model name or API URL
   */
  detectProvider(llmConfig) {
    const model = (llmConfig.model || '').toLowerCase();
    const url = (llmConfig.apiUrl || '').toLowerCase();
    const name = (llmConfig.name || '').toLowerCase();

    if (model.includes('claude') || url.includes('anthropic') || name.includes('anthropic')) {
      return 'anthropic';
    }
    if (model.includes('gpt') || url.includes('openai') || name.includes('openai')) {
      return 'openai';
    }
    if (model.includes('llama') || url.includes('llama') || name.includes('llama')) {
      return 'llama';
    }
    if (model.includes('gemini') || url.includes('google') || url.includes('gemini')) {
      return 'gemini';
    }

    return 'generic';
  }

  /**
   * Validate that response is JSON and not HTML error page
   */
  validateJSONResponse(text) {
    if (!text) {
      return { valid: false, error: 'Empty response' };
    }

    // Check for HTML responses (error pages)
    const trimmed = text.trim();
    if (trimmed.startsWith('<') || trimmed.startsWith('<!DOCTYPE')) {
      return { 
        valid: false, 
        error: 'Received HTML response instead of JSON (likely authentication error or invalid endpoint)' 
      };
    }

    // Try to parse as JSON
    try {
      JSON.parse(trimmed);
      return { valid: true };
    } catch (e) {
      return { 
        valid: false, 
        error: `Invalid JSON response: ${e.message}` 
      };
    }
  }

  /**
   * Call Anthropic Claude API
   * https://docs.anthropic.com/claude/reference/messages_post
   */
  async callAnthropic(llmConfig, promptText, timeoutMs) {
    const payload = {
      model: llmConfig.model,
      max_tokens: llmConfig.maxTokens || 4096,
      temperature: llmConfig.temperature || 0,
      messages: [
        {
          role: 'user',
          content: promptText
        }
      ]
    };

    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': llmConfig.apiKey,
      ...llmConfig.headers
    };

    const response = await this.makeRequest(
      llmConfig.apiUrl,
      'POST',
      headers,
      payload,
      timeoutMs
    );

    if (!response.success) {
      return response;
    }

    // Validate response is JSON
    const validation = this.validateJSONResponse(JSON.stringify(response.data));
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Parse Anthropic response
    const data = response.data;
    if (data.content && Array.isArray(data.content) && data.content[0]) {
      return {
        success: true,
        data: {
          text: data.content[0].text,
          usage: data.usage || null
        }
      };
    }

    return { success: false, error: 'Invalid response format from Anthropic' };
  }

  /**
   * Call OpenAI API
   * https://platform.openai.com/docs/api-reference/chat/create
   */
  async callOpenAI(llmConfig, promptText, timeoutMs) {
    const payload = {
      model: llmConfig.model,
      max_tokens: llmConfig.maxTokens || 4096,
      temperature: llmConfig.temperature || 0,
      messages: [
        {
          role: 'user',
          content: promptText
        }
      ]
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmConfig.apiKey}`,
      ...llmConfig.headers
    };

    const response = await this.makeRequest(
      llmConfig.apiUrl,
      'POST',
      headers,
      payload,
      timeoutMs
    );

    if (!response.success) {
      return response;
    }

    // Validate response is JSON
    const validation = this.validateJSONResponse(JSON.stringify(response.data));
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Parse OpenAI response
    const data = response.data;
    if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
      return {
        success: true,
        data: {
          text: data.choices[0].message.content,
          usage: data.usage || null
        }
      };
    }

    return { success: false, error: 'Invalid response format from OpenAI' };
  }

  /**
   * Call Llama API (Ollama, Together.ai, Replicate, etc.)
   * Most use OpenAI-compatible format
   */
  async callLlama(llmConfig, promptText, timeoutMs) {
    const payload = {
      model: llmConfig.model,
      max_tokens: llmConfig.maxTokens || 4096,
      temperature: llmConfig.temperature || 0,
      messages: [
        {
          role: 'user',
          content: promptText
        }
      ]
    };

    const headers = {
      'Content-Type': 'application/json',
      ...llmConfig.headers
    };

    // Add API key if present
    if (llmConfig.apiKey) {
      headers['Authorization'] = `Bearer ${llmConfig.apiKey}`;
    }

    const response = await this.makeRequest(
      llmConfig.apiUrl,
      'POST',
      headers,
      payload,
      timeoutMs
    );

    if (!response.success) {
      return response;
    }

    // Validate response is JSON
    const validation = this.validateJSONResponse(JSON.stringify(response.data));
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Try OpenAI-compatible format first
    const data = response.data;
    if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
      return {
        success: true,
        data: {
          text: data.choices[0].message?.content || data.choices[0].text,
          usage: data.usage || null
        }
      };
    }

    // Try direct response format
    if (data.response) {
      return {
        success: true,
        data: {
          text: data.response,
          usage: null
        }
      };
    }

    return { success: false, error: 'Invalid response format from Llama' };
  }

  /**
   * Call Google Gemini API
   * https://ai.google.dev/api/rest/v1/models/generateContent
   */
  async callGemini(llmConfig, promptText, timeoutMs) {
    // Gemini uses API key in URL
    const url = llmConfig.apiUrl.includes('?') 
      ? `${llmConfig.apiUrl}&key=${llmConfig.apiKey}`
      : `${llmConfig.apiUrl}?key=${llmConfig.apiKey}`;

    const payload = {
      contents: [
        {
          parts: [
            {
              text: promptText
            }
          ]
        }
      ],
      generationConfig: {
        temperature: llmConfig.temperature || 0,
        maxOutputTokens: llmConfig.maxTokens || 4096
      }
    };

    const headers = {
      'Content-Type': 'application/json',
      ...llmConfig.headers
    };

    const response = await this.makeRequest(
      url,
      'POST',
      headers,
      payload,
      timeoutMs
    );

    if (!response.success) {
      return response;
    }

    // Validate response is JSON
    const validation = this.validateJSONResponse(JSON.stringify(response.data));
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Parse Gemini response
    const data = response.data;
    if (data.candidates && Array.isArray(data.candidates) && data.candidates[0]) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
        return {
          success: true,
          data: {
            text: candidate.content.parts[0].text,
            usage: data.usageMetadata || null
          }
        };
      }
    }

    return { success: false, error: 'Invalid response format from Gemini' };
  }

  /**
   * Generic API call for custom endpoints
   */
  async callGeneric(llmConfig, promptText, timeoutMs) {
    const payload = {
      model: llmConfig.model,
      prompt: promptText,
      max_tokens: llmConfig.maxTokens || 4096,
      temperature: llmConfig.temperature || 0
    };

    const headers = {
      'Content-Type': 'application/json',
      ...llmConfig.headers
    };

    if (llmConfig.apiKey) {
      headers['Authorization'] = `Bearer ${llmConfig.apiKey}`;
    }

    const response = await this.makeRequest(
      llmConfig.apiUrl,
      'POST',
      headers,
      payload,
      timeoutMs
    );

    if (!response.success) {
      return response;
    }

    // Validate response is JSON
    const validation = this.validateJSONResponse(JSON.stringify(response.data));
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Try to extract text from various common formats
    const data = response.data;
    const text = data.text || data.content || data.response || data.output || JSON.stringify(data);

    return {
      success: true,
      data: {
        text: text,
        usage: data.usage || null
      }
    };
  }

  /**
   * Make HTTP/HTTPS request
   */
  makeRequest(url, method, headers, body, timeoutMs) {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: headers,
        timeout: timeoutMs
      };

      const req = lib.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          // Check if response is HTML (error page)
          if (data.trim().startsWith('<') || data.trim().startsWith('<!DOCTYPE')) {
            resolve({ 
              success: false, 
              error: `Received HTML error page (HTTP ${res.statusCode}). Check API endpoint and credentials.` 
            });
            return;
          }

          try {
            const parsed = JSON.parse(data);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, data: parsed });
            } else {
              resolve({ 
                success: false, 
                error: `HTTP ${res.statusCode}: ${parsed.error?.message || data.substring(0, 200)}` 
              });
            }
          } catch (e) {
            resolve({ 
              success: false, 
              error: `Failed to parse response: ${e.message}. Response: ${data.substring(0, 200)}` 
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({ 
          success: false, 
          error: `Request failed: ${error.message}` 
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ 
          success: false, 
          error: 'Request timeout' 
        });
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }
}

module.exports = new LLMCaller();