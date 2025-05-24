import User from "@db/models/User";
import { connection } from "../db";

export const storeSocketID = async (email: string, socketID: string) => {
  connection();
  try {
    await User.findOneAndUpdate({ email }, { socketID });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
};

export const getUserBySocketId = async (socketID: string) => {
  connection();
  try {
    const user = await User.findOne({ socketID });
    return user;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
};
