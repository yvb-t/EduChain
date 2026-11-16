const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

const register = async (req, res) => {
    try {
        const { email, password, role, firstName, lastName, phone_number, address, bio, country } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Check duplicate phone for students
        if (role === 'STUDENT' && phone_number) {
            const existingProfile = await prisma.studentProfile.findFirst({ where: { phone_number } });
            if (existingProfile) {
                return res.status(400).json({ message: 'Phone number already registered with another account' });
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create User and Profile transaction
        const result = await prisma.$transaction(async (prisma) => {
            const user = await prisma.user.create({
                data: {
                    email,
                    password_hash,
                    role,
                    country,
                },
            });

            const fullName = `${firstName} ${lastName}`;

            if (role === 'STUDENT') {
                await prisma.studentProfile.create({
                    data: {
                        user_id: user.id,
                        full_name: fullName,
                        phone_number,
                        address,
                        bio,
                    },
                });
            } else if (role === 'DONOR') {
                await prisma.donorProfile.create({
                    data: {
                        user_id: user.id,
                        full_name: fullName,
                        phone_number,
                        address,
                        bio,
                    },
                });
            }

            return user;
        });

        // Generate Token
        const token = jwt.sign(
            { id: result.id, role: result.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Log Login History
        await prisma.loginHistory.create({
            data: {
                user_id: result.id,
                ip_address: req.ip || '0.0.0.0',
                device_id: req.headers['user-agent'] || 'unknown',
                city: 'Unknown'
            }
        });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: result.id,
                email: result.email,
                role: result.role,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Log Login History
        await prisma.loginHistory.create({
            data: {
                user_id: user.id,
                ip_address: req.ip || '0.0.0.0',
                device_id: req.headers['user-agent'] || 'unknown',
                city: 'Unknown'
            }
        });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                studentProfile: true,
                donorProfile: true,
                // collegeAdmin: true // Assuming relation exists in schema, wait, schema has CollegeAdmin but not relation in User model explicitly defined in previous view?
                // Let's check schema again. Schema said: model CollegeAdmin { user_id String @unique ... }
                // But User model: model User { ... studentProfile StudentProfile? donorProfile DonorProfile? }
                // User model didn't have collegeAdmin relation in the view I saw earlier.
            },
        });

        // Fetch college admin profile manually if not in relation
        let collegeProfile = null;
        if (user.role === 'COLLEGE_ADMIN') {
            collegeProfile = await prisma.collegeAdmin.findUnique({ where: { user_id: user.id } });
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            id: user.id,
            email: user.email,
            role: user.role,
            profile: user.role === 'STUDENT' ? user.studentProfile :
                user.role === 'DONOR' ? user.donorProfile :
                    user.role === 'COLLEGE_ADMIN' ? collegeProfile : null,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getDonorStats = async (req, res) => {
    try {
        const donorId = req.user.id;

        const donations = await prisma.donation.findMany({
            where: { donor_id: donorId },
            include: { scholarship: true }
        });

        const totalDonated = donations.reduce((sum, d) => sum + parseFloat(d.amount), 0);
        const uniqueStudents = new Set(donations.map(d => d.scholarship.student_id)).size;

        res.json({
            totalDonated,
            studentsHelped: uniqueStudents,
            donationCount: donations.length,
            donations
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { register, login, getMe, getDonorStats };
