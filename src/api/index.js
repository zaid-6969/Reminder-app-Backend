import dotenv from "dotenv";
import app from "../app.js";
import connectDB from "../config/database.js";

dotenv.config();

let isConnected = false;

export default async function handler(req, res) {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }

  return app(req, res);
}
