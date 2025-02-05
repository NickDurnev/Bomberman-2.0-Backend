import { Router, Request, Response } from "express";
import schemaValidator from "@middlewares/validationMiddleware";
import { login } from "../controllers/auth";
import { getStats } from "../controllers/stats";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.send("Hello!");
});

router.post("/auth", schemaValidator("/auth"), login);

router.get("/stats", getStats);

export default router;
