// matching-manager.js - CV Matching Engine v2.0
// Enhanced with proper JSON-based ranking parameters

//const API_BASE_URL = window.CVManager?.config?.api?.baseUrl || 'http://localhost:3001';
function getAPIBaseURL() {
    return window.CVManager?.config?.api?.baseUrl || 'http://localhost:3001';
}

class MatchingManager {
    // constructor() {
    //     this.cvs = [];
    //     this.activeTenderSearch = null;
    //     this.viewMode = 'table'; // 'table' or 'chart'
    //     this.chartConfig = {
    //         xAxis: 'profileServiceFit',
    //         yAxis: 'experienceDurationFit'
    //     };
    //     this.sortConfig = {
    //         column: 'overallFit',
    //         direction: 'desc'
    //     };

    //     console.log('🎯 MatchingManager v2.0 initializing...');
    // }
    constructor() {
        this.cvs = [];
        this.activeTenderSearch = null;
        this.viewMode = 'table';
        this.chartConfig = {
            xAxis: 'profileServiceFit',
            yAxis: 'experienceDurationFit'
        };
        this.sortConfig = {
            column: 'overallFit',
            direction: 'desc'
        };
        this.isInitialized = false;  // ← NEW

        console.log('🎯 MatchingManager v2.0 created (will initialize on tab switch)...');
    }

    // async init() {
    //     await this.loadActiveTenderSearch();
    //     this.renderMatchingTab();
    //     console.log('✅ MatchingManager initialized');
    // }
    async init() {
        if (this.isInitialized) {
            // Just re-render if already initialized
            console.log('🔄 Matching tab already initialized, re-rendering...');
            await this.renderMatchingTab();
            return;
        }

        console.log('🎯 Initializing MatchingManager for the first time...');
        await this.loadActiveTenderSearch();
        this.isInitialized = true;
        await this.renderMatchingTab();
        console.log('✅ MatchingManager initialized');
    }

    // ============================================================================
    // AUTHENTICATION
    // ============================================================================

    async authenticatedFetch(url, options = {}) {
        const auth = window.CVManager.auth;
        if (!auth?.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const token = auth.getToken();
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: { ...defaultOptions.headers, ...options.headers }
        };

        const response = await fetch(url, mergedOptions);

        if (response.status === 401) {
            throw new Error('Authentication failed');
        }

        return response;
    }

    getCurrentUser() {
        return window.CVManager.auth?.getCurrentUser();
    }

    // ============================================================================
    // DATA LOADING
    // ============================================================================

    async loadActiveTenderSearch() {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) return;

