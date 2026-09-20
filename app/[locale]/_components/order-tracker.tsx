import { orderTracker, ORDER_STATUS_LABEL } from "@/lib/order-labels";
import type { OrderStatus } from "@prisma/client";

const STEP_CLASS = {
  done: "bg-purple-700 text-white",
  current: "border-2 border-purple-700 text-purple-800 dark:text-purple-300",
  todo: "border border-zinc-300 text-zinc-500 dark:border-zinc-700",
} as const;

/** placed, confirmed, completed, with a Cancelled or Refused marker below when the order ended otherwise. */
export function OrderTracker({ status, lastReachedStatus }: { status: OrderStatus; lastReachedStatus: OrderStatus | null }) {
  const tracker = orderTracker(status, lastReachedStatus);
  return (
    <div>
      <ol className="flex items-center gap-2 text-sm">
        {tracker.steps.map((step, i) => (
          <li key={step.key} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden className="h-px w-6 bg-zinc-300 dark:bg-zinc-700" /> : null}
            <span className={`rounded-full px-3 py-1 ${STEP_CLASS[step.state]}`} aria-current={step.state === "current" ? "step" : undefined}>
              {ORDER_STATUS_LABEL[step.key]}
            </span>
          </li>
        ))}
      </ol>
      {tracker.end ? (
        <p className="mt-2 inline-block rounded bg-red-50 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
          {ORDER_STATUS_LABEL[tracker.end]}
        </p>
      ) : null}
    </div>
  );
}
