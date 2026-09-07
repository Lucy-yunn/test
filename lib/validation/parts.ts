import * as z from "zod";

/** Part / PartNumber admin form schemas (docs/spec/admin-tool.md §5). Node-safe. */

const numberType = z.enum(["oem", "aftermarket", "casting", "trade", "other"]);

export const partSchema = z.object({
  name: z.string().trim().min(1, "Enter a part name"),
  categoryId: z.string().min(1, "Choose a category"),
  notes: z.string().trim().optional(),
  attributesJson: z.string().trim().optional(), // JSON text, parsed in the action
});

export const newPartSchema = partSchema.extend({
  firstNumber: z.string().trim().optional(),
  firstNumberType: numberType.optional(),
});

export const partNumberSchema = z.object({
  raw: z.string().trim().min(1, "Enter the number"),
  numberType,
  brand: z.string().trim().optional(),
  isPrimary: z.union([z.literal("on"), z.undefined()]).optional(),
  verified: z.union([z.literal("on"), z.undefined()]).optional(),
});

export function parseAttributesJson(text: string | undefined): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new SyntaxError("Attributes must be valid JSON");
  }
}
