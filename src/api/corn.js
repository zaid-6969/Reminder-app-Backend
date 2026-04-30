import connectDB from "../config/database.js";
import Reminder from "../models/Reminder.model.js";
import webPush from "web-push";

webPush.setVapidDetails(
  "mailto:admin@remindly.app",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  try {
    await connectDB();

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    const reminders = await Reminder.find({
      dateTime: { $gte: oneMinuteAgo, $lte: now },
      completed: false,
      notificationSent: false,
    }).populate("user");

    for (const reminder of reminders) {
      const user = reminder.user;

      if (user?.pushSubscription) {
        await webPush.sendNotification(
          user.pushSubscription,
          JSON.stringify({
            title: `🔔 ${reminder.title}`,
            body: reminder.description || "Reminder due",
          })
        );
      }

      reminder.notificationSent = true;
      await reminder.save();
    }

    res.status(200).json({ message: "Cron executed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}