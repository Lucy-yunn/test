import { setDeliveryCityAction } from "./delivery-actions";

/**
 * "Delivery to Bulgaria, <city>" — click to type a different city. It only
 * pre-fills the city at the reserve step and never affects search or sorting
 * (docs/buyer-funnel-search.md §6). A detected city is shown as a suggestion.
 */
export function DeliveryTo({
  label,
  city,
  suggested,
}: {
  label: string;
  city: string | null;
  suggested: boolean;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none underline-offset-2 hover:underline">
        {label}
        {suggested ? <span className="ml-1 text-xs opacity-70">(suggested)</span> : null}
      </summary>
      <form
        action={setDeliveryCityAction}
        className="absolute right-0 z-10 mt-2 flex w-64 flex-col gap-2 rounded border border-zinc-200 bg-white p-3 text-zinc-900 shadow dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <label htmlFor="delivery-city" className="text-xs font-medium">
          Your city
        </label>
        <input
          id="delivery-city"
          name="city"
          defaultValue={suggested ? "" : (city ?? "")}
          placeholder={city ?? "e.g. Plovdiv"}
          maxLength={80}
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button type="submit" className="rounded bg-purple-700 px-3 py-1 text-sm text-white">
          Save
        </button>
        <p className="text-xs text-zinc-500">
          Used to pre-fill your delivery address. It does not change the parts you see.
        </p>
      </form>
    </details>
  );
}
