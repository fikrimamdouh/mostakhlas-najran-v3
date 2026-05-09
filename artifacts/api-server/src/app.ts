import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const PRODUCTION_ORIGIN = "https://mostakhlas-najran.com";
const extraOrigins = process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim()).filter(Boolean) ?? [];

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (process.env.NODE_ENV !== "production") return callback(null, true);
    const allowed = [PRODUCTION_ORIGIN, ...extraOrigins];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    // also allow replit.app preview domains in production for admin access
    if (/\.replit\.app$/.test(origin) || /\.repl\.co$/.test(origin)) return callback(null, true);
    const err = new Error(`CORS: origin not allowed: ${origin}`) as Error & { status?: number };
    err.status = 403;
    callback(err);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;
