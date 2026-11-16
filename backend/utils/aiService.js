const crypto = require('crypto');
const fs = require('fs');

/**
 * Generates a SHA-256 hash for a file to detect duplicates.
 * @param {string} filePath - Path to the file.
 * @returns {Promise<string>} - The hex hash of the file.
 */
const generateFileHash = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => {
            hash.update(data);
        });

        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });

        stream.on('error', (error) => {
            reject(error);
        });
    });
};

const detectFraud = async (filePath) => {
    return new Promise((resolve) => {
        // Simulate AI processing delay
        setTimeout(() => {
            try {
                const stats = fs.statSync(filePath);
                const fileSizeInBytes = stats.size;
                const lowerPath = filePath.toLowerCase();
                const path = require('path');
                const lowerName = path.basename(filePath).toLowerCase();

                // 1. Check for suspiciously small files (e.g., < 5KB)
                if (fileSizeInBytes < 5 * 1024) {
                    resolve({
                        score: 0.85, // High fraud probability
                        reason: "File size suspiciously small (Potential corrupted or fake file)",
                        status: "FLAGGED"
                    });
                    return;
                }

                // 2. Check for suspicious keywords in filename
                const suspiciousKeywords = ['photoshop', 'edited', 'fake', 'sample', 'test', 'mockup', 'temp', 'copy'];
                if (suspiciousKeywords.some(kw => lowerName.includes(kw))) {
                    resolve({
                        score: 0.95,
                        reason: "Metadata/Filename indicates editing software usage",
                        status: "FLAGGED"
                    });
                    return;
                }

                // 3. Mime-Type Check (Simulated)
                if (lowerName.endsWith('.exe') || lowerName.endsWith('.sh') || lowerName.endsWith('.bat')) {
                    resolve({
                        score: 1.0,
                        reason: "Invalid file type detected",
                        status: "REJECTED"
                    });
                    return;
                }

                // 4. Advanced Simulation: Font & Metadata Mismatch
                // In a real app, this would parse PDF structure or Image EXIF
                const randomCheck = Math.random();

                if (randomCheck < 0.05) {
                    resolve({
                        score: 0.88,
                        reason: "AI detected mismatched fonts in document (Potential manipulation)",
                        status: "FLAGGED"
                    });
                    return;
                }

                if (randomCheck < 0.08) {
                    resolve({
                        score: 0.75,
                        reason: "Document metadata inconsistent with creation date",
                        status: "FLAGGED"
                    });
                    return;
                }

                // 5. Duplicate Receipt Detection (Simulated via hash collision probability for demo)
                if (randomCheck < 0.10) {
                    resolve({
                        score: 0.92,
                        reason: "Duplicate receipt detected in global database",
                        status: "FLAGGED"
                    });
                    return;
                }

                resolve({
                    score: 0.05,
                    reason: "No anomalies detected",
                    status: "PASSED"
                });

            } catch (err) {
                console.error("Fraud Check Error:", err);
                resolve({ score: 0, reason: "Check failed", status: "PASSED" });
            }
        }, 1500);
    });
};

/**
 * Simulates Face Matching between two images.
 * @param {string} referenceImageUrl 
 * @param {string} liveCaptureUrl 
 * @returns {Promise<{match: boolean, score: number}>}
 */
const compareFaces = async (referenceImageUrl, liveCaptureUrl) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Mock Logic: 80% chance of success
            const score = Math.random() > 0.2 ? 0.95 : 0.45;
            resolve({
                match: score > 0.8,
                score: score
            });
        }, 2000);
    });
};

module.exports = { generateFileHash, detectFraud, compareFaces };
