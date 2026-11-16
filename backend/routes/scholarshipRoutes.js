const express = require('express');
const router = express.Router();
const { createRequest, getAllRequests, getRequestById, deleteRequest, uploadProof, updateRequest, getDashboardStats, getUrgentCases } = require('../controllers/scholarshipController');
const { createUpdate, getUpdates } = require('../controllers/updateController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Dashboard Stats
router.get('/dashboard-stats', protect, getDashboardStats);
router.get('/urgent', getUrgentCases); // Public route for heat ranking

// Scholarship Routes
// Wrapper to handle upload errors
const uploadProofMiddleware = (req, res, next) => {
    upload.single('proof')(req, res, (err) => {
        if (err) {
            console.error("Upload Error:", err);
            return res.status(400).json({ message: err.message || 'File upload failed' });
        }
        next();
    });
};

router.post('/', protect, uploadProofMiddleware, createRequest);
router.get('/', getAllRequests);
router.get('/:id', getRequestById);
router.delete('/:id', protect, deleteRequest);

// Proof Upload Route
router.post('/:id/proof', protect, upload.single('file'), uploadProof);

// Update Routes
router.post('/updates', protect, upload.single('image'), createUpdate);
router.get('/:scholarshipId/updates', getUpdates);

module.exports = router;
