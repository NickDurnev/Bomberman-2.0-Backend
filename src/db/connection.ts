import dotenv from "dotenv";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

const contactsDB = process.env.DB_HOST ?? "";

const connection = async () => {
  // Reuse the pooled connection. connect() is invoked from per-request and
  // per-socket paths; without this guard every call re-entered mongoose.connect
  // and a transient DB error called process.exit(1), killing the whole server
  // (and every connected player) mid-game. Connect once, then short-circuit.
  // readyState: 1 = connected, 2 = connecting.
  if (
    mongoose.connection.readyState === 1 ||
    mongoose.connection.readyState === 2
  ) {
    return;
  }

  mongoose.set("strictQuery", false);
  // Let errors propagate to the caller. At boot, app.ts's start() catch logs
  // and exits; per-request callers handle/log without taking down the server.
  await mongoose.connect(contactsDB);
  console.log("MongoDB Connected...");
};

export default connection;
