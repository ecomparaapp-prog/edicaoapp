import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eanRouter from "./ean";
import adminRouter from "./admin";
import storesRouter from "./stores";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eanRouter);
router.use(adminRouter);
router.use(storesRouter);

export default router;
