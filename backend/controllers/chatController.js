const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock AI Content Filter
const isContentSafe = (text) => {
    const toxicWords = ['hate', 'stupid', 'scam', 'fake', 'idiot'];
    const lowerText = text.toLowerCase();
    return !toxicWords.some(word => lowerText.includes(word));
};

const sendMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const { sessionId, content } = req.body;

        if (!content) return res.status(400).json({ message: "Content is required" });

        // 1. AI Safety Check
        const safe = isContentSafe(content);

        // 2. Save Message
        const message = await prisma.chatMessage.create({
            data: {
                session_id: sessionId,
                sender_id: senderId,
                content: safe ? content : "[Message hidden due to policy violation]",
                is_filtered: !safe
            }
        });

        if (!safe) {
            return res.status(400).json({ message: "Message blocked by AI Safety Filter", data: message });
        }

        res.status(201).json(message);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getSessions = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        const whereClause = role === 'DONOR' ? { donor_id: userId } : { student_id: userId };

        const sessions = await prisma.chatSession.findMany({
            where: whereClause,
            include: {
                student: { select: { full_name: true, photo_url: true } },
                donor: { select: { full_name: true } },
                scholarship: { select: { title: true } },
                messages: {
                    orderBy: { created_at: 'desc' },
                    take: 1
                }
            },
            orderBy: { created_at: 'desc' }
        });

        res.json(sessions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getMessages = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const messages = await prisma.chatMessage.findMany({
            where: { session_id: sessionId },
            orderBy: { created_at: 'asc' }
        });

        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const createSession = async (req, res) => {
    try {
        const donorId = req.user.id; // Assuming donor initiates
        const { studentId, scholarshipId } = req.body;

        // Check if session exists
        let session = await prisma.chatSession.findFirst({
            where: {
                donor_id: donorId,
                student_id: studentId,
                scholarship_id: scholarshipId
            }
        });

        if (!session) {
            session = await prisma.chatSession.create({
                data: {
                    donor_id: donorId,
                    student_id: studentId,
                    scholarship_id: scholarshipId
                }
            });
        }

        res.json(session);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { sendMessage, getSessions, getMessages, createSession };
