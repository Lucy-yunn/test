/**
 * `prisma db seed` entrypoint — runs in a plain Node process (via tsx), OUTSIDE
 * Next.js. Keep this file free of Next-only / `server-only` imports; the logic
 * lives in the node-safe `./seed/seed` module.
 *
 * Run: npm run db:seed         (local ivo_dev, reads .env.local through scripts/with-dev-db.ts)
 *      npm run db:seed:test    (local ivo_test, reads .env.test.local through scripts/with-test-db.ts)
 *
 * The seed wipes every table first, so it only ever accepts the local database for its
 * role. `with-test-db.ts` sets NODE_ENV=test; anything else is the dev seed.
 */
import { PrismaClient } from "@prisma/client";
import { seedDatabase, DEMO_PASSWORD } from "./seed/seed";

const db = new PrismaClient();
const role = process.env.NODE_ENV === "test" ? "test" : "dev";

seedDatabase(db, { role })
  .then((counts) => {
    console.log("Seed complete:", counts);
    console.log(`\nDemo login password for every account: ${DEMO_PASSWORD}`);
    console.log("Staff:  lucy@ivo.example / ivo@ivo.example");
    console.log("Seller (login):  yard.sofia@example.com");
    console.log(
      "Buyers:  maria.buyer@example.com / georgi.buyer@example.com / elena.buyer@example.com",
    );
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
