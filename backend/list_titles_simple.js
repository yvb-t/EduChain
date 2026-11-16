const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const requests = await prisma.scholarshipRequest.findMany({
            select: { title: true, status: true }
        });
        console.log("Titles:", JSON.stringify(requests));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
