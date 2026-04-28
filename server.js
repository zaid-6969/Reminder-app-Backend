import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";
import connectDB from "./src/config/database.js";
import startReminderJob from "./src/utils/cronJobs.js";

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  startReminderJob();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
