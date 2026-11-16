const express = require('express');
const { sendMessage, getSessions, getMessages, createSession } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/send', protect, sendMessage);
router.get('/sessions', protect, getSessions);
router.get('/messages/:sessionId', protect, getMessages);
router.post('/create', protect, createSession);

module.exports = router;
