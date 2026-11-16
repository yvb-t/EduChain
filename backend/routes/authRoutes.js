const express = require('express');
const { register, login, getMe, getDonorStats } = require('../controllers/authController');

const { updateProfile, addPortfolioItem, getPortfolio, addEducationRecord, getEducationRecords, addTimelineEvent, getTimelineEvents, uploadVideoPitch } = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../controllers/proofController'); // Reuse proof upload config

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/donor/stats', protect, getDonorStats);
router.put('/profile', protect, updateProfile);
router.post('/portfolio', protect, upload.single('image'), addPortfolioItem);
router.get('/portfolio/:studentId', protect, getPortfolio);
router.post('/education', protect, upload.single('marksheet'), addEducationRecord);
router.get('/education/:studentId', protect, getEducationRecords);
router.post('/timeline', protect, addTimelineEvent);
router.get('/timeline/:studentId', protect, getTimelineEvents);
router.post('/video-pitch', protect, upload.single('video'), uploadVideoPitch);

// Document Routes
const { uploadDocument, getDocuments, deleteDocument } = require('../controllers/documentController');
router.post('/documents', protect, upload.single('file'), uploadDocument);
router.get('/documents', protect, getDocuments);
router.delete('/documents/:id', protect, deleteDocument);

// Privacy Routes
const { exportData, deleteAccount } = require('../controllers/privacyController');
router.get('/export-data', protect, exportData);
router.delete('/delete-account', protect, deleteAccount);

module.exports = router;

