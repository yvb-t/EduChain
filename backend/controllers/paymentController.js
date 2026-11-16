const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Mock Gateway Service
const mockGateway = {
    createOrder: async (amount, currency) => {
        return {
            id: `order_${crypto.randomBytes(8).toString('hex')}`,
            amount,
            currency,
            status: 'created'
        };
    },
    verifySignature: (orderId, paymentId, signature) => {
        // Mock verification: always true for demo
        return true;
    }
};

const createOrder = async (req, res) => {
    try {
        const donorId = req.user.id;
        const { amount, currency = 'INR', scholarshipId, campaignId, isRecurring, frequency, coverFees, isAnonymous, message } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        // Check Scholarship Status and Remaining Amount
        if (scholarshipId) {
            const scholarship = await prisma.scholarshipRequest.findUnique({
                where: { id: scholarshipId }
            });

            if (!scholarship) {
                return res.status(404).json({ message: 'Scholarship not found' });
            }

            if (scholarship.status === 'FUNDED' || scholarship.status === 'COMPLETED') {
                return res.status(400).json({ message: 'This scholarship is already fully funded.' });
            }

            const remaining = Number(scholarship.amount_requested) - Number(scholarship.amount_raised);
            if (amount > remaining) {
                return res.status(400).json({
                    message: `Donation amount exceeds remaining goal. You can donate up to ₹${remaining}.`
                });
            }
        }

        // Velocity Check (Mock: Max 5 txns per hour)
        const recentTxns = await prisma.transaction.count({
            where: {
                donor_id: donorId,
                created_at: { gt: new Date(Date.now() - 60 * 60 * 1000) }
            }
        });

        if (recentTxns > 5) {
            return res.status(429).json({ message: 'Transaction limit exceeded. Please try again later.' });
        }

        // Calculate Fees
        let feePlatform = 0;
        let feeGateway = 0;
        let finalAmount = parseFloat(amount);

        if (coverFees) {
            // Example: 2% Platform, 2% Gateway
            feePlatform = finalAmount * 0.02;
            feeGateway = finalAmount * 0.02;
            finalAmount += (feePlatform + feeGateway);
        } else {
            // Deduct from donation (internal accounting, not charged extra)
            // For simplicity in this demo, we just record what the fees WOULD be
            feePlatform = finalAmount * 0.02;
            feeGateway = finalAmount * 0.02;
        }

        // Create Gateway Order
        const gatewayOrder = await mockGateway.createOrder(finalAmount, currency);

        // Create Transaction Record
        const transaction = await prisma.transaction.create({
            data: {
                amount: finalAmount,
                currency,
                status: 'PENDING',
                payment_gateway_ref: gatewayOrder.id,
                donor_id: donorId,
                scholarship_id: scholarshipId || null,
                campaign_id: campaignId || null,
                is_recurring: isRecurring || false,
                recurring_frequency: frequency,
                fee_platform: feePlatform,
                fee_gateway: feeGateway,
                fees_covered_by_donor: coverFees || false,
                is_anonymous: isAnonymous || false,
                donor_message: message,
                metadata: JSON.stringify({
                    ip: req.ip,
                    device: req.headers['user-agent']
                })
            }
        });

        res.json({
            order_id: gatewayOrder.id,
            transaction_id: transaction.id,
            amount: finalAmount,
            currency
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error creating order', error: error.message, stack: error.stack });
    }
};

// Helper to generate PDF Receipt
const generateReceipt = async (transactionId) => {
    return new Promise(async (resolve, reject) => {
        try {
            const transaction = await prisma.transaction.findUnique({
                where: { id: transactionId },
                include: {
                    donor: true,
                    scholarship: {
                        include: { student: true }
                    }
                }
            });

            if (!transaction) return resolve(null);

            const receiptsDir = path.join(__dirname, '../public/receipts');
            if (!fs.existsSync(receiptsDir)) {
                fs.mkdirSync(receiptsDir, { recursive: true });
            }

            const fileName = `receipt_${transaction.id}.pdf`;
            const filePath = path.join(receiptsDir, fileName);
            const doc = new PDFDocument();

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Header
            doc.fontSize(20).text('EduChain Donation Receipt', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Receipt ID: ${transaction.id}`);
            doc.text(`Date: ${new Date().toLocaleDateString()}`);
            doc.moveDown();

            // Donor Details
            doc.fontSize(14).text('Donor Details');
            doc.fontSize(12).text(`Name: ${transaction.donor.full_name || 'Anonymous'}`);
            doc.text(`Email: ${transaction.donor.email || 'N/A'}`);
            doc.moveDown();

            // Donation Details
            doc.fontSize(14).text('Donation Details');
            doc.fontSize(12).text(`Amount: ${transaction.currency} ${transaction.amount}`);
            doc.text(`Scholarship: ${transaction.scholarship?.title || 'General Donation'}`);
            doc.text(`Student Beneficiary: ${transaction.scholarship?.student?.full_name || 'N/A'}`);
            doc.moveDown();

            // Footer
            doc.fontSize(10).text('Thank you for your support!', { align: 'center' });
            doc.text('This receipt is electronically generated.', { align: 'center' });

            doc.end();

            stream.on('finish', async () => {
                // Update Transaction with Receipt URL
                await prisma.transaction.update({
                    where: { id: transactionId },
                    data: { receipt_url: `/receipts/${fileName}` }
                });
                resolve(`/receipts/${fileName}`);
            });

            stream.on('error', (err) => {
                console.error("Stream error:", err);
                reject(err);
            });

        } catch (error) {
            console.error("Error generating receipt:", error);
            resolve(null);
        }
    });
};

const verifyPayment = async (req, res) => {
    try {
        const { transaction_id, payment_id, signature } = req.body;

        const transaction = await prisma.transaction.findUnique({ where: { id: transaction_id } });
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        // Verify Signature
        const isValid = mockGateway.verifySignature(transaction.payment_gateway_ref, payment_id, signature);
        if (!isValid) {
            await prisma.transaction.update({
                where: { id: transaction_id },
                data: { status: 'FAILED' }
            });
            return res.status(400).json({ message: 'Invalid payment signature' });
        }

        // Update Transaction
        await prisma.transaction.update({
            where: { id: transaction_id },
            data: { status: 'SUCCESS' }
        });

        // Update Scholarship Amount Raised
        if (transaction.scholarship_id) {
            const updatedScholarship = await prisma.scholarshipRequest.update({
                where: { id: transaction.scholarship_id },
                data: { amount_raised: { increment: transaction.amount } }
            });

            // Check if fully funded
            if (Number(updatedScholarship.amount_raised) >= Number(updatedScholarship.amount_requested)) {
                await prisma.scholarshipRequest.update({
                    where: { id: transaction.scholarship_id },
                    data: { status: 'FUNDED' }
                });
            }
        }

        // Update Campaign Amount Raised
        if (transaction.campaign_id) {
            await prisma.campaign.update({
                where: { id: transaction.campaign_id },
                data: { raised_amount: { increment: transaction.amount } }
            });

            // Also update NGO total impact
            const campaign = await prisma.campaign.findUnique({
                where: { id: transaction.campaign_id },
                select: { ngo_id: true }
            });

            if (campaign) {
                await prisma.nGOProfile.update({
                    where: { user_id: campaign.ngo_id },
                    data: { impact_funds_raised: { increment: transaction.amount } }
                });
            }
        }

        // Update Donor Stats
        await prisma.donorProfile.update({
            where: { user_id: transaction.donor_id },
            data: {
                total_donated: { increment: transaction.amount },
                last_donation_date: new Date()
            }
        });

        // Trigger Receipt Generation (Async)
        generateReceipt(transaction.id);

        res.json({ message: 'Payment verified successfully', status: 'SUCCESS' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error verifying payment' });
    }
};

const getHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const transactions = await prisma.transaction.findMany({
            where: { donor_id: userId },
            orderBy: { created_at: 'desc' },
            include: { scholarship: true }
        });
        res.json(transactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching history' });
    }
};

const downloadReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Download request for receipt: ${id}`);
        const transaction = await prisma.transaction.findUnique({ where: { id } });

        if (!transaction) {
            console.log("Transaction not found");
            return res.status(404).json({ message: 'Transaction not found' });
        }

        let filePath;
        if (transaction.receipt_url) {
            filePath = path.join(__dirname, '../public', transaction.receipt_url);
            console.log(`Resolved filePath from DB url: ${filePath}`);
        }

        // If file doesn't exist or URL is missing, generate it now
        if (!filePath || !fs.existsSync(filePath)) {
            console.log(`Receipt missing for ${id}, generating now...`);
            const url = await generateReceipt(id);
            if (url) {
                filePath = path.join(__dirname, '../public', url);
                console.log(`Generated new filePath: ${filePath}`);
            } else {
                console.log("Failed to generate receipt");
            }
        }

        if (filePath && fs.existsSync(filePath)) {
            console.log(`Serving file: ${filePath}`);
            res.setHeader('Content-Disposition', `attachment; filename="receipt_${id}.pdf"`);
            res.sendFile(filePath, (err) => {
                if (err) {
                    console.error("Error sending file:", err);
                    if (!res.headersSent) {
                        res.status(500).json({ message: 'Error downloading file' });
                    }
                }
            });
        } else {
            console.log("File still missing after generation attempt");
            res.status(404).json({ message: 'Receipt file missing and generation failed' });
        }
    } catch (error) {
        console.error("Exception in downloadReceipt:", error);
        res.status(500).json({ message: 'Server error downloading receipt' });
    }
};

// Helper to generate Tax Certificate
const generateTaxCertificate = async (transactionId) => {
    try {
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { donor: true }
        });

        if (!transaction) return null;

        const certsDir = path.join(__dirname, '../public/tax_certs');
        if (!fs.existsSync(certsDir)) {
            fs.mkdirSync(certsDir, { recursive: true });
        }

        const fileName = `tax_cert_${transaction.id}.pdf`;
        const filePath = path.join(certsDir, fileName);
        const doc = new PDFDocument();

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('TAX DEDUCTION CERTIFICATE', { align: 'center' });
        doc.fontSize(14).text('(Under Section 80G of Income Tax Act)', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Certificate No: 80G/${transaction.id}`);
        doc.text(`Date: ${new Date().toLocaleDateString()}`);
        doc.moveDown();

        // Content
        doc.text(`This is to certify that Mr./Ms./M/s ${transaction.donor.full_name || 'Donor'} has made a donation of ${transaction.currency} ${transaction.amount} to EduChain Foundation.`);
        doc.moveDown();
        doc.text(`The donation is eligible for tax deduction under Section 80G of the Income Tax Act, 1961.`);
        doc.moveDown();
        doc.text(`PAN of Donor: ${transaction.donor.pan_number || 'NOT PROVIDED'}`);
        doc.text(`Transaction Ref: ${transaction.payment_gateway_ref}`);
        doc.moveDown();

        // Footer
        doc.fontSize(10).text('Authorized Signatory', { align: 'right' });
        doc.text('EduChain Foundation', { align: 'right' });

        doc.end();

        // Update Transaction
        await prisma.transaction.update({
            where: { id: transactionId },
            data: { tax_cert_url: `/tax_certs/${fileName}` }
        });

        return `/tax_certs/${fileName}`;

    } catch (error) {
        console.error("Error generating tax cert:", error);
        return null;
    }
};

const downloadTaxCertificate = async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await prisma.transaction.findUnique({ where: { id } });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        let filePath;
        if (transaction.tax_cert_url) {
            filePath = path.join(__dirname, '../public', transaction.tax_cert_url);
        } else {
            // Generate on the fly if missing
            const url = await generateTaxCertificate(id);
            if (url) filePath = path.join(__dirname, '../public', url);
        }

        if (filePath && fs.existsSync(filePath)) {
            res.download(filePath);
        } else {
            res.status(404).json({ message: 'Certificate file missing' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error downloading tax certificate' });
    }
};

// Admin: Process Refund
const processRefund = async (req, res) => {
    try {
        const { transactionId, amount, reason } = req.body;
        const adminId = req.user.id; // Assuming admin middleware populates this

        const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

        if (transaction.status !== 'SUCCESS') {
            return res.status(400).json({ message: 'Cannot refund a non-successful transaction' });
        }

        const refundAmount = parseFloat(amount) || transaction.amount;
        if (refundAmount > transaction.amount) {
            return res.status(400).json({ message: 'Refund amount cannot exceed transaction amount' });
        }

        // Create Refund Log
        await prisma.refundLog.create({
            data: {
                transaction_id: transactionId,
                amount: refundAmount,
                reason,
                processed_by: adminId,
                status: 'COMPLETED' // Mock success
            }
        });

        // Update Transaction Status if full refund
        if (refundAmount === transaction.amount) {
            await prisma.transaction.update({
                where: { id: transactionId },
                data: { status: 'REFUNDED' }
            });
        } else {
            // Partial refund logic could be more complex, for now just log it
            await prisma.transaction.update({
                where: { id: transactionId },
                data: { status: 'PARTIALLY_REFUNDED' }
            });
        }

        // Revert Scholarship Amount
        if (transaction.scholarship_id) {
            await prisma.scholarshipRequest.update({
                where: { id: transaction.scholarship_id },
                data: { amount_raised: { decrement: refundAmount } }
            });
        }

        // Revert Donor Stats
        await prisma.donorProfile.update({
            where: { user_id: transaction.donor_id },
            data: { total_donated: { decrement: refundAmount } }
        });

        res.json({ message: 'Refund processed successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error processing refund' });
    }
};

// Admin: Reconciliation Report (CSV)
const getReconciliationReport = async (req, res) => {
    try {
        const transactions = await prisma.transaction.findMany({
            include: { donor: true, scholarship: true },
            orderBy: { created_at: 'desc' }
        });

        const csvHeader = 'Transaction ID,Date,Donor Name,Donor Email,Amount,Currency,Status,Scholarship,Gateway Ref,Platform Fee,Gateway Fee\n';
        const csvRows = transactions.map(t => {
            return `${t.id},${t.created_at.toISOString()},"${t.donor.full_name}","${t.donor.email}",${t.amount},${t.currency},${t.status},"${t.scholarship?.title || 'N/A'}",${t.payment_gateway_ref},${t.fee_platform},${t.fee_gateway}`;
        }).join('\n');

        const csvContent = csvHeader + csvRows;

        res.header('Content-Type', 'text/csv');
        res.attachment('reconciliation_report.csv');
        res.send(csvContent);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error generating report' });
    }
};

// Admin: Schedule Payout (Mock)
const schedulePayout = async (req, res) => {
    try {
        const { scholarshipId, amount, scheduledDate } = req.body;

        // In a real app, this would create a Payout record and schedule a job
        // For now, we just create the record
        const payout = await prisma.payout.create({
            data: {
                scholarship_id: scholarshipId,
                amount: parseFloat(amount),
                status: 'SCHEDULED',
                scheduled_date: new Date(scheduledDate),
                student_id: (await prisma.scholarshipRequest.findUnique({ where: { id: scholarshipId }, select: { student_id: true } })).student_id
            }
        });

        res.json({ message: 'Payout scheduled successfully', payout });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error scheduling payout' });
    }
};

// Admin: Get All Transactions
const getAllTransactions = async (req, res) => {
    try {
        const transactions = await prisma.transaction.findMany({
            include: {
                donor: {
                    select: { full_name: true, email: true }
                },
                scholarship: {
                    select: { title: true }
                }
            },
            orderBy: { created_at: 'desc' }
        });
        res.json(transactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching transactions' });
    }
};

module.exports = { createOrder, verifyPayment, getHistory, downloadReceipt, downloadTaxCertificate, processRefund, getReconciliationReport, schedulePayout, getAllTransactions };

