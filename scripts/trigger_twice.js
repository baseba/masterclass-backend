// Trigger the /cron/daily-job twice and print DB state for TEST_RECEIVE_EMAIL
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const prisma = new PrismaClient();

async function postCron() {
  const CRON_KEY = process.env.CRON_KEY;
  const PORT = process.env.PORT || '3000';
  if (!CRON_KEY) throw new Error('CRON_KEY not set in .env');

  const url = `http://localhost:${PORT}/cron/daily-job?key=${CRON_KEY}`;
  const u = new URL(url);
  const lib = u.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c.toString()));
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      }
    );

    req.on('error', (err) => resolve({ error: String(err) }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'timeout' });
    });
    req.end();
  });
}

async function checkDb() {
  const TEST_EMAIL = process.env.TEST_RECEIVE_EMAIL;
  if (!TEST_EMAIL) throw new Error('TEST_RECEIVE_EMAIL not set in .env');

  const student = await prisma.student.findUnique({
    where: { email: TEST_EMAIL },
    include: { reservations: true },
  });
  return student;
}

(async function main() {
  try {
    console.log('Calling cron endpoint 1/2...');
    const r1 = await postCron();
    console.log(
      'Result #1:',
      r1.error ? r1.error : `status=${r1.statusCode}`,
      r1.body ? `body=${r1.body.slice(0, 200)}` : ''
    );

    // small wait
    await new Promise((r) => setTimeout(r, 1000));

    console.log('Calling cron endpoint 2/2...');
    const r2 = await postCron();
    console.log(
      'Result #2:',
      r2.error ? r2.error : `status=${r2.statusCode}`,
      r2.body ? `body=${r2.body.slice(0, 200)}` : ''
    );

    console.log('\nQuerying DB for test student and reservations...');
    const student = await checkDb();
    console.log(JSON.stringify(student, null, 2));

    console.log('\nDone.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
})();
