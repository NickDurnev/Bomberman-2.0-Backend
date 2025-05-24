import { Request, Response } from "express";

import User from "@db/models/User";
import cloudinary from "@services/cloudinary";
import { CustomError } from "@types";

import { connection } from "../db";

export async function login(req: Request, res: Response) {
  const { email, picture } = req.body;
  const transformedURL = await transformUrl(picture);
  const uploadResult = await cloudinary.uploader.upload(transformedURL, {
    folder: "users",
    format: "png",
  });
  const pictureUrl = uploadResult.secure_url;
  await connection();
  try {
    const user = await User.findOne({ email });
    if (user) {
      const publicId = user.picture.split("/").pop()?.split(".")[0]; // Extract public ID
      await cloudinary.uploader.destroy(`users/${publicId}`);

      await User.findOneAndUpdate({ email }, { picture: pictureUrl });
      res.json({
        status: "success",
        code: 200,
        data: {
          user,
        },
      });
      return;
    }
    const data = { ...req.body, picture: pictureUrl };
    const newUser = await User.create(data);
    res.status(201).json({
      status: "success",
      code: 201,
      data: {
        newUser,
      },
    });
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
}

function transformUrl(url: string): string {
  const googleImageRegex = /^https:\/\/lh3\.googleusercontent\.com\//;

  // Check if the URL is from Google
  if (googleImageRegex.test(url)) {
    return url.replace(/=s\d+-c$/, "=s460-c");
  }

  return url; // Return as-is if not a Google image
}
