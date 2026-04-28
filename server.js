import dotenv from "dotenv";
import app from "./src/app.js";
import connectDB from "./src/config/database.js";
import startReminderJob from "./src/utils/cronJobs.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  startReminderJob();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});