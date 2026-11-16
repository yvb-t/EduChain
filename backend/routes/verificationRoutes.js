const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { sendParentOTP, verifyParentOTP, verifyFace, checkDuplicate } = require('../controllers/verificationController');

router.post('/parent-otp/send', protect, sendParentOTP);
router.post('/parent-otp/verify', protect, verifyParentOTP);
router.post('/face-verify', protect, verifyFace);
router.post('/check-duplicate', protect, checkDuplicate);

module.exports = router;
