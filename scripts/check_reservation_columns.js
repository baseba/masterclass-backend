require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    const cols = await p.$queryRawUnsafe(
      "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name ILIKE 'reservation' ORDER BY column_name"
    );
    console.log(JSON.stringify(cols, null, 2));
  } catch (e) {
    console.error('ERR', e);
  } finally {
    await p.$disconnect();
  }
})();
