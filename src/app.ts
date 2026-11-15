require("module-alias/register");

import cron from "node-cron";
import { connection } from "@/db";
import { createServer } from "@/server";
import { deleteAllStats } from "@/services/stats";

const PORT = process.env.PORT ?? 4000;

// Schedule the cron job to run at 3 AM on the first day of every month
cron.schedule("0 3 1 * *", () => {
  console.log("Running deleteAllStats cron job...");
  deleteAllStats();
});

const start = async () => {
  try {
    await connection();

    const { httpServer } = createServer();
    httpServer.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(`Server not running. Error message: ${error.message}`);
    } else {
      console.log("Server not running due to an unknown error");
    }
    process.exit(1);
  }
};

start();
