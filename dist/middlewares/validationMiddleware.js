"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const schemas_1 = __importDefault(require("./validation/schemas"));
const supportedMethods = ["post", "put", "patch", "delete"];
const validationOptions = {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: false,
};
const schemaValidator = (path, useJoiError = true) => {
    const schema = schemas_1.default[path];
    if (!schema) {
        throw new Error(`Schema not found for path: ${path}`);
    }
    return (req, res, next) => {
        const method = req.method.toLowerCase();
        if (!supportedMethods.includes(method)) {
            next();
            return;
        }
        const { error, value } = schema.validate(req.body, validationOptions);
        if (error) {
            const customError = {
                status: "failed",
                error: "Invalid request. Please review request and try again.",
            };
            const joiError = {
                status: "failed",
                error: {
                    original: error._original,
                    details: error.details.map(({ message, type }) => ({
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
exports.default = schemaValidator;
