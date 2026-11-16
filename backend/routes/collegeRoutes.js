const express = require('express');
const router = express.Router();
const { registerCollegeAdmin, getPendingVerifications, verifyRequest } = require('../controllers/collegeController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', protect, registerCollegeAdmin);
router.get('/verifications', protect, getPendingVerifications);
router.post('/verify/:requestId', protect, verifyRequest);

module.exports = router;
