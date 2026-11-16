const express = require('express');
const { getDonations, createDonation } = require('../controllers/donationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/my-history', protect, getDonations);
router.get('/', protect, getDonations);
router.post('/', protect, createDonation);

module.exports = router;
