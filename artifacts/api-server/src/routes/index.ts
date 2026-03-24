import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eanRouter from "./ean";
import adminRouter from "./admin";
import storesRouter from "./stores";
import profileRouter from "./profile";
import pricesRouter from "./prices";
import merchantsRouter from "./merchants";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eanRouter);
router.use(adminRouter);
router.use(storesRouter);
router.use(profileRouter);
router.use(pricesRouter);
router.use(merchantsRouter);

export default router;
