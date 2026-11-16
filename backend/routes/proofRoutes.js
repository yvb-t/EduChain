const express = require('express');
const { upload } = require('../controllers/proofController');
const { uploadProof } = require('../controllers/scholarshipController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/upload', protect, upload.single('proof'), uploadProof);

module.exports = router;
