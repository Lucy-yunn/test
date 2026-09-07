import { describe, it, expect } from "vitest";
import { evaluatePublishChecklist } from "./publish-checklist";

const pass = {
  photoCount: 2,
  hasCondition: true,
  priceEur: 120,
  hasPart: true,
  hasLeafCategory: true,
  hasDonorVehicle: true,
  partNumberCount: 1,
  noVisiblePartNumber: false,
};

describe("evaluatePublishChecklist", () => {
  it("passes when every requirement is met", () => {
    expect(evaluatePublishChecklist(pass)).toEqual({ ok: true, failures: [] });
  });

  it("accepts the 'no visible number' tick in place of a part number", () => {
    const r = evaluatePublishChecklist({ ...pass, partNumberCount: 0, noVisiblePartNumber: true });
    expect(r.ok).toBe(true);
  });

  it("fails without a photo / condition / price / donor / number", () => {
    expect(evaluatePublishChecklist({ ...pass, photoCount: 0 }).failures).toContain("At least one photo");
    expect(evaluatePublishChecklist({ ...pass, hasCondition: false }).ok).toBe(false);
    expect(evaluatePublishChecklist({ ...pass, priceEur: 0 }).ok).toBe(false);
    expect(evaluatePublishChecklist({ ...pass, hasDonorVehicle: false }).ok).toBe(false);
    expect(
      evaluatePublishChecklist({ ...pass, partNumberCount: 0, noVisiblePartNumber: false }).ok,
    ).toBe(false);
  });

  it("lists every failing item, not just the first", () => {
    const r = evaluatePublishChecklist({
      ...pass,
      photoCount: 0,
      priceEur: 0,
      hasDonorVehicle: false,
    });
    expect(r.failures.length).toBe(3);
  });
});
