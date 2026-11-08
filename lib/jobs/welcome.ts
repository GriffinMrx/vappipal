import "server-only";

import { deliverWelcome } from "@/lib/welcome/deliver";
import { EVENTS, inngest } from "./client";

/** One welcome email per new account (prompt 37). Retries never double-send (claim + idempotency key). */
export const sendWelcome = inngest.createFunction(
  { id: "welcome-send", triggers: [{ event: EVENTS.welcome }], retries: 4, throttle: { limit: 2, period: "1s" } },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string };
    const res = await step.run("deliver", () => deliverWelcome(userId));
    return { status: res.status };
  },
);
