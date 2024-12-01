import Joi, { ObjectSchema } from "joi";

const userSchema = Joi.object({
  name: Joi.string().trim(true).required(),
  email: Joi.string().trim(true).required(),
  socketID: Joi.string(),
  locale: Joi.string(),
  picture: Joi.string(),
  leftReview: Joi.bool(),
});

export default {
  "/auth": userSchema,
} as { [key: string]: ObjectSchema };
