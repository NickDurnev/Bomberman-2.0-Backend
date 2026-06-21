import Joi, { ObjectSchema } from "joi";

const userSchema = Joi.object({
  name: Joi.string().trim(true).required(),
  email: Joi.string().trim(true).email().required(),
  // These are optional and may legitimately be empty/absent (e.g. a Google
  // account with no profile photo, or before the socket id is assigned).
  // Rejecting them previously made /auth return 422 and silently failed signup.
  socketID: Joi.string().allow(null, ""),
  locale: Joi.string().allow(null, ""),
  picture: Joi.string().allow(null, ""),
});

export default {
  "/auth": userSchema,
} as { [key: string]: ObjectSchema };
