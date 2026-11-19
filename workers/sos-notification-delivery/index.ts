import { dispatchDueSosReminders } from "../../functions/lib/alerts/sos-service.ts";
import { createSosWebPushSender, type WebPushEnvironment } from "../../functions/lib/notifications/web-push-delivery.ts";

interface Env extends WebPushEnvironment {
  DB: D1Database;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext): Promise<void> {
    context.waitUntil((async () => {
      const result = await dispatchDueSosReminders(
        env.DB,
        crypto,
        createSosWebPushSender(env.DB, env),
        { batchSize: 25, leaseMilliseconds: 90_000 },
      );
      if (!result.ok) throw new Error("sac_sos_notification_dispatch_failed");
    })());
  },
};
