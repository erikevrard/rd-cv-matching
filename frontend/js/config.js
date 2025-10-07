// Configuration file for CV Management System
window.CVManager = window.CVManager || {};

window.CVManager.config = {
    // Application settings
    app: {
        name: 'CV Management System',
        version: '2.0.0', // 🔄 Updated for security release
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedFileTypes: ['pdf', 'doc', 'docx', 'txt'],
        maxCVs: 1000,
        sessionTimeout: 24 * 60 * 60 * 1000 // 24 hours
    },

    // File paths
    files: {
        users: 'data/users.json',
        cvs: 'data/cvs.json',
        uploads: 'data/uploads/'
    },

    // 🔄 REMOVED: defaultUser - now handled securely by auth.js

    // CV processing settings
    processing: {
        enableLLM: false,
        sampleDelay: 2000,
        extractionFields: [
            'name', 'email', 'phone', 'company', 'profile', 'seniority', 'skills', 'experience'
        ]
    },

    // Sample data for testing (non-sensitive)
    sampleCVData: [
        {
            name: 'John Smith',
            email: 'john.smith@email.com',
            phone: '+32 123 456 789',
            company: 'TechCorp Belgium',
            profile: 'Full Stack Developer',
            seniority: 'Senior',
            skills: ['JavaScript', 'React', 'Node.js', 'Python'],
            experience: 5
        },
        {
            name: 'Marie Dupont',
            email: 'marie.dupont@email.com',
            phone: '+32 987 654 321',
            company: 'StartupXYZ',
            profile: 'DevOps Engineer',
            seniority: 'Mid-level',
            skills: ['Docker', 'Kubernetes', 'AWS', 'Jenkins'],
            experience: 3
        },
        {
            name: 'Ahmed Hassan',
            email: 'ahmed.hassan@email.com',
            phone: '+32 555 123 456',
            company: 'DataSoft',
            profile: 'Data Scientist',
            seniority: 'Junior',
            skills: ['Python', 'Machine Learning', 'SQL', 'Tableau'],
            experience: 2
        }
    ],

    // UI settings
    ui: {
        itemsPerPage: 10,
        searchDelay: 300,
        animationDuration: 200,
        toastDuration: 3000
    },

    // 🔄 Enhanced validation rules
    validation: {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        password: {
            minLength: 8,
            requireSpecialChar: true,
            requireNumber: true,
            requireUppercase: true
        },
        name: {
            minLength: 2,
            maxLength: 50
        }
    }
};
