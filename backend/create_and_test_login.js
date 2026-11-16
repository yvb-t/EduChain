const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    const email = 'debug_student@educhain.com';
    const password = 'password123';
    const role = 'STUDENT';

    // 1. Cleanup existing debug user
    await prisma.studentProfile.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });

    console.log('Cleaned up existing debug user.');

    // 2. Create User
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
        data: {
            email,
            password_hash,
            role,
            is_verified: true
        }
    });

    await prisma.studentProfile.create({
        data: {
            user_id: user.id,
            full_name: "Debug Student",
            phone_number: "9999999999"
        }
    });

    console.log(`Created user: ${email} / ${password}`);

    // 3. Test Login Logic (Simulating authController.login)
    const loginUser = await prisma.user.findUnique({ where: { email } });
    if (!loginUser) throw new Error('User not found after creation');

    const isMatch = await bcrypt.compare(password, loginUser.password_hash);
    if (!isMatch) throw new Error('Password mismatch');

    const token = jwt.sign(
        { id: loginUser.id, role: loginUser.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1d' }
    );

    console.log('Login successful! Token generated.');
    console.log('Token:', token);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
