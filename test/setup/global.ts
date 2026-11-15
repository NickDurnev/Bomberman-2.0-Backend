// Runs before every test file, before any test or app module is imported.
// Tests must never reach the database or Cloudinary account in .env:
// dotenv does not override variables that are already set, so these values
// win over .env.
//
// DB_HOST points at a closed port until startTestServer() replaces it with the
// in-memory server URI. A module that reads DB_HOST too early fails to
// connect; it cannot reach a real database.
process.env.DB_HOST = "mongodb://127.0.0.1:1/not-started";
process.env.CLOUDINARY_CLOUD_NAME = "";
process.env.CLOUDINARY_API_KEY = "";
process.env.CLOUDINARY_API_SECRET = "";
