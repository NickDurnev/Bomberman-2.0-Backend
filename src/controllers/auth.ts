import { Request, Response } from "express";

import User from "@db/models/User";
import cloudinary from "@services/cloudinary";
import { CustomError } from "@types";

import { connection } from "../db";

export async function login(req: Request, res: Response) {
  try {
    const { email, picture } = req.body;
    // Avatar handling must never block account creation. Throwaway/incognito
    // Google accounts can have no profile photo (empty picture), and Cloudinary
    // can fail — in both cases fall back to the source URL (or empty) instead of
    // failing the whole request, which previously left the user uncreated.
    const pictureUrl = await uploadAvatar(picture);
    await connection();

    const user = await User.findOne({ email });
    if (user) {
      const publicId = user.picture?.split("/").pop()?.split(".")[0]; // Extract public ID
      if (publicId) {
        await cloudinary.uploader.destroy(`users/${publicId}`);
      }

      const updatedUser = await User.findOneAndUpdate(
        { email },
        { picture: pictureUrl },
        { new: true },
      );
      res.json({
        status: "success",
        code: 200,
        data: {
          user: updatedUser,
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

// Upload the avatar to Cloudinary, returning the hosted URL. Never throws —
// returns the source URL (or empty string) if there is no picture or the upload
// fails, so a missing/broken avatar cannot block account creation.
async function uploadAvatar(picture?: string): Promise<string> {
  if (!picture) {
    return "";
  }
  try {
    const uploadResult = await cloudinary.uploader.upload(
      transformUrl(picture),
      {
        folder: "users",
        format: "png",
      },
    );
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Cloudinary upload failed, using source URL:", error);
    return picture;
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
