// backend/services/preset-parser.js
const fs = require("fs").promises;
const path = require("path");

/**
 * Preset Parser - Handles pre-parsed CV data for known CVs
 * 
 * Directory structure:
 * backend/data/presets/
 *   ├── initial/
 *   │   ├── cv-A000001-contract-manager.json
 *   │   ├── cv-A000002-project-lead.json
 *   │   └── ...
 *   └── detailed/
 *       ├── cv-A000001-contract-manager.json
 *       ├── cv-A000002-project-lead.json
 *       └── ...
 */

class PresetParser {
  constructor() {
    this.presetsPath = path.join(__dirname, "../data/presets");
    this.initialPath = path.join(this.presetsPath, "initial");
    this.detailedPath = path.join(this.presetsPath, "detailed");
  }

  /**
   * Initialize preset directories
   */
  async init() {
    try {
      await fs.mkdir(this.presetsPath, { recursive: true });
      await fs.mkdir(this.initialPath, { recursive: true });
      await fs.mkdir(this.detailedPath, { recursive: true });
      console.log('✅ Preset parser directories initialized');
    } catch (error) {
      console.error('Error initializing preset parser:', error);
    }
  }

  /**
   * Normalize filename for matching
   * Removes extensions, converts to lowercase, removes special chars
   */
  normalizeFilename(filename) {
    if (!filename) return '';
    
    return filename
      .toLowerCase()
      .replace(/\.(pdf|docx|doc|txt)$/i, '')  // Remove file extension
      .replace(/[^a-z0-9-]/g, '-')            // Replace non-alphanumeric with dash
      .replace(/-+/g, '-')                     // Collapse multiple dashes
      .replace(/^-|-$/g, '');                  // Remove leading/trailing dashes
  }

  /**
   * Find preset file for a given CV filename
   */
  async findPresetFile(filename, parsingType) {
    const normalized = this.normalizeFilename(filename);
    const presetDir = parsingType === 'initial' ? this.initialPath : this.detailedPath;

    try {
      // List all files in preset directory
      const files = await fs.readdir(presetDir);
      
      // Try exact match first
      const exactMatch = files.find(f => {
        const fileNormalized = this.normalizeFilename(f);
        return fileNormalized === normalized;
      });

      if (exactMatch) {
        return path.join(presetDir, exactMatch);
      }

      // Try partial match (if CV filename is contained in preset filename)
      const partialMatch = files.find(f => {
        const fileNormalized = this.normalizeFilename(f);
        return fileNormalized.includes(normalized) || normalized.includes(fileNormalized);
      });

      if (partialMatch) {
        console.log(`⚠️ Using partial match: ${partialMatch} for ${filename}`);
        return path.join(presetDir, partialMatch);
      }

      return null;
    } catch (error) {
      console.error(`Error finding preset file for ${filename}:`, error);
      return null;
    }
  }

  /**
   * Check if preset exists for a CV
   */
  async hasPreset(filename, parsingType) {
    const presetFile = await this.findPresetFile(filename, parsingType);
    return presetFile !== null;
  }

  /**
   * Load preset data for a CV
   */
  async loadPreset(filename, parsingType) {
    const presetFile = await this.findPresetFile(filename, parsingType);
    
    if (!presetFile) {
      return null;
    }

    try {
      const data = await fs.readFile(presetFile, 'utf8');
      const parsed = JSON.parse(data);
      
      console.log(`✅ Loaded preset ${parsingType} data for: ${filename}`);
      
      return {
        success: true,
        data: parsed,
        source: 'preset',
        presetFile: path.basename(presetFile)
      };
    } catch (error) {
      console.error(`Error loading preset file ${presetFile}:`, error);
      return null;
    }
  }

  /**
   * Save preset data for a CV
   * Helper function for manually creating presets
   */
  async savePreset(filename, parsingType, data) {
    const normalized = this.normalizeFilename(filename);
    const presetDir = parsingType === 'initial' ? this.initialPath : this.detailedPath;
    const presetFile = path.join(presetDir, `${normalized}.json`);

    try {
      await fs.writeFile(presetFile, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✅ Saved preset ${parsingType} data to: ${presetFile}`);
      return { success: true, file: presetFile };
    } catch (error) {
      console.error(`Error saving preset file ${presetFile}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all available presets
   */
  async listPresets() {
    try {
      const initialFiles = await fs.readdir(this.initialPath);
      const detailedFiles = await fs.readdir(this.detailedPath);

      return {
        initial: initialFiles.filter(f => f.endsWith('.json')),
        detailed: detailedFiles.filter(f => f.endsWith('.json'))
      };
    } catch (error) {
      console.error('Error listing presets:', error);
      return { initial: [], detailed: [] };
    }
  }

  /**
   * Delete a preset file
   */
  async deletePreset(filename, parsingType) {
    const presetFile = await this.findPresetFile(filename, parsingType);
    
    if (!presetFile) {
      return { success: false, error: 'Preset not found' };
    }

    try {
      await fs.unlink(presetFile);
      console.log(`✅ Deleted preset file: ${presetFile}`);
      return { success: true };
    } catch (error) {
      console.error(`Error deleting preset file ${presetFile}:`, error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new PresetParser();