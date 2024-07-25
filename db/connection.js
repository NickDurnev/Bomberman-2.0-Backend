const mongoose = require("mongoose");
require("dotenv").config();

const contactsDB = process.env.DB_HOST;

const connection = async () => {
  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(contactsDB);
    console.log("MongoDB Connected...");
  } catch (err) {
    console.error(err.message);
    // make the process fail
    process.exit(1);
  }
};

module.exports = connection;
