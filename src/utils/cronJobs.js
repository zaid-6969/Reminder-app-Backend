import cron from "node-cron";
import webPush from "web-push";
import nodemailer from "nodemailer";
import Reminder from "../models/Reminder.model.js";

// ─── Web Push Setup ──────────────────────────────────────────────────────────
// Run: node -e "const wp=require('web-push'); console.log(wp.generateVAPIDKeys())"
// to generate your VAPID keys and add them to .env

// ─── Email Setup ─────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use an App Password, not your real password
  },
});

// ─── Notification Senders ────────────────────────────────────────────────────

const sendPushNotification = async (subscription, reminder) => {
  const payload = JSON.stringify({
    title: `🔔 Reminder: ${reminder.title}`,
    body: reminder.description || "Your reminder is due now!",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: reminder._id.toString(),
    data: { reminderId: reminder._id },
  });

  try {
    await webPush.sendNotification(subscription, payload);
  } catch (err) {
    // Subscription expired or invalid — remove it
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.warn(
        `Push subscription expired for reminder ${reminder._id}, clearing.`,
      );
      await reminder.populate("user");
      if (reminder.user) {
        reminder.user.pushSubscription = null;
        await reminder.user.save();
      }
    } else {
      console.error("Push notification error:", err.message);
    }
  }
};

const sendEmailNotification = async (email, reminder) => {
  try {
    await transporter.sendMail({
      from: `"Reminder App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `🔔 Reminder: ${reminder.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color: #4f46e5;">⏰ Reminder Alert</h2>
          <h3>${reminder.title}</h3>
          ${reminder.description ? `<p>${reminder.description}</p>` : ""}
          <p style="color: #6b7280; font-size: 13px;">
            Scheduled for: ${new Date(reminder.dateTime).toLocaleString()}
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Email notification error:", err.message);
  }
};

// ─── Cron Job ────────────────────────────────────────────────────────────────
// Runs every minute. Finds reminders due within the past minute that haven't
// been notified yet, fires notifications, then marks them as notified.

const startReminderJob = () => {
  // ✅ Move it here
  webPush.setVapidDetails(
    `mailto:${process.env.EMAIL_USER}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      // Find reminders that are due and haven't been notified yet
      const reminders = await Reminder.find({
        dateTime: { $gte: oneMinuteAgo, $lte: now },
        completed: false,
        notificationSent: false,
      }).populate("user", "name email pushSubscription");

      if (reminders.length === 0) return;

      console.log(`[Cron] Found ${reminders.length} reminder(s) due.`);

      for (const reminder of reminders) {
        const user = reminder.user;
        if (!user) continue;

        // 1. Web Push — works even when the browser/tab is closed
        if (user.pushSubscription) {
          await sendPushNotification(user.pushSubscription, reminder);
        }

        // 2. Email fallback
        if (user.email) {
          await sendEmailNotification(user.email, reminder);
        }

        // Mark as notified so we don't send it again
        reminder.notificationSent = true;
        await reminder.save();

        console.log(
          `[Cron] Notified user ${user.email} for reminder: "${reminder.title}"`,
        );
      }
    } catch (error) {
      console.error("[Cron] Error processing reminders:", error.message);
    }
  });

  console.log("[Cron] Reminder job started — checking every minute.");
};

export default startReminderJob;
