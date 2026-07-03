import { prisma } from '../lib/prisma';

// AppConfig is a singleton row. This helper fetches it (throwing if the DB
// hasn't been seeded yet) rather than every caller re-deriving the query.
export async function getAppConfig() {
  const cfg = await prisma.appConfig.findFirst();
  if (!cfg) {
    throw new Error('AppConfig is missing — run the seed script (npm run db:seed).');
  }
  return cfg;
}
