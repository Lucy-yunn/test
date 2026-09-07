import * as z from "zod";

/**
 * Shared client/server form schemas (ADR-0001 — Zod). Node-safe.
 * Field rules: docs/auth-and-permissions.md §3.1 / §3.3.
 */

const password = z.string().min(8, "Password must be at least 8 characters");

export const registerSchema = z.object({
  email: z.email("Enter a valid email address").trim(),
  password,
  name: z.string().trim().min(1, "Enter your name"),
  terms: z.literal("on", {
    error: "You must accept the Terms & Privacy Policy",
  }),
  redirectTo: z.string().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim(),
  password: z.string().min(1, "Enter your password"),
  redirectTo: z.string().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const addressSchema = z.object({
  recipientName: z.string().trim().min(1, "Enter a recipient name"),
  phone: z.string().trim().min(1, "Enter a phone number"),
  addressLine1: z.string().trim().min(1, "Enter the street address"),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, "Enter a city"),
  postcode: z.string().trim().min(1, "Enter a postcode"),
  country: z.string().trim().min(2).default("BG"),
});

export const profileNameSchema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
});
