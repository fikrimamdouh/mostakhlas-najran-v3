import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import projectsRouter from "./projects";
import extractsRouter from "./extracts";
import statsRouter from "./stats";
import storageRouter from "./storage";
import auditRouter from "./audit";
import supportRouter from "./support";
import submittedExtractsRouter from "./submitted-extracts";
import adminRouter from "./admin";
import adminBackupRouter from "./admin-backup";
import hospitalStorageRouter from "./hospital-storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", authRouter);
router.use("/users", usersRouter);
router.use("/projects", projectsRouter);
router.use("/extracts", extractsRouter);
router.use("/stats", statsRouter);
router.use("/storage", storageRouter);
router.use("/audit", auditRouter);
router.use("/support", supportRouter);
router.use("/submitted-extracts", submittedExtractsRouter);
router.use("/admin", adminRouter);
router.use("/admin/backup", adminBackupRouter);
router.use("/hospital-storage", hospitalStorageRouter);

export default router;