            // Get active tender search from tender search builder
            if (window.tenderSearchBuilder) {
                this.activeTenderSearch = window.tenderSearchBuilder.getActiveSearch();
            }
        } catch (error) {
            console.error('Error loading active tender search:', error);
        }
    }

    async loadMatchingData() {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) {
                throw new Error('User not authenticated');
            }

            // Load all CVs
            // const response = await this.authenticatedFetch(
            //     `${API_BASE_URL}/api/cvs/${currentUser.id}`
            // );
            const response = await this.authenticatedFetch(
                `${getAPIBaseURL()}/api/cvs/${currentUser.id}`
            );

            const result = await response.json();

            if (result.success) {
                this.cvs = result.data.cvs || [];

                // Enhance CVs with matching data
                this.cvs = this.cvs.map(cv => this.enhanceCVWithMatchingData(cv));

                console.log(`📊 Loaded ${this.cvs.length} CVs for matching`);
            }
        } catch (error) {
            console.error('Error loading matching data:', error);
            this.showToast('Failed to load CVs', 'error');
        }
    }

    enhanceCVWithMatchingData(cv) {
        // Extract parsed data (prioritize detailed over initial)
        const initialData = cv.initialParsingData?.extractedData || {};
        const detailedData = cv.detailedParsingData?.extractedData || {};
        const data = { ...initialData, ...detailedData };

        // Extract matching parameters from JSON (if they exist)
        const matching = cv.matching || data.matching || {};

        // ============================================================================
        // 🎲 TEMPORARY: Generate random matching scores for demo purposes
        // TODO: Replace this block when actual matching algorithm is implemented
        // ============================================================================
        const generateRandomScore = () => {
            const score = Math.floor(Math.random() * 41) + 60; // 60-100%
            console.log('🎲 Generated random score:', score);
            return score;
        };

        console.log('📊 Existing matching data:', matching);

        const tempProfileFit = matching.profileServiceFit !== undefined
            ? matching.profileServiceFit
            : generateRandomScore();

        const tempExperienceFit = matching.experienceDurationFit !== undefined
            ? matching.experienceDurationFit
            : generateRandomScore();

        const tempLanguageFit = matching.languageFit !== undefined
            ? matching.languageFit
            : generateRandomScore();

        console.log('🎯 Final scores:', {
            profileFit: tempProfileFit,
            experienceFit: tempExperienceFit,
            languageFit: tempLanguageFit
        });
        // ============================================================================
        // END TEMPORARY RANDOM DATA
        // ============================================================================

        // ============================================================================
        // 🔍 INVESTIGATION: What language data do we actually have?
        // PUT THE NEW CONSOLE.LOGS HERE - RIGHT BEFORE "Build comprehensive matching data"
        // ============================================================================
        console.log('═══════════════════════════════════════');
        console.log('🔍 INVESTIGATING LANGUAGE DATA');
        console.log('═══════════════════════════════════════');
        console.log('🔍 Initial parsing data:', initialData);
        console.log('🔍 Detailed parsing data:', detailedData);
        console.log('🔍 Combined data:', data);
        console.log('---');
        console.log('📋 Checking all possible language fields:');
        console.log('  - data.languages:', data.languages);
        console.log('  - data.language:', data.language);
        console.log('  - data.languageSkills:', data.languageSkills);
        console.log('  - data.language_skills:', data.language_skills);
        console.log('  - data.spokenLanguages:', data.spokenLanguages);
        console.log('  - data.spoken_languages:', data.spoken_languages);
        console.log('═══════════════════════════════════════');
        // ============================================================================


        // Build comprehensive matching data
        const enhanced = {
            ...cv,
            matchingData: {
                // Basic identification
                candidateId: data.candidate_id || cv.id,
                fullName: this.getDisplayName(data.candidate_full_name, data.firstName, data.lastName),

                // Profile information
                preferredProfile: data.candidate_main_profile || data.profile || 'Not specified',
                nationality: data.candidate_nationality || data.nationality || 'Not specified',
                isEUCitizen: this.isEUCountry(data.candidate_nationality || data.nationality),
                residenceCountry: data.country_of_residence || 'Not specified',
                affiliatedCompany: data.current_employer || data.company || 'Not specified',

                // Language data
                languages: data.language_proficiency || data.languages || [],
                primaryLanguageLevel: this.getPrimaryLanguageLevel(
                    data.language_proficiency || data.languages,
                    this.activeTenderSearch
                ),

                // === MATCHING PARAMETERS ===

                // ✅ Use temporary random scores
                profileServiceFit: tempProfileFit,
                experienceDurationFit: tempExperienceFit,
                languageFit: tempLanguageFit,

                // Overall Fit (weighted average)
                overallFit: 0 // Calculated below
            }
        };

        // Calculate overall fit (weighted average)
        enhanced.matchingData.overallFit = this.calculateOverallFit(enhanced.matchingData);

        return enhanced;
    }

    getDisplayName(fullName, firstName, lastName) {
        // If full name exists and is not "NOT_FOUND", use it
        if (fullName && fullName !== "NOT_FOUND" && fullName.trim() !== "") {
            return fullName;
        }

        // Try to construct from first + last name
        const first = firstName && firstName !== "NOT_FOUND" ? firstName.trim() : "";
        const last = lastName && lastName !== "NOT_FOUND" ? lastName.trim() : "";

        if (first || last) {
            return `${first} ${last}`.trim();
        }

        // If no name available, return null (will show only ID)
        return null;
    }

    // ============================================================================
    // MATCHING CALCULATIONS
    // ============================================================================

    isEUCountry(countryCode) {
        if (!countryCode) return false;
        const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
            'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
            'SI', 'ES', 'SE'];
        return euCountries.includes(String(countryCode).toUpperCase());
    }

    /*     getPrimaryLanguageLevel(languages, tenderSearch) {
            if (!languages || !Array.isArray(languages) || languages.length === 0) {
                return null;
            }
    
            const primaryLang = tenderSearch?.requirements?.languages?.[0]?.language || 'English';
    
            const langEntry = languages.find(l =>
                l.language?.toLowerCase() === primaryLang.toLowerCase()
            );
    
            return langEntry?.level || null;
        } */

    getPrimaryLanguageLevel(languages, tenderSearch) {
        console.log('═══════════════════════════════════════');
        console.log('🔍 getPrimaryLanguageLevel CALLED');
        console.log('🔍 Languages parameter:', JSON.stringify(languages, null, 2));
        console.log('═══════════════════════════════════════');

        // If no language data, return null
        if (!languages || !Array.isArray(languages) || languages.length === 0) {
            console.log('❌ NO LANGUAGE DATA - returning null');
            return null;
        }

        // Try to find the primary language from tender search
        const primaryLangName = tenderSearch?.requirements?.languages?.[0]?.language ||
            tenderSearch?.requirements?.languages?.[0]?.primary ||
            'English';

        console.log('🔍 Looking for language:', primaryLangName);

        // Map common language names to ISO codes
        const langCodeMap = {
            'english': 'eng',
            'french': 'fra',
            'german': 'deu',
            'spanish': 'spa',
            'italian': 'ita',
            'portuguese': 'por',
            'dutch': 'nld'
        };

        const primaryLangCode = langCodeMap[primaryLangName.toLowerCase()] || primaryLangName.toLowerCase().substring(0, 3);

        // Try to find this language in candidate's languages
        const langEntry = languages.find(l =>
            l.language?.toLowerCase() === primaryLangName.toLowerCase() ||
            l.name?.toLowerCase() === primaryLangName.toLowerCase() ||
            l.language_code?.toLowerCase() === primaryLangCode.toLowerCase()
        );

        console.log('🔍 Found language entry:', langEntry);

        if (!langEntry) {
            console.log('⚠️ Primary language not found, using first available language');
            const firstLang = languages[0];
            const level = this.extractLanguageLevel(firstLang);
            console.log('✅ Using first language level:', level);
            return level;
        }

        // Extract level from the found language
        const level = this.extractLanguageLevel(langEntry);
        console.log('✅ Final extracted level:', level);
        return level;
    }

    // Add this helper method to extract a single level from language data
    extractLanguageLevel(languageObject) {
        console.log('🔧 Extracting level from:', languageObject);

        // Check for overall level field
        if (languageObject.level) {
            return this.normalizeLanguageLevel(languageObject.level);
        }

        if (languageObject.overallLevel) {
            return this.normalizeLanguageLevel(languageObject.overallLevel);
        }

        if (languageObject.original_level) {
            return this.normalizeLanguageLevel(languageObject.original_level);
        }

        // Collect separate skills (reading, writing, listening, speaking)
        const skills = [];

        if (languageObject.reading) skills.push(languageObject.reading);
        if (languageObject.writing) skills.push(languageObject.writing);
        if (languageObject.listening) skills.push(languageObject.listening);
        if (languageObject.speaking) skills.push(languageObject.speaking);

        if (skills.length > 0) {
            console.log('📊 Found skill levels:', skills);

            // Convert to numeric (A1=1, A2=2, B1=3, B2=4, C1=5, C2=6, Native=7)
            const levelMap = {
                'A1': 1, 'A2': 2,
                'B1': 3, 'B2': 4,
                'C1': 5, 'C2': 6,
                'NATIVE': 7, 'MOTHER TONGUE': 7, 'MOTHER_TONGUE': 7, 'MT': 7
            };
            const reverseMap = {
                1: 'A1', 2: 'A2',
                3: 'B1', 4: 'B2',
                5: 'C1', 6: 'C2',
                7: 'Native'
            };

            const numericLevels = skills
                .map(s => levelMap[this.normalizeLanguageLevel(s)?.toUpperCase()] || 0)
                .filter(n => n > 0);

            if (numericLevels.length > 0) {
                // Use the LOWEST skill level (conservative approach)
                const minLevel = Math.min(...numericLevels);
                const overallLevel = reverseMap[minLevel];
                console.log('✅ Calculated overall level (min):', overallLevel);
                return overallLevel;
            }
        }

        console.log('⚠️ No level found, returning null');
        return null;
    }

    // Add this helper method to normalize language level strings
    normalizeLanguageLevel(level) {
        if (!level) return null;

        const normalized = String(level).trim().toUpperCase();

        // Handle various native language representations
        const nativeVariants = [
            'NATIVE', 'NATIVE SPEAKER', 'NATIVE_SPEAKER',
            'MOTHER TONGUE', 'MOTHER_TONGUE', 'MOTHERTONGUE',
            'MT', 'L1', 'FIRST LANGUAGE', 'FIRST_LANGUAGE'
        ];

        if (nativeVariants.includes(normalized)) {
            return 'Native';
        }

        // Handle CEFR levels (A1, A2, B1, B2, C1, C2)
        const ceferMatch = normalized.match(/^([ABC])([12])$/);
        if (ceferMatch) {
            return `${ceferMatch[1]}${ceferMatch[2]}`;
        }

        // Return as-is if already in correct format
        return level;
    }

    calculateProfileServiceFit(data, tenderSearch) {
        if (!tenderSearch?.requirements?.profiles || tenderSearch.requirements.profiles.length === 0) {
            return 100; // No requirements = 100% match
        }

        const candidateProfile = (data.candidate_main_profile || data.profile || '').toLowerCase();
        if (!candidateProfile) return 0;

        // Check if candidate profile matches any required profile
        const matchingProfile = tenderSearch.requirements.profiles.find(reqProfile => {
            const reqProfileName = (reqProfile.name || reqProfile.profile || '').toLowerCase();
            return candidateProfile.includes(reqProfileName) || reqProfileName.includes(candidateProfile);
        });

        if (matchingProfile) {
            // Check services match
            const reqServices = matchingProfile.services || [];
            if (reqServices.length === 0) return 100;

            const candidateServices = data.services || [];
            if (candidateServices.length === 0) return 70; // Has profile but no services data

            // Calculate service overlap
            const matches = reqServices.filter(reqSvc =>
                candidateServices.some(candSvc =>
                    candSvc.toLowerCase().includes(reqSvc.toLowerCase()) ||
                    reqSvc.toLowerCase().includes(candSvc.toLowerCase())
                )
            );

            const serviceMatchPct = (matches.length / reqServices.length) * 100;
            return Math.round(serviceMatchPct);
        }

        return 30; // Profile doesn't match but has some profile
    }

    calculateExperienceDurationFit(data, tenderSearch) {
        if (!tenderSearch?.requirements?.minExperience) {
            return 100; // No requirements
        }

        const requiredYears = parseFloat(tenderSearch.requirements.minExperience) || 0;
        const candidateYears = this.parseExperienceYears(data.yearsOfExperience || data.years_of_experience);

        if (candidateYears >= requiredYears) {
            return 100;
        } else if (candidateYears === 0) {
            return 0;
        } else {
            // Partial credit: if they have 3 years and need 5, that's 60%
            const fit = (candidateYears / requiredYears) * 100;
            return Math.round(Math.min(fit, 100));
        }
    }

    parseExperienceYears(experienceData) {
        if (typeof experienceData === 'number') {
            return experienceData;
        }

        if (typeof experienceData === 'string') {
            const yearMatch = experienceData.match(/(\d+(\.\d+)?)\s*(?:years?|y)/i);
            if (yearMatch) return parseFloat(yearMatch[1]);
        }

        return 0;
    }

    calculateLanguageFit(languages, tenderSearch) {
        const requiredLangs = tenderSearch?.requirements?.languages || [];
        if (requiredLangs.length === 0) return 100;

        if (!languages || languages.length === 0) return 0;

        const languageLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

        let totalFit = 0;
        for (const reqLang of requiredLangs) {
            const reqLanguage = reqLang.language || reqLang.primary;
            const reqLevel = reqLang.level || 'B2';

            const candLang = languages.find(l =>
                l.language?.toLowerCase() === reqLanguage?.toLowerCase()
            );

            if (!candLang) {
                totalFit += 0; // Language not known
            } else {
                const reqLevelIdx = languageLevels.indexOf(reqLevel.toUpperCase());
                const candLevelIdx = languageLevels.indexOf((candLang.level || '').toUpperCase());

                if (candLevelIdx >= reqLevelIdx) {
                    totalFit += 100; // Meets or exceeds requirement
                } else if (candLevelIdx >= 0) {
                    // Partial credit based on how close
                    const gap = reqLevelIdx - candLevelIdx;
                    totalFit += Math.max(0, 100 - (gap * 20));
                }
            }
        }

        return Math.round(totalFit / requiredLangs.length);
    }

    calculateOverallFit(matchingData) {
        // Weighted average: Profile=40%, Experience=30%, Language=30%
        const weights = {
            profile: 0.4,
            experience: 0.3,
            language: 0.3
        };

        const overall =
            (matchingData.profileServiceFit * weights.profile) +
            (matchingData.experienceDurationFit * weights.experience) +
            (matchingData.languageFit * weights.language);

        return Math.round(overall);
    }

    // ============================================================================
    // RENDERING
    // ============================================================================

    async renderMatchingTab() {
        const matchingSection = document.getElementById('matching');
        if (!matchingSection) return;

        // Reload active tender search
        await this.loadActiveTenderSearch();

        if (!this.activeTenderSearch) {
            this.renderNoActiveTenderSearch(matchingSection);
            return;
        }

        // Load matching data
        await this.loadMatchingData();

        // Render interface
        this.renderMatchingInterface(matchingSection);
    }

    renderNoActiveTenderSearch(container) {
        const contentArea = container.querySelector('.placeholder-content') || container;

        contentArea.innerHTML = `
            <div class="matching-empty-state">
                <div class="empty-icon">🎯</div>
                <h3>No Active Tender Request</h3>
                <p>Please set an active tender request to begin matching CVs.</p>
                <button class="btn-primary" onclick="window.CVManager.ui.switchTab('tender-requests')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    Go to Tender Requests
                </button>
            </div>
        `;
    }

    renderMatchingInterface(container) {
        // Remove placeholder
        const placeholder = container.querySelector('.placeholder-content');
        if (placeholder) { placeholder.remove(); }

        // Create matching container
        let matchingContainer = container.querySelector('.matching-container');
        if (!matchingContainer) {
            matchingContainer = document.createElement('div');
            matchingContainer.className = 'matching-container';
            container.appendChild(matchingContainer);
        }

        matchingContainer.innerHTML = `
            <div class="matching-header">
                <div class="matching-info">
                    <h3>Candidate Matching</h3>
                    <p class="matching-subtitle">
                        Active Request: <strong>${this.escapeHtml(this.activeTenderSearch?.name || 'Unknown')}</strong>
                        <span class="cv-count">${this.cvs.length} candidates</span>
                    </p>
                </div>
                <div class="matching-controls">
                    <div class="view-toggle">
                        <button class="toggle-btn ${this.viewMode === 'table' ? 'active' : ''}" 
                                onclick="matchingManager.setViewMode('table')"
                                title="Table View">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="7" height="7"></rect>
                                <rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect>
                                <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                            Table
                        </button>
                        <button class="toggle-btn ${this.viewMode === 'chart' ? 'active' : ''}" 
                                onclick="matchingManager.setViewMode('chart')"
                                title="2D Chart">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                <line x1="6" y1="20" x2="6" y2="14"></line>
                            </svg>
                            Chart
                        </button>
                    </div>
                    <button class="btn-secondary" onclick="matchingManager.exportResults()" title="Export Results">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Export
                    </button>
                </div>
            </div>
            
            <div class="matching-content">
                ${this.viewMode === 'table' ? this.renderTableView() : this.renderChartView()}
            </div>
        `;
    }

    renderTableView() {
        const sortedCVs = this.sortCVs(this.cvs);

        const rows = sortedCVs.map(cv => {
            const m = cv.matchingData;

            // Handle display name - show only ID if name not available
            const nameDisplay = m.fullName
                ? `<strong>${this.escapeHtml(m.fullName)}</strong>
               <small class="cv-id">${this.escapeHtml(m.candidateId.substring(0, 12))}</small>`
                : `<strong class="cv-id-only">${this.escapeHtml(m.candidateId.substring(0, 12))}</strong>`;

            return `
            <tr class="matching-row" onclick="matchingManager.viewCVDetails('${cv.id}')">
                <td class="cell-name">
                    <div class="name-cell">
                        ${nameDisplay}
                    </div>
                </td>
                <td>
                    <div class="profile-cell">
                        ${this.escapeHtml(m.preferredProfile)}
                    </div>
                </td>
                <td>
                    <div class="nationality-cell">
                        ${this.escapeHtml(m.nationality)}
                        ${m.isEUCitizen ? '<span class="eu-badge">🇪🇺</span>' : ''}
                    </div>
                </td>
                <td>${this.escapeHtml(m.affiliatedCompany)}</td>
                <td class="fit-cell ${this.getFitClass(m.profileServiceFit)}">
                    <div class="fit-bar-container">
                        <div class="fit-bar" style="width: ${m.profileServiceFit}%"></div>
                        <span class="fit-value">${m.profileServiceFit}%</span>
                    </div>
                </td>
                <td class="fit-cell ${this.getFitClass(m.experienceDurationFit)}">
                    <div class="fit-bar-container">
                        <div class="fit-bar" style="width: ${m.experienceDurationFit}%"></div>
                        <span class="fit-value">${m.experienceDurationFit}%</span>
                    </div>
                </td>
                <td class="fit-cell ${this.getFitClass(m.languageFit)}">
                    <div class="fit-bar-container">
                        <div class="fit-bar" style="width: ${m.languageFit}%"></div>
                        <span class="fit-value">${m.languageFit}%</span>
                    </div>
                </td>
                <td class="fit-cell overall ${this.getFitClass(m.overallFit)}">
                    <div class="overall-score">
                        <span class="score-badge">${m.overallFit}%</span>
                    </div>
                </td>
            </tr>
        `;
        }).join('');

        return `
        <div class="table-container">
            <table class="matching-table">
                <thead>
                    <tr>
                        <th onclick="matchingManager.sortBy('fullName')">
                            Candidate ${this.getSortIcon('fullName')}
                        </th>
                        <th onclick="matchingManager.sortBy('preferredProfile')">
                            Profile ${this.getSortIcon('preferredProfile')}
                        </th>
                        <th onclick="matchingManager.sortBy('nationality')">
                            Nationality ${this.getSortIcon('nationality')}
                        </th>
                        <th onclick="matchingManager.sortBy('affiliatedCompany')">
                            Company ${this.getSortIcon('affiliatedCompany')}
                        </th>
                        <th onclick="matchingManager.sortBy('profileServiceFit')" class="text-center">
                            Profile Fit ${this.getSortIcon('profileServiceFit')}
                        </th>
                        <th onclick="matchingManager.sortBy('experienceDurationFit')" class="text-center">
                            Experience Fit ${this.getSortIcon('experienceDurationFit')}
                        </th>
                        <th onclick="matchingManager.sortBy('languageFit')" class="text-center">
                            Language Fit ${this.getSortIcon('languageFit')}
                        </th>
                        <th onclick="matchingManager.sortBy('overallFit')" class="text-center">
                            Overall Match ${this.getSortIcon('overallFit')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="8" class="empty-cell">No candidates found</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
    }

    renderChartView() {
        const primaryLang = this.activeTenderSearch?.requirements?.languages?.[0]?.language || 'English';
        const primaryLangLevel = this.activeTenderSearch?.requirements?.languages?.[0]?.level || 'B2';

        return `
        <div class="chart-container">
            <div class="chart-controls">
                <div class="chart-info">
                    <strong>2D Scatter Plot:</strong> Profile/Service Fit (X) vs Experience Duration Fit (Y)
                </div>
            </div>
            
            <div class="chart-legend">
                <div class="legend-section">
                    <div class="legend-title">Language Level (${primaryLang}):</div>
                    <div class="legend-items">
                        <div class="legend-item">
                            <span class="legend-dot lang-a"></span> A-Level (A1-A2)
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot lang-b"></span> B-Level (B1-B2)
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot lang-c"></span> C-Level (C1-C2)
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot lang-native"></span> Native Speaker
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot lang-none"></span> Not Known
                        </div>
                    </div>
                </div>
                <div class="legend-section">
                    <div class="legend-title">Dot Size:</div>
                    <div class="legend-items">
                        <div class="legend-item">
                            <span class="legend-dot size-1"></span> Level 1 (e.g., A1, B1, C1)
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot size-2"></span> Level 2 or Native (e.g., A2, B2, C2, Native)
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="scatter-chart" class="scatter-chart">
                ${this.renderScatterPlot()}
            </div>
        </div>
    `;
    }

    renderScatterPlot() {
        const chartWidth = 800;
        const chartHeight = 600;
        const padding = { top: 60, right: 60, bottom: 60, left: 85 }; // Increased left for y-axis label

        // Calculate plotting area
        const plotWidth = chartWidth - padding.left - padding.right;
        const plotHeight = chartHeight - padding.top - padding.bottom;

        // Primary language for coloring
        const primaryLang = this.activeTenderSearch?.requirements?.languages?.[0]?.language || 'English';

        // Generate dots with labels
        const dotsAndLabels = this.cvs.map(cv => {
            const m = cv.matchingData;
            const x = padding.left + (m.profileServiceFit / 100) * plotWidth;
            const y = chartHeight - padding.bottom - (m.experienceDurationFit / 100) * plotHeight;

            // Determine language level and color
            const langLevel = m.primaryLanguageLevel;
            const { color, className, size } = this.getLanguageDotStyle(langLevel);

            // Display name for label
            const displayName = m.fullName || m.candidateId.substring(0, 8);

            return `
            <div class="chart-dot ${className} size-${size}" 
                 style="left: ${x}px; top: ${y}px; background-color: ${color};"
                 data-cv-id="${cv.id}"
                 onmouseenter="matchingManager.showDotTooltip(event, '${cv.id}')"
                 onmouseleave="matchingManager.hideDotTooltip()"
                 onclick="matchingManager.viewCVDetails('${cv.id}')">
            </div>
            <div class="chart-dot-label" 
                 style="left: ${x + 12}px; top: ${y}px;"
                 data-cv-id="${cv.id}">
                ${this.escapeHtml(displayName)}
            </div>
        `;
        }).join('');

        // Grid lines
        const gridLines = [];
        for (let i = 0; i <= 10; i++) {
            const percent = i * 10;
            const x = padding.left + (percent / 100) * plotWidth;
            const y = chartHeight - padding.bottom - (percent / 100) * plotHeight;

            gridLines.push(`
            <line x1="${x}" y1="${padding.top}" x2="${x}" y2="${chartHeight - padding.bottom}" 
                  stroke="#e5e7eb" stroke-width="1" />
            <line x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}" 
                  stroke="#e5e7eb" stroke-width="1" />
            <text x="${x}" y="${chartHeight - padding.bottom + 20}" 
                  text-anchor="middle" font-size="11" fill="#6b7280">${percent}%</text>
            <text x="${padding.left - 10}" y="${y + 4}" 
                  text-anchor="end" font-size="11" fill="#6b7280">${percent}%</text>
        `);
        }

        return `
        <svg width="${chartWidth}" height="${chartHeight}" class="chart-svg">
            ${gridLines.join('')}
            
            <!-- Axes -->
            <line x1="${padding.left}" y1="${chartHeight - padding.bottom}" 
                  x2="${chartWidth - padding.right}" y2="${chartHeight - padding.bottom}" 
                  stroke="#374151" stroke-width="2"/>
            <line x1="${padding.left}" y1="${padding.top}" 
                  x2="${padding.left}" y2="${chartHeight - padding.bottom}" 
                  stroke="#374151" stroke-width="2"/>
            
            <!-- X-axis Label -->
            <text x="${chartWidth / 2}" y="${chartHeight - 15}" 
                  text-anchor="middle" font-size="14" font-weight="600" fill="#1f2937">
                Profile/Service Fit →
            </text>
            
            <!-- Y-axis Label (rotated, moved further left) -->
            <text x="${-chartHeight / 2}" y="20" 
                  text-anchor="middle" font-size="14" font-weight="600" fill="#1f2937"
                  transform="rotate(-90)">
                Experience Duration Fit →
            </text>
        </svg>
        
        <div class="dots-container">
            ${dotsAndLabels}
        </div>
        
        <div id="dot-tooltip" class="dot-tooltip" style="display: none;"></div>
    `;
    }

    getLanguageDotStyle(level) {
        if (!level) {
            return { color: 'transparent', className: 'lang-none', size: 1 };
        }

        const levelUpper = String(level).toUpperCase();

        // Handle Native as special case
        if (levelUpper === 'NATIVE' || levelUpper.includes('NATIVE')) {
            return {
                color: '#8b5cf6', // Purple for native
                className: 'lang-native',
                size: 2 // Larger size for native
            };
        }

        const letter = levelUpper[0];
        const number = levelUpper[1] || '1';

        let color, className;
        switch (letter) {
            case 'A':
                color = '#ef4444'; // red
                className = 'lang-a';
                break;
            case 'B':
                color = '#f59e0b'; // orange
                className = 'lang-b';
                break;
            case 'C':
                color = '#22c55e'; // green
                className = 'lang-c';
                break;
            default:
                color = '#9ca3af'; // gray
                className = 'lang-none';
        }

        const size = number === '2' ? 2 : 1;

        return { color, className, size };
    }

    // ============================================================================
    // CHART INTERACTIONS
    // ============================================================================

    showDotTooltip(event, cvId) {
        const cv = this.cvs.find(c => c.id === cvId);
        if (!cv) return;

        const m = cv.matchingData;
        const tooltip = document.getElementById('dot-tooltip');
        if (!tooltip) return;

        // Handle name display
        const nameDisplay = m.fullName
            ? this.escapeHtml(m.fullName)
            : `<em>ID: ${this.escapeHtml(m.candidateId.substring(0, 12))}</em>`;

        tooltip.innerHTML = `
        <div class="tooltip-header">${nameDisplay}</div>
        <div class="tooltip-body">
            <div class="tooltip-row">
                <span>ID:</span>
                <strong>${this.escapeHtml(m.candidateId.substring(0, 12))}</strong>
            </div>
            <div class="tooltip-row">
                <span>Profile:</span>
                <strong>${this.escapeHtml(m.preferredProfile)}</strong>
            </div>
            <div class="tooltip-row">
                <span>Nationality:</span>
                <strong>${this.escapeHtml(m.nationality)} ${m.isEUCitizen ? '🇪🇺' : ''}</strong>
            </div>
            <hr>
            <div class="tooltip-row">
                <span>Profile Fit:</span>
                <strong class="${this.getFitClass(m.profileServiceFit)}">${m.profileServiceFit}%</strong>
            </div>
            <div class="tooltip-row">
                <span>Experience Fit:</span>
                <strong class="${this.getFitClass(m.experienceDurationFit)}">${m.experienceDurationFit}%</strong>
            </div>
            <div class="tooltip-row">
                <span>Language Fit:</span>
                <strong class="${this.getFitClass(m.languageFit)}">${m.languageFit}%</strong>
            </div>
            <hr>
            <div class="tooltip-row highlight">
                <span>Overall Match:</span>
                <strong class="${this.getFitClass(m.overallFit)}">${m.overallFit}%</strong>
            </div>
        </div>
    `;

        // Show tooltip first (invisible) to get dimensions
        tooltip.style.display = 'block';
        tooltip.style.opacity = '0';

        // Get tooltip dimensions
        const tooltipRect = tooltip.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width;
        const tooltipHeight = tooltipRect.height;

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate initial position (offset from cursor)
        let left = event.clientX + 15;
        let top = event.clientY + 15;

        // Adjust horizontal position if tooltip would go off-screen
        if (left + tooltipWidth > viewportWidth - 20) {
            left = event.clientX - tooltipWidth - 15;
        }

        // Adjust vertical position if tooltip would go off-screen
        if (top + tooltipHeight > viewportHeight - 20) {
            top = event.clientY - tooltipHeight - 15;
        }

        // Ensure tooltip doesn't go off left edge
        if (left < 20) {
            left = 20;
        }

        // Ensure tooltip doesn't go off top edge
        if (top < 20) {
            top = 20;
        }

        // Apply final position and make visible
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        tooltip.style.opacity = '1';
    }

    hideDotTooltip() {
        const tooltip = document.getElementById('dot-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    // ============================================================================
    // SORTING
    // ============================================================================

    sortBy(column) {
        if (this.sortConfig.column === column) {
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortConfig.column = column;
            this.sortConfig.direction = 'desc';
        }

        this.renderMatchingInterface(document.getElementById('matching'));
    }

    sortCVs(cvs) {
        const column = this.sortConfig.column;
        const direction = this.sortConfig.direction;

        return [...cvs].sort((a, b) => {
            let aVal = a.matchingData[column];
            let bVal = b.matchingData[column];

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    getSortIcon(column) {
        if (this.sortConfig.column !== column) {
            return '<span class="sort-icon">⇅</span>';
        }
        return this.sortConfig.direction === 'asc'
            ? '<span class="sort-icon active">↑</span>'
            : '<span class="sort-icon active">↓</span>';
    }

    // ============================================================================
    // VIEW ACTIONS
    // ============================================================================

    setViewMode(mode) {
        this.viewMode = mode;
        this.renderMatchingInterface(document.getElementById('matching'));
    }

    async viewCVDetails(cvId) {
        window.CVManager.ui.switchTab('cv-pool');
        setTimeout(() => {
            if (window.cvPoolManager) {
                window.cvPoolManager.viewCV(cvId);
            }
        }, 300);
    }

    exportResults() {
        try {
            const exportData = this.cvs.map(cv => {
                const m = cv.matchingData;
                return {
                    'Candidate ID': m.candidateId,
                    'Full Name': m.fullName,
                    'Nationality': m.nationality,
                    'EU Citizen': m.isEUCitizen ? 'Yes' : 'No',
                    'Company': m.affiliatedCompany,
                    'Profile Fit (%)': m.profileServiceFit,
                    'Experience Fit (%)': m.experienceDurationFit,
                    'Language Fit (%)': m.languageFit,
                    'Overall Match (%)': m.overallFit
                };
            });

            const csv = this.convertToCSV(exportData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', `matching_results_${Date.now()}.csv`);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.showToast('✅ Results exported successfully', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Failed to export results', 'error');
        }
    }

    convertToCSV(data) {
        if (!data || data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvRows = [];

        csvRows.push(headers.join(','));

        for (const row of data) {
            const values = headers.map(header => {
                const val = row[header];
                const escaped = String(val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    getFitClass(value) {
        if (value >= 80) return 'fit-high';
        if (value >= 60) return 'fit-medium';
        if (value >= 40) return 'fit-low';
        return 'fit-very-low';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let matchingManager;

document.addEventListener('DOMContentLoaded', () => {
    const checkAuthAndInit = () => {
        if (window.CVManager?.auth?.isAuthenticated()) {
            matchingManager = new MatchingManager();
            window.matchingManager = matchingManager;
            window.CVManager.matchingManager = matchingManager;

            matchingManager.init(); // ← ADD THIS LINE

            console.log('✅ MatchingManager v2.0 initialized');
        } else {
            setTimeout(checkAuthAndInit, 100);
        }
    };
    setTimeout(checkAuthAndInit, 600);
});

// Listen for tab changes
// document.addEventListener('tabChange', (event) => {
//     if (event.detail?.tabId === 'matching' && matchingManager) {
//         matchingManager.init();
//     }
// });

// Listen for tab changes
document.addEventListener('tabChange', (event) => {
    console.log('📢 tabChange event received:', event.detail);
    if (event.detail?.tabId === 'matching' && matchingManager) {
        console.log('🎯 Initializing Matching tab...');
        matchingManager.init();
    }
});

// FALLBACK: MutationObserver for when tabChange doesn't fire
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const matchingSection = document.getElementById('matching');
            if (matchingSection?.classList.contains('active') && matchingManager && !matchingManager.isInitialized) {
                console.log('👀 Matching tab became visible (MutationObserver), initializing...');
                matchingManager.init();
            }
        }
    });
});

// Start observing when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const matchingSection = document.getElementById('matching');
    if (matchingSection) {
        observer.observe(matchingSection, { attributes: true });
        console.log('👁️ MutationObserver watching matching section');
    }
});

console.log('✅ Matching module loaded (v2.0 - Enhanced with JSON rankings)');