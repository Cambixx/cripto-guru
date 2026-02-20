
const { Client } = require('pg');

async function test() {
    const ref = 'bjalbwoflhyepmnduwaf';
    const pass = 'lvd1hvNtiyBq95P+';
    const host = 'aws-1-eu-central-1.pooler.supabase.com';

    // Try port 6543 (Transaction) and 5432 (Session)
    const connectionStrings = [
        `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?pgbouncer=true`,
        `postgresql://postgres.${ref}:${pass}@${host}:5432/postgres`
    ];

    for (const cs of connectionStrings) {
        const client = new Client({
            connectionString: cs,
            ssl: { rejectUnauthorized: false }
        });

        try {
            console.log(`Testing: ${cs.replace(pass, '****')}`);
            await client.connect();
            console.log(`  SUCCESS!`);
            const res = await client.query('SELECT 1');
            console.log(`  Query worked.`);
        } catch (err) {
            console.error(`  FAILED: ${err.message}`);
        } finally {
            await client.end();
        }
    }
}

test();
