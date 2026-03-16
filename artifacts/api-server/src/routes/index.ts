import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eanRouter from "./ean";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eanRouter);

export default router;
