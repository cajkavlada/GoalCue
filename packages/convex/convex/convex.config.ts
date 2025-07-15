import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const app: any = defineApp();
app.use(rateLimiter);

export default app;