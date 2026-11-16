const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createUpdate = async (req, res) => {
    try {
        const { scholarshipId, title, description } = req.body;
        const userId = req.user.id; // Assuming auth middleware adds user

        // Verify ownership
        const scholarship = await prisma.scholarshipRequest.findUnique({
            where: { id: scholarshipId },
            include: { student: true }
        });

        if (!scholarship) {
            return res.status(404).json({ message: 'Scholarship request not found' });
        }

        if (scholarship.student_id !== userId) {
            return res.status(403).json({ message: 'Not authorized to post updates for this request' });
        }

        let imageUrl = null;
        if (req.file) {
            imageUrl = req.file.path;
        }

        const update = await prisma.scholarshipUpdate.create({
            data: {
                scholarship_id: scholarshipId,
                title,
                description,
                image_url: imageUrl
            }
        });

        res.status(201).json(update);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getUpdates = async (req, res) => {
    try {
        const { scholarshipId } = req.params;
        const updates = await prisma.scholarshipUpdate.findMany({
            where: { scholarship_id: scholarshipId },
            orderBy: { created_at: 'desc' }
        });
        res.json(updates);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createUpdate, getUpdates };
