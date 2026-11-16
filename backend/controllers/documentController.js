const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');

const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { type, category, metadata } = req.body;
        const userId = req.user.id;

        const document = await prisma.studentDocument.create({
            data: {
                student_id: userId,
                type,
                category,
                file_url: req.file.path,
                metadata: metadata ? metadata : null,
                status: 'PENDING'
            }
        });

        // Auto-verify specific documents for demo purposes
        // In real app, this would trigger OCR/AI verification
        if (type === 'AADHAAR' || type === 'PAN') {
            // Simulate AI verification delay
            setTimeout(async () => {
                await prisma.studentDocument.update({
                    where: { id: document.id },
                    data: { status: 'VERIFIED' }
                });

                // Update profile verification status
                if (category === 'IDENTITY') {
                    await prisma.studentProfile.update({
                        where: { user_id: userId },
                        data: { is_identity_verified: true }
                    });
                }
            }, 5000);
        }

        res.status(201).json(document);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getDocuments = async (req, res) => {
    try {
        const userId = req.user.id;
        const documents = await prisma.studentDocument.findMany({
            where: { student_id: userId },
            orderBy: { created_at: 'desc' }
        });
        res.json(documents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const document = await prisma.studentDocument.findUnique({
            where: { id }
        });

        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        if (document.student_id !== userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await prisma.studentDocument.delete({
            where: { id }
        });

        res.json({ message: 'Document deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { uploadDocument, getDocuments, deleteDocument };
