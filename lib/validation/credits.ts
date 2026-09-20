import * as z from "zod";

/** Admin credit forms (docs/seller-credits.md). Node-safe. The service re-checks the same rules. */

export const bundleSchema = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  credits: z.coerce.number().int("Use a whole number").min(1, "Enter at least 1 credit"),
  priceEur: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a price in EUR, like 40 or 40.50"),
  displayOrder: z.coerce.number().int("Use a whole number").default(0),
});

export const topUpSchema = z.object({
  sellerId: z.string().min(1),
  bundleId: z.string().min(1, "Choose a bundle"),
});

export const adjustSchema = z.object({
  sellerId: z.string().min(1),
  amount: z.coerce
    .number()
    .int("Use a whole number")
    .refine((n) => n !== 0, "Enter a number other than zero"),
  note: z.string().trim().min(1, "A note is required"),
});
