/**
 * Pure publish-checklist evaluation (docs/spec/admin-tool.md §6.2.4, #8).
 * `draft → published` requires ALL of these. There is NO review state / approval
 * queue — the checklist IS the gate. Node-safe.
 */
export interface PublishChecklistInput {
  photoCount: number;
  hasCondition: boolean;
  priceEur: number;
  hasPart: boolean;
  hasLeafCategory: boolean;
  hasDonorVehicle: boolean;
  partNumberCount: number;
  noVisiblePartNumber: boolean;
}

export interface PublishChecklistResult {
  ok: boolean;
  failures: string[];
}

export function evaluatePublishChecklist(
  input: PublishChecklistInput,
): PublishChecklistResult {
  const failures: string[] = [];

  if (input.photoCount < 1) failures.push("At least one photo");
  if (!input.hasCondition) failures.push("Condition set");
  if (!(input.priceEur > 0)) failures.push("Price greater than 0");
  if (!input.hasPart || !input.hasLeafCategory) {
    failures.push("A Part linked to a leaf Category");
  }
  if (!input.hasDonorVehicle) failures.push("A donor vehicle linked");
  if (input.partNumberCount < 1 && !input.noVisiblePartNumber) {
    failures.push('At least one part number, or "no visible number" ticked');
  }

  return { ok: failures.length === 0, failures };
}
