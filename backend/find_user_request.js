const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const requests = await prisma.scholarshipRequest.findMany({
            where: { title: { contains: 'pursuing' } },
            include: { student: true }
        });
        console.log("Requests matching 'pursuing':");
        console.log(JSON.stringify(requests, null, 2));

        const allRequests = await prisma.scholarshipRequest.findMany({
            take: 5,
            orderBy: { created_at: 'desc' }
        });
        console.log("Recent 5 requests:");
        console.log(JSON.stringify(allRequests, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
