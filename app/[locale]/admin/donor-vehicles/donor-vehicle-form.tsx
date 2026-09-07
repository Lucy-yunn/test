"use client";

import { useActionState } from "react";
import { Field, SubmitButton, FormMessage } from "../../_components/form";
import { createDonorVehicleAction, updateDonorVehicleAction } from "./actions";
import type { AuthFormState } from "../../register/actions";

export interface Option {
  id: string;
  label: string;
}
export interface DonorDefaults {
  id?: string;
  sellerId: string;
  generationId: string;
  label: string;
  donorYear: string;
  vin: string;
  vinDerivedNotes: string;
  mileageKm: string;
  registrationCountry: string;
  notes: string;
  engine: string;
  engineCode: string;
  fuel: string;
  transmission: string;
  bodyStyle: string;
  drivetrain: string;
}

export function DonorVehicleForm({
  defaults,
  sellers,
  generations,
}: {
  defaults: DonorDefaults;
  sellers: Option[];
  generations: Option[];
}) {
  const editing = Boolean(defaults.id);
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    editing ? updateDonorVehicleAction : createDonorVehicleAction,
    undefined,
  );

  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <Select label="Seller" name="sellerId" options={sellers} defaultValue={defaults.sellerId} error={state?.errors?.sellerId} />
      <Select label="Generation" name="generationId" options={generations} defaultValue={defaults.generationId} error={state?.errors?.generationId} />
      <Field label="Staff label" name="label" required defaultValue={defaults.label} errors={state?.errors?.label} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Donor year" name="donorYear" type="number" defaultValue={defaults.donorYear} />
        <Field label="Mileage (km)" name="mileageKm" type="number" defaultValue={defaults.mileageKm} />
        <Field label="VIN (masked to buyers)" name="vin" defaultValue={defaults.vin} />
        <Field label="Registration country" name="registrationCountry" defaultValue={defaults.registrationCountry} />
      </div>
      <Field label="VIN-derived notes (staff only)" name="vinDerivedNotes" defaultValue={defaults.vinDerivedNotes} />

      <h3 className="mt-2 font-medium">Structured detail (shown to buyers)</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Engine" name="engine" defaultValue={defaults.engine} />
        <Field label="Engine code" name="engineCode" defaultValue={defaults.engineCode} />
        <Field label="Fuel" name="fuel" defaultValue={defaults.fuel} />
        <div className="flex flex-col gap-1">
          <label htmlFor="transmission" className="text-sm font-medium">Transmission</label>
          <select id="transmission" name="transmission" defaultValue={defaults.transmission} className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">—</option>
            <option value="manual">Manual</option>
            <option value="automatic">Automatic</option>
            <option value="other">Other</option>
          </select>
        </div>
        <Field label="Body style" name="bodyStyle" defaultValue={defaults.bodyStyle} />
        <Field label="Drivetrain" name="drivetrain" defaultValue={defaults.drivetrain} />
      </div>
      <Field label="Notes" name="notes" defaultValue={defaults.notes} />

      <SubmitButton pending={pending}>{editing ? "Save" : "Create donor vehicle"}</SubmitButton>
      <FormMessage message={state?.message} />
    </form>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  options: Option[];
  defaultValue?: string;
  error?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      <select id={name} name={name} required defaultValue={defaultValue ?? ""} className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      {error ? <p className="text-sm text-red-600">{error[0]}</p> : null}
    </div>
  );
}
