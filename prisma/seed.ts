/**
 * `prisma db seed` entrypoint — runs in a plain Node process (via tsx), OUTSIDE
 * Next.js. Keep this file free of Next-only / `server-only` imports; the logic
 * lives in the node-safe `./seed/seed` module.
 *
 * Run: npm run db:seed         (development branch, reads .env.local)
 *      npm run db:seed:test    (test branch, reads .env.test.local)
 */
import { PrismaClient } from "@prisma/client";
import { seedDatabase, DEMO_PASSWORD } from "./seed/seed";

const db = new PrismaClient();

seedDatabase(db)
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
