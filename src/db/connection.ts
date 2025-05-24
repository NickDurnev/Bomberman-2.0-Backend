import dotenv from "dotenv";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

const contactsDB = process.env.DB_HOST ?? "";

const connection = async () => {
  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(contactsDB);
    console.log("MongoDB Connected...");
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(err.message);
    }
    // Terminate the process with a failure code
    process.exit(1);
  }
};

export default connection;
