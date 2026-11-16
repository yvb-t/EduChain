const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const student = await prisma.user.findFirst({
            where: { role: 'STUDENT' },
            include: { studentProfile: true }
        });
        console.log("Student User:");
        console.log(JSON.stringify(student, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
