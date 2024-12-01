import { connection } from "../db";
import User from "@db/models/User";

export const storeSocketID = async (email: string, socketID: string) => {
  connection();
  try {
    await User.findOneAndUpdate({ email }, { socketID });
  } catch (error: any) {
    console.log(error);
  }
};

export const getUserBySocketId = async (socketID: string) => {
  connection();
  try {
    const user = await User.findOne({ socketID });
    return user;
  } catch (error: any) {
    console.log(error);
  }
};
