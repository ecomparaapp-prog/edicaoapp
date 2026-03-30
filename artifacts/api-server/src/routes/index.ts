import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eanRouter from "./ean";
import adminRouter from "./admin";
import storesRouter from "./stores";
import profileRouter from "./profile";
import pricesRouter from "./prices";
import merchantsRouter from "./merchants";
import missionsRouter from "./missions";
import nfceRouter from "./nfce";
import referralsRouter from "./referrals";
import pointsRouter from "./points";
import prizesRouter from "./prizes";
import advertisersRouter from "./advertisers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eanRouter);
router.use(adminRouter);
router.use(storesRouter);
router.use(profileRouter);
router.use(pricesRouter);
router.use(merchantsRouter);
router.use(missionsRouter);
router.use(nfceRouter);
router.use(referralsRouter);
router.use(pointsRouter);
router.use(prizesRouter);
router.use(advertisersRouter);

export default router;
