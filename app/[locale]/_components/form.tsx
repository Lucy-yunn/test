"use client";

/** Minimal shared form primitives — step 12 handles real styling. */

export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  errors,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  errors?: string[];
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {errors?.length ? (
        <p className="text-sm text-red-600">{errors[0]}</p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "…" : children}
    </button>
  );
}

export function FormMessage({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>;
}
