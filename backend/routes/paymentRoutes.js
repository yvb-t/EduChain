const express = require('express');
const paymentController = require('../controllers/paymentController'); // Changed to import the whole object
const { protect: authMiddleware } = require('../middleware/authMiddleware'); // Renamed protect to authMiddleware for consistency

const router = express.Router();

router.post('/create-order', authMiddleware, paymentController.createOrder); // Updated to use authMiddleware and paymentController object
router.post('/verify-payment', authMiddleware, paymentController.verifyPayment); // Webhook or Client-side verification
router.get('/history', authMiddleware, paymentController.getHistory);
router.get('/receipt/:id', authMiddleware, paymentController.downloadReceipt); // Added route for downloading receipt
router.get('/tax-certificate/:id', authMiddleware, paymentController.downloadTaxCertificate);

// Admin Routes
router.post('/refund', authMiddleware, paymentController.processRefund);
router.get('/reconciliation-report', authMiddleware, paymentController.getReconciliationReport);
router.get('/all-transactions', authMiddleware, paymentController.getAllTransactions);
router.post('/schedule-payout', authMiddleware, paymentController.schedulePayout);

module.exports = router;
