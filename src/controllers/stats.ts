import { get, getByName } from "@services/stats";

export const getStats = async (req: any, res: any) => {
  console.log("req.query:", req.query);

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
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};
