import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
} from "better-auth/plugins/admin/access";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { env } from "./env";

// Minimal access-control wiring the `admin` plugin needs to accept "staff" as an
// admin role. Application authorization does NOT use this — it lives in lib/dal/.
const ac = createAccessControl({ ...defaultStatements });
const roles = {
  staff: ac.newRole({ ...adminAc.statements }),
  seller: ac.newRole({}),
  buyer: ac.newRole({}),
};

/**
 * Better Auth — email + password only in v1 (ADR-0001, docs/auth-and-permissions.md).
 *
 * The `admin` plugin adds `role` / `banned` / `banReason` / `banExpires` to the user
 * model and powers staff user-management (createUser / banUser / listUsers / reset).
 * Its access-control roles are plugin wiring only — ALL application authorization
 * lives in the DAL (lib/dal/), never in Better Auth ACL.
 *
 * No transactional email in v1: no email verification, no "forgot password" flow —
 * staff reset passwords from the admin tool (docs/auth-and-permissions.md §6).
 */
export const auth = betterAuth({
  appName: "IVO",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
    autoSignIn: true,
  },

  // 7-day sliding session (Better Auth default, stated explicitly). No "remember me".
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  // Social buttons are rendered disabled in the UI — no providers configured.
  socialProviders: {},

  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "buyer",
      adminRoles: ["staff"],
    }),
    // Must be last: bridges Better Auth cookies into Next Server Actions.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
