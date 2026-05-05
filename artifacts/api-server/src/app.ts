import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import usersRouter from "./routes/users";
import { logger } from "./lib/logger";

const app: Express = express();

/* ---------- CORS (must be before routes) ---------- */
const corsOptions = {
  origin: "https://mostakhlas-najran-v3.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("/*", cors(corsOptions));

/* ---------- Logger ---------- */
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage & { id?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

/* ---------- Clerk Proxy ---------- */
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

/* ---------- Body Parsers ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------- Clerk Middleware ---------- */
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY
    ),
  }))
);

/* ---------- Routes ---------- */
app.use("/api/users", usersRouter);
app.use("/api", router);

export default app;
