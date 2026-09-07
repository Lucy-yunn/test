"use client";

import { useActionState } from "react";
import { Link } from "@/i18n/navigation";
import { Field, SubmitButton, FormMessage } from "../../_components/form";
import { createListingAction, updateListingAction } from "./actions";
import type { AuthFormState } from "../../register/actions";

export interface PartOption {
  id: string;
  label: string;
}

export interface ListingDefaults {
  id?: string;
  donorVehicleId?: string;
  partId: string;
  priceEur: string;
  condition: string;
  conditionNotes: string;
  removalNotes: string;
  negotiable: boolean;
  noVisiblePartNumber: boolean;
  sellerSku: string;
  warehouseLocation: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightKg: string;
  packageSizeNotes: string;
}

export function ListingForm({
  defaults,
  parts,
}: {
  defaults: ListingDefaults;
  parts: PartOption[];
}) {
  const editing = Boolean(defaults.id);
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    editing ? updateListingAction : createListingAction,
    undefined,
  );

  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      {defaults.id ? <input type="hidden" name="listingId" value={defaults.id} /> : null}
      {defaults.donorVehicleId ? (
        <input type="hidden" name="donorVehicleId" value={defaults.donorVehicleId} />
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="partId" className="text-sm font-medium">Part</label>
        <select id="partId" name="partId" required defaultValue={defaults.partId} className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Choose…</option>
          {parts.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {state?.errors?.partId ? <p className="text-sm text-red-600">{state.errors.partId[0]}</p> : null}
        <Link href="/admin/parts/new" className="text-xs underline">Create a new part →</Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (EUR)" name="priceEur" required defaultValue={defaults.priceEur} errors={state?.errors?.priceEur} />
        <div className="flex flex-col gap-1">
          <label htmlFor="condition" className="text-sm font-medium">Condition</label>
          <select id="condition" name="condition" required defaultValue={defaults.condition} className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
            <option value="new">New</option>
            <option value="used_good">Used — good</option>
            <option value="needs_repair">Needs repair</option>
          </select>
        </div>
      </div>

      <Field label="Condition notes (seller's words)" name="conditionNotes" defaultValue={defaults.conditionNotes} />
      <Field label="Removal notes" name="removalNotes" defaultValue={defaults.removalNotes} />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="negotiable" defaultChecked={defaults.negotiable} /> Negotiable
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="noVisiblePartNumber" defaultChecked={defaults.noVisiblePartNumber} />
        Part has no visible number (publish-checklist tick)
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Seller SKU" name="sellerSku" defaultValue={defaults.sellerSku} />
        <Field label="Warehouse location" name="warehouseLocation" defaultValue={defaults.warehouseLocation} />
        <Field label="Length (cm)" name="lengthCm" defaultValue={defaults.lengthCm} />
        <Field label="Width (cm)" name="widthCm" defaultValue={defaults.widthCm} />
        <Field label="Height (cm)" name="heightCm" defaultValue={defaults.heightCm} />
        <Field label="Weight (kg)" name="weightKg" defaultValue={defaults.weightKg} />
      </div>
      <Field label="Package size notes" name="packageSizeNotes" defaultValue={defaults.packageSizeNotes} />

      <SubmitButton pending={pending}>{editing ? "Save" : "Create listing"}</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}
