import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transfersRouter from "./transfers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transfersRouter);

export default router;
