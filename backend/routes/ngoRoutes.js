const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const {
    createProfile,
    getNGOs,
    getNGOById,
    createCampaign,
    uploadReport,
    verifyNGO,
    getDonations,
    addStudent,
    createImpactStory,
    getImpactStories
} = require('../controllers/ngoController');

// Public Routes
router.get('/', getNGOs);
router.get('/:id', getNGOById);

// Protected Routes (NGO Only)
router.put('/profile', protect, upload.fields([{ name: 'logo' }, { name: 'banner' }]), createProfile);
router.post('/campaigns', protect, upload.single('image'), createCampaign);
router.post('/reports', protect, upload.single('document'), uploadReport);

// New Features
router.post('/verify', protect, verifyNGO);
router.get('/donations/history', protect, getDonations);
router.post('/students', protect, addStudent);
router.post('/stories', protect, upload.single('image'), createImpactStory);
router.get('/stories', protect, getImpactStories);

module.exports = router;
