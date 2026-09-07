/**
 * `npm run db:seed:staff` entrypoint — runs in plain Node (via tsx), outside
 * Next.js. Idempotent. Reads STAFF_<n>_EMAIL / _NAME / _PASSWORD from the
 * environment (see .env.example).
 */
import { PrismaClient } from "@prisma/client";
import { parseStaffFromEnv, seedStaff } from "./seed/staff";

const db = new PrismaClient();

const staff = parseStaffFromEnv(process.env);
if (staff.length === 0) {
  console.error(
    "No STAFF_1_EMAIL / STAFF_1_NAME / STAFF_1_PASSWORD in the environment. Nothing to do.",
  );
  process.exit(1);
}

seedStaff(db, staff)
  .then((results) => {
    for (const r of results) {
      console.log(`${r.created ? "created" : "updated"}  ${r.email}`);
    }
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
