import { connection } from "../db";
import User from "@db/models/User";

export async function login(req: any, res: any) {
  const { email, picture } = req.body;
  await connection();
  try {
    const user = await User.findOne({ email });
    if (user) {
      await User.findOneAndUpdate({ email }, { picture });
      res.json({
        status: "success",
        code: 200,
        data: {
          user,
        },
      });
      return;
    }
    const newUser = await User.create(req.body);
    res.status(201).json({
      status: "success",
      code: 201,
      data: {
        newUser,
      },
    });
  } catch (error: any) {
    res.status(error.status).json({ success: false, message: error.message });
  }
}
