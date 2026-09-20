/** A rating as stars, with the number for screen readers. */
export function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5`} role="img" className="tracking-wide text-amber-500">
      {"★".repeat(rating)}
      <span className="text-zinc-300 dark:text-zinc-600">{"★".repeat(5 - rating)}</span>
    </span>
  );
}
