import cron from "node-cron";
import Reminder from "../models/reminder.model.js";
import nodemailer from "nodemailer"; // optional

// OPTIONAL: email setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const startReminderJob = () => {
  cron.schedule("* * * * *", async () => {
    const now = new Date();

    const currentDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().slice(0, 5);

    const reminders = await Reminder.find({
      date: currentDate,
      time: currentTime,
      completed: false,
    }).populate("user");

    for (const reminder of reminders) {
      console.log(`🔔 Reminder: ${reminder.title}`);

      // OPTIONAL EMAIL
      if (reminder.user?.email) {
        await transporter.sendMail({
          to: reminder.user.email,
          subject: "Reminder Alert",
          text: reminder.title,
        });
      }
    }
  });
};

export default startReminderJob;