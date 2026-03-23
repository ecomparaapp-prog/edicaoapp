import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eanRouter from "./ean";
import adminRouter from "./admin";
import storesRouter from "./stores";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eanRouter);
router.use(adminRouter);
router.use(storesRouter);
router.use(profileRouter);

export default router;
