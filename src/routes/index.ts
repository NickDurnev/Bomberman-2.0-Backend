import schemaValidator from "@middlewares/validationMiddleware";
import { Request, Response, Router } from "express";
import { login } from "../controllers/auth";
import { getStats } from "../controllers/stats";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.send("Hello it's update!");
});

router.post("/auth", schemaValidator("/auth"), login);

router.get("/stats", getStats);

export default router;
