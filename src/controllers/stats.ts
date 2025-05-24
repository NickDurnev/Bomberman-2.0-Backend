import { Request, Response } from "express";

import { get, getByName } from "@services/stats";
import { CustomError } from "@types";

export const getStats = async (req: Request, res: Response) => {
  const skip = Number(req.query.skip) || 0;
  const limit = Number(req.query.limit) || 10;
  const sort = req.query.sort ? String(req.query.sort) : "points";
  const name = req.query.name ? String(req.query.name) : "";

  try {
    if (name) {
      const { stats, total } = await getByName({ name, skip, limit });
      res.json({ status: "success", code: 200, data: { stats, total } });
      return;
    }

    const { stats, total } = await get({ skip, limit, sort });
    res.json({ status: "success", code: 200, data: { stats, total } });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const customError = error as CustomError;
      res
        .status(customError.status || 500)
        .json({ success: false, message: error.message });
    } else {
      res
        .status(500)
        .json({ success: false, message: "An unknown error occurred" });
    }
  }
};
