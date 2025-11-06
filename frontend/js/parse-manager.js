// Parse Manager - Fixed version with proper initialization
// Handles CV parsing dialog and operations

(function() {
    'use strict';

    const API_BASE_URL = window.CVManager?.config?.api?.baseUrl || 'http://localhost:3001';

    class ParseManager {
        constructor() {
            this.API_BASE_URL = API_BASE_URL;
            this.isInitialized = false;
            console.log('🔧 ParseManager constructor called with API:', this.API_BASE_URL);
        }

        init() {
            this.isInitialized = true;
            console.log('✅ ParseManager initialized');
        }

        /**
         * Show parse dialog with options
         * Called when "Parse CVs" button is clicked
         */
        async showParseDialog() {
            console.log('🎯 showParseDialog called');

            const currentUser = window.CVManager.auth?.getCurrentUser();
            if (!currentUser) {
                this.showNotification('Please log in first', 'error');
                return;
            }

            // Remove any existing modal first
            const existingModal = document.getElementById('parse-modal');
            if (existingModal) {
                existingModal.remove();
            }

            // Create and show modal
            const modal = this.createParseModal();
            document.body.appendChild(modal);

            // Wait for DOM to be ready
            await new Promise(resolve => setTimeout(resolve, 50));

            // Show modal
            modal.classList.remove('hidden');
            modal.style.display = 'flex';

            // Load parse options
            await this.loadParseOptions(currentUser.id);
        }

        createParseModal() {
            const modal = document.createElement('div');
            modal.id = 'parse-modal';
            modal.className = 'modal';
            modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center;';
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px; background: white; border-radius: 12px; padding: 0; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header" style="padding: 24px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 600;">Parse CVs</h2>
                        <button class="modal-close" style="border: none; background: none; font-size: 24px; cursor: pointer; color: #6b7280; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px;">
                            ×
                        </button>
                    </div>
                    <div class="modal-body" style="padding: 24px;">
                        <p class="subtitle" style="margin-bottom: 24px; color: #6b7280; line-height: 1.5;">
                            Choose how you want to parse your CVs. You can do initial parsing for quick extraction 
                            or detailed parsing for comprehensive information.
                        </p>

                        <div id="parse-options-container">
                            <div class="loading" style="text-align: center; padding: 40px; color: #6b7280;">
                                <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                                <p style="margin-top: 16px;">Loading options...</p>
                            </div>
                        </div>

                        <div id="parse-stats-container" style="display: none; margin-top: 24px;"></div>

                        <div class="form-actions" style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                            <button class="btn-secondary" id="cancel-parse-btn" style="padding: 10px 20px; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
                                Cancel
                            </button>
                            <button id="confirm-parse-btn" class="btn-primary" disabled style="padding: 10px 20px; border: none; background: #3b82f6; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
                                Start Parsing
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Add spinner animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);

            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });

            // Close button
            const closeBtn = modal.querySelector('.modal-close');
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });

            // Cancel button
            const cancelBtn = modal.querySelector('#cancel-parse-btn');
            cancelBtn.addEventListener('click', () => {
                modal.remove();
            });

            // Confirm button
            const confirmBtn = modal.querySelector('#confirm-parse-btn');
            confirmBtn.addEventListener('click', () => {
                const parsingType = confirmBtn.dataset.parsingType;
                const userId = window.CVManager.auth?.getCurrentUser()?.id;
                if (userId && parsingType && !confirmBtn.disabled) {
                    this.startParsing(userId, parsingType);
                }
            });

            return modal;
        }

        async loadParseOptions(userId) {
            const container = document.getElementById('parse-options-container');

            if (!container) {
                console.error('❌ parse-options-container not found in DOM');
                return;
            }

            console.log('✅ Container found, rendering options...');

            try {
                const parseOptions = [
                    {
                        id: 'initial-all',
                        title: '📋 Initial Parsing - All CVs',
                        description: 'Parse all CVs with initial extraction (name, email, profile, seniority). This will re-parse CVs that were already parsed.',
                        icon: '🔄'
                    },
                    {
                        id: 'initial-onlynew',
                        title: '📋 Initial Parsing - Only New',
                        description: 'Parse only CVs that have never been initially parsed. Skips CVs that already have initial data.',
                        icon: '✨'
                    },
                    {
                        id: 'detailed-all',
                        title: '📊 Detailed Parsing - All CVs',
                        description: 'Parse all CVs with detailed extraction (skills, experience, education, languages). This will re-parse CVs that were already parsed.',
                        icon: '🔄'
                    },
                    {
                        id: 'detailed-onlynew',
                        title: '📊 Detailed Parsing - Only New',
                        description: 'Parse only CVs that have initial but not detailed parsing. Skips CVs that already have detailed data.',
                        icon: '⚡'
                    }
                ];

                const optionsHTML = parseOptions.map(option => `
                    <div class="parse-option-card" data-parse-type="${option.id}" style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s; display: flex; gap: 12px; align-items: start;">
                        <div class="parse-option-icon" style="font-size: 24px; flex-shrink: 0;">${option.icon}</div>
                        <div class="parse-option-content" style="flex: 1;">
                            <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${option.title}</h4>
                            <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">${option.description}</p>
                        </div>
                        <div class="parse-option-select" style="flex-shrink: 0;">
                            <input type="radio" name="parse-option" value="${option.id}" id="opt-${option.id}" style="width: 18px; height: 18px; cursor: pointer;">
                        </div>
                    </div>
                `).join('');

                container.innerHTML = `
                    <div class="parse-options-grid">
                        ${optionsHTML}
                    </div>
                    <style>
                        .parse-option-card:hover {
                            border-color: #3b82f6;
                            background-color: #f0f9ff;
                        }
                        .parse-option-card.selected {
                            border-color: #3b82f6;
                            background-color: #eff6ff;
                        }
                    </style>
                `;

                console.log('✅ Options HTML inserted');

                // Event delegation for card selection
                container.addEventListener('click', (e) => {
                    const card = e.target.closest('.parse-option-card');
                    if (!card) return;

                    const radio = card.querySelector('input[type="radio"]');
                    if (!radio) return;

                    radio.checked = true;

                    // Update visual selection
                    container.querySelectorAll('.parse-option-card').forEach(c => {
                        c.classList.remove('selected');
                    });
                    card.classList.add('selected');

                    console.log('🎯 Selected:', radio.value);

                    // Load stats for this option
                    this.loadParseStats(userId, radio.value);
                });

                console.log('✅ Event listeners attached');

            } catch (error) {
                console.error('❌ Error in loadParseOptions:', error);
                container.innerHTML = `
                    <div class="error" style="padding: 20px; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
                        <strong>Error Loading Options</strong>
                        <p style="margin: 8px 0 0 0;">${this.escapeHtml(error.message)}</p>
                    </div>
                `;
            }
        }

        async loadParseStats(userId, parsingType) {
            const statsContainer = document.getElementById('parse-stats-container');
            const confirmBtn = document.getElementById('confirm-parse-btn');

            if (!statsContainer || !confirmBtn) return;

            statsContainer.style.display = 'block';
            statsContainer.innerHTML = '<div class="loading" style="text-align: center; padding: 20px; color: #6b7280;">Calculating...</div>';

            try {
                const response = await window.CVManager.auth.authenticatedFetch(
                    `${this.API_BASE_URL}/api/cvs/parse/stats`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, parsingType })
                    }
                );

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.error || 'Failed to get stats');
                }

                const stats = result.data;

                console.log('📊 DEBUG - Parsing Type:', parsingType);
                console.log('📊 DEBUG - Stats:', stats);

                // Clear loading state
                statsContainer.innerHTML = '';

                // Check if LLM is configured
                if (!stats.hasActiveLLM) {
                    statsContainer.innerHTML += `
                        <div class="parse-warning" style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                            <div class="parse-warning-content" style="display: flex; gap: 12px;">
                                <span class="parse-warning-icon" style="font-size: 24px; flex-shrink: 0;">⚠️</span>
                                <div class="parse-warning-text">
                                    <strong style="display: block; margin-bottom: 4px;">No Active LLM Configured</strong>
                                    <p style="margin: 0; font-size: 14px; color: #92400e;">You don't have an active LLM provider configured. Mock data will be generated for testing purposes.</p>
                                    <p style="margin: 8px 0 0 0; font-size: 14px; color: #92400e;">To use real AI parsing, go to Settings > LLM Providers and configure an active provider.</p>
                                </div>
                            </div>
                        </div>
                    `;
                }

                // Show stats
                const statsHTML = `
                    <div class="parse-stats" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
                        <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Parsing Summary</h4>
                        
                        <div class="parse-stat-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                            <span class="parse-stat-label" style="color: #6b7280;">CVs to process:</span>
                            <span class="parse-stat-value" style="font-weight: 600;">${stats.cvsToProcess}</span>
                        </div>
                        
                        <div class="parse-stat-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                            <span class="parse-stat-label" style="color: #6b7280;">CVs to skip:</span>
                            <span class="parse-stat-value" style="font-weight: 600;">${stats.cvsToSkip}</span>
                        </div>
                        
                        <div class="parse-stat-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                            <span class="parse-stat-label" style="color: #6b7280;">Estimated duration:</span>
                            <span class="parse-stat-value" style="font-weight: 600;">${this.formatDuration(stats.estimatedDuration)}</span>
                        </div>

                        ${stats.hasActiveLLM ? `
                            <div class="parse-stat-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                <span class="parse-stat-label" style="color: #6b7280;">LLM Provider:</span>
                                <span class="parse-stat-value" style="font-weight: 600;">${stats.llmProvider || 'N/A'}</span>
                            </div>
                            
                            <div class="parse-stat-row" style="display: flex; justify-content: space-between; padding: 8px 0;">
                                <span class="parse-stat-label" style="color: #6b7280;">Model:</span>
                                <span class="parse-stat-value" style="font-weight: 600;">${stats.llmModel || 'N/A'}</span>
                            </div>
                        ` : ''}
                    </div>

                    ${stats.cvsToProcess === 0 ? `
                        <div class="parse-info" style="margin-top: 16px; padding: 12px; background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; color: #1e40af;">
                            <strong>ℹ️ No CVs to process</strong>
                            <p style="margin: 4px 0 0 0; font-size: 13px;">All CVs matching this criteria have already been parsed.</p>
                        </div>
                    ` : ''}

                    ${stats.cvsToProcess > 0 ? `
                        <div class="parse-info" style="margin-top: 16px; padding: 12px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; color: #92400e;">
                            <strong>⏱️ Processing Time</strong>
                            <p style="margin: 4px 0 0 0; font-size: 13px;">
                                Processing happens in the background with a ${stats.throttleMs / 1000}s delay between CVs 
                                to avoid overwhelming the API. You can continue working while parsing runs.
                            </p>
                        </div>
                    ` : ''}
                `;

                statsContainer.innerHTML += statsHTML;

                // Enable/disable confirm button
                confirmBtn.disabled = stats.cvsToProcess === 0;
                confirmBtn.style.opacity = stats.cvsToProcess === 0 ? '0.5' : '1';
                confirmBtn.style.cursor = stats.cvsToProcess === 0 ? 'not-allowed' : 'pointer';

                // Store parsing type for confirmation
                confirmBtn.dataset.parsingType = parsingType;

            } catch (error) {
                console.error('Error loading stats:', error);
                statsContainer.innerHTML = `
                    <div class="error" style="padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626;">
                        <p style="margin: 0;"><strong>Error Loading Stats</strong></p>
                        <p style="margin: 8px 0 0 0; font-size: 14px;">${this.escapeHtml(error.message)}</p>
                    </div>
                `;
                confirmBtn.disabled = true;
            }
        }

        formatDuration(seconds) {
            if (seconds < 60) return `${seconds} seconds`;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            if (remainingSeconds === 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
            return `${minutes}m ${remainingSeconds}s`;
        }

        async startParsing(userId, parsingType) {
            try {
                const response = await window.CVManager.auth.authenticatedFetch(
                    `${this.API_BASE_URL}/api/cvs/parse`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, parsingType })
                    }
                );

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.error || 'Failed to start parsing');
                }

                // Close modal
                const modal = document.getElementById('parse-modal');
                if (modal) modal.remove();

                // Show success notification
                this.showNotification(
                    `✅ Started parsing ${result.data.totalCVs} CVs. Check the CV Pool for updates.`,
                    'success',
                    5000
                );

                // Speed up auto-refresh temporarily
                if (window.cvPoolManager) {
                    window.cvPoolManager.startAutoRefresh(3000); // 3 seconds
                    setTimeout(() => {
                        window.cvPoolManager.startAutoRefresh(10000); // Back to 10 seconds
                    }, 60000); // After 1 minute
                }

            } catch (error) {
                console.error('Error starting parsing:', error);
                this.showNotification(`Failed to start parsing: ${error.message}`, 'error');
            }
        }

        showNotification(message, type = 'info', duration = 3000) {
            if (window.CVManager.ui?.showNotification) {
                window.CVManager.ui.showNotification(message, type, duration);
            } else {
                // Fallback
                alert(message);
            }
        }

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }

    // ============================================================================
    // INITIALIZE IMMEDIATELY
    // ============================================================================

    // Initialize Parse Manager immediately
    window.parseManager = new ParseManager();
    window.parseManager.init();
    console.log('✅ ParseManager initialized and ready');

})();