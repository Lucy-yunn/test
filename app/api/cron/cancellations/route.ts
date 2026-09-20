import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { runCancellationSweep } from "@/lib/services/cancellation-sweep";

/**
 * Daily Vercel Cron job (see vercel.json): approves every cancellation request whose 7 days
 * are up. Refuses any request that does not carry the CRON_SECRET.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await runCancellationSweep(db, {
    authorization: request.headers.get("authorization"),
    secret: env.CRON_SECRET,
  });
  if (result.status === 401) return new Response("Unauthorized", { status: 401 });
  return Response.json({ approved: result.approved });
}
