const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const requests = await prisma.scholarshipRequest.findMany({
            take: 10,
            orderBy: { created_at: 'desc' },
            select: { id: true, title: true, status: true, created_at: true }
        });
        console.log("Recent Requests:");
        console.log(JSON.stringify(requests, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
