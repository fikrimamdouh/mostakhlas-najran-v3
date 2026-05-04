import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import projectsRouter from "./projects";
import extractsRouter from "./extracts";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", authRouter);
router.use("/users", usersRouter);
router.use("/projects", projectsRouter);
router.use("/extracts", extractsRouter);
router.use("/stats", statsRouter);

export default router;
