const express = require('express');
const { uploadKYC, getKYCStatus, verifyFace, verifyLocation, verifyQR, deleteLocation, verifyGuardian, updateBankDetails } = require('../controllers/kycController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../controllers/proofController'); // Reuse upload config

const router = express.Router();

router.post('/upload', protect, upload.single('document'), uploadKYC);
router.get('/status', protect, getKYCStatus);
router.post('/verify-face', protect, upload.single('face'), verifyFace);
router.post('/location-verify', protect, verifyLocation);
router.post('/qr-verify', protect, verifyQR);
router.post('/verify-guardian', protect, verifyGuardian);
router.post('/verify-bank', protect, updateBankDetails);
router.delete('/location-delete', protect, deleteLocation);

module.exports = router;
