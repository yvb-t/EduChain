const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const requests = await prisma.scholarshipRequest.findMany({
            orderBy: { created_at: 'desc' },
            take: 5,
            include: { student: true }
        });
        console.log("Latest 5 Scholarship Requests:");
        console.log(JSON.stringify(requests, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
