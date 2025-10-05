// Backend utils/file-utils.js - File system utilities
const fs = require('fs').promises;
const path = require('path');

class FileUtils {
    /**
     * Ensure directory exists, create if it doesn't
     */
    static async ensureDirectory(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    /**
     * Safely read JSON file with fallback
     */
    static async readJSONFile(filePath, fallback = null) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch {
            return fallback;
        }
    }

    /**
     * Safely write JSON file
     */
    static async writeJSONFile(filePath, data) {
        try {
            await this.ensureDirectory(path.dirname(filePath));
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('Error writing JSON file:', error);
            return false;
        }
    }

    /**
     * Get file size in bytes
     */
    static async getFileSize(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch {
            return 0;
        }
    }

    /**
     * Check if file exists
     */
    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get directory size recursively
     */
    static async getDirectorySize(dirPath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            let totalSize = 0;

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    totalSize += await this.getDirectorySize(fullPath);
                } else {
                    totalSize += await this.getFileSize(fullPath);
                }
            }

            return totalSize;
        } catch {
            return 0;
        }
    }

    /**
     * Format file size for display
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }

    /**
     * Clean filename for storage
     */
    static sanitizeFilename(filename) {
        return filename
            .replace(/[^a-zA-Z0-9.-]/g, '_')  // Replace invalid chars with underscore
            .replace(/_{2,}/g, '_')           // Replace multiple underscores with single
            .replace(/^_+|_+$/g, '');        // Remove leading/trailing underscores
    }

    /**
     * Get file extension
     */
    static getFileExtension(filename) {
        return path.extname(filename).toLowerCase().substring(1);
    }

    /**
     * Validate file type
     */
    static isValidFileType(filename, allowedTypes) {
        const extension = this.getFileExtension(filename);
        return allowedTypes.includes(extension);
    }

    /**
     * Delete file safely
     */
    static async deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }

    /**
     * Delete directory recursively
     */
    static async deleteDirectory(dirPath) {
        try {
            await fs.rmdir(dirPath, { recursive: true });
            return true;
        } catch (error) {
            console.error('Error deleting directory:', error);
            return false;
        }
    }

    /**
     * Copy file
     */
    static async copyFile(source, destination) {
        try {
            await this.ensureDirectory(path.dirname(destination));
            await fs.copyFile(source, destination);
            return true;
        } catch (error) {
            console.error('Error copying file:', error);
            return false;
        }
    }

    /**
     * Move file
     */
    static async moveFile(source, destination) {
        try {
            await this.ensureDirectory(path.dirname(destination));
            await fs.rename(source, destination);
            return true;
        } catch (error) {
            console.error('Error moving file:', error);
            return false;
        }
    }

    /**
     * List files in directory with optional filtering
     */
    static async listFiles(dirPath, options = {}) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            let files = entries
                .filter(entry => entry.isFile())
                .map(entry => ({
                    name: entry.name,
                    path: path.join(dirPath, entry.name),
                    extension: this.getFileExtension(entry.name)
                }));

            // Filter by extension if specified
            if (options.extensions) {
                files = files.filter(file => options.extensions.includes(file.extension));
            }

            // Sort if specified
            if (options.sortBy === 'name') {
                files.sort((a, b) => a.name.localeCompare(b.name));
            } else if (options.sortBy === 'extension') {
                files.sort((a, b) => a.extension.localeCompare(b.extension));
            }

            return files;
        } catch {
            return [];
        }
    }

    /**
     * Clean up old files based on age
     */
    static async cleanupOldFiles(dirPath, maxAgeMs) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const now = Date.now();
            let deletedCount = 0;

            for (const entry of entries) {
                if (entry.isFile()) {
                    const filePath = path.join(dirPath, entry.name);
                    const stats = await fs.stat(filePath);
                    const age = now - stats.mtimeMs;

                    if (age > maxAgeMs) {
                        const deleted = await this.deleteFile(filePath);
                        if (deleted) deletedCount++;
                    }
                }
            }

            return deletedCount;
        } catch (error) {
            console.error('Error cleaning up old files:', error);
            return 0;
        }
    }
}

module.exports = FileUtils;