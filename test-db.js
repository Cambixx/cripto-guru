
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing connection...');
        const result = await prisma.$queryRaw`SELECT 1`;
        console.log('Connection successful:', result);
    } catch (e) {
        console.error('Connection failed:');
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
