import * as z from "zod";
import { InvariantError } from "./errors";

/**
 * Per-Category `Part.attributes` schemas (docs/spec/admin-tool.md §5, research #5:
 * "the abstract type owns the attribute schema; the concrete Part owns the
 * values"). Node-safe.
 *
 * v1 ships a permissive default plus a handful of high-value categories. Adding
 * a category schema later is one entry here — no migration (attributes is JSONB).
 */

const scalar = z.union([z.string(), z.number(), z.boolean()]);

/** Default — any string→scalar map. Keeps intake unblocked for un-modelled categories. */
export const DEFAULT_ATTRIBUTE_SCHEMA = z.record(z.string(), scalar);

const REGISTRY: Record<string, z.ZodType<Record<string, unknown>>> = {
  alternator: z
    .object({
      amperage: z.coerce.number().int().positive().optional(),
      voltage: z.coerce.number().positive().optional(),
      pulleyType: z.enum(["clutch", "solid", "other"]).optional(),
    })
    .strict(),
  headlight: z
    .object({
      side: z.enum(["left", "right"]),
      technology: z.enum(["halogen", "xenon", "led", "other"]).optional(),
      withMotor: z.boolean().optional(),
    })
    .strict(),
  "engine-control-unit": z
    .object({
      engineCode: z.string().optional(),
      softwareNumber: z.string().optional(),
      immoOff: z.boolean().optional(),
    })
    .strict(),
  "alloy-wheel": z
    .object({
      diameterInch: z.coerce.number().positive().optional(),
      widthInch: z.coerce.number().positive().optional(),
      boltPattern: z.string().optional(),
      offsetEt: z.coerce.number().optional(),
    })
    .strict(),
};

export function attributeSchemaFor(
  categorySlug: string,
): z.ZodType<Record<string, unknown>> {
  return REGISTRY[categorySlug] ?? DEFAULT_ATTRIBUTE_SCHEMA;
}

/** Validate a raw attributes object for a category; throws InvariantError. */
export function validateAttributes(
  categorySlug: string,
  raw: unknown,
): Record<string, unknown> {
  const parsed = attributeSchemaFor(categorySlug).safeParse(raw ?? {});
  if (!parsed.success) {
    throw new InvariantError(
      `Invalid attributes for "${categorySlug}": ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
