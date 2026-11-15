import { RequestHandler } from "express";
import schemas from "./validation/schemas";

interface ValidationError {
  message: string;
  type: string;
}

interface JoiError {
  status: string;
  error: {
    original: unknown;
    details: ValidationError[];
  };
}

interface CustomError {
  status: string;
  error: string;
}

const supportedMethods = ["post", "put", "patch", "delete"];

const validationOptions = {
  abortEarly: false,
  allowUnknown: false,
  stripUnknown: false,
};

const schemaValidator = (path: string, useJoiError = true): RequestHandler => {
  const schema = schemas[path];

  if (!schema) {
    throw new Error(`Schema not found for path: ${path}`);
  }

  return (req, res, next) => {
    const method = req.method.toLowerCase();

    if (!supportedMethods.includes(method)) {
      next();
      return;
    }

    // Express 5 leaves req.body undefined when no parser matched (for example
    // a request without a JSON Content-Type). Express 4 gave {}. Validate {} so
    // such a request still gets 422 for the missing required fields.
    const { error, value } = schema.validate(req.body ?? {}, validationOptions);

    if (error) {
      const customError: CustomError = {
        status: "failed",
        error: "Invalid request. Please review request and try again.",
      };

      const joiError: JoiError = {
        status: "failed",
        error: {
          original: error._original,
          details: error.details.map(({ message, type }: ValidationError) => ({
            message: message.replace(/['"]/g, ""),
            type,
          })),
        },
      };

      res.status(422).json(useJoiError ? joiError : customError);
      return; // Ensure the function doesn't continue after sending a response
    }

    // validation successful
    req.body = value;
    next(); // Call next to continue to the next middleware
  };
};

export default schemaValidator;
