import dotenv from "dotenv";
dotenv.config();

import cron from "node-cron";
import webPush from "web-push";
import nodemailer from "nodemailer";
import Reminder from "../models/Reminder.model.js";

// ─── Web Push ─────────────────────────────────────────────────────────────────
// FIX: removed EMAIL_USER requirement — push only needs VAPID keys
let pushEnabled = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webPush.setVapidDetails(
      `mailto:${process.env.EMAIL_USER || "admin@remindly.app"}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    pushEnabled = true;
    console.log("[Push] ✅ Web Push enabled.");
  } catch (err) {
    console.warn("[Push] ❌ VAPID setup failed:", err.message);
  }
} else {
  console.warn(
    "[Push] ❌ VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY missing in .env",
  );
}

// ─── Email ────────────────────────────────────────────────────────────────────
let emailEnabled = false;
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  emailEnabled = true;
  console.log("[Email] ✅ Email enabled.");
} else {
  console.warn("[Email] EMAIL_USER/EMAIL_PASS not set — email disabled.");
}

// ─── Send push ────────────────────────────────────────────────────────────────
const sendPush = async (subscription, reminder) => {
  if (!pushEnabled) return;
  try {
    await webPush.sendNotification(
      subscription,
      JSON.stringify({
        title: `🔔 ${reminder.title}`,
        body: reminder.description || "Your reminder is due now!",
        icon: "/favicon.svg",
        tag: reminder._id.toString(),
        data: { reminderId: reminder._id },
      }),
    );
    console.log(`[Push] ✅ Sent: "${reminder.title}"`);
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      const doc = await Reminder.findById(reminder._id).populate("user");
      if (doc?.user) {
        doc.user.pushSubscription = null;
        await doc.user.save();
        console.log("[Push] Cleared expired subscription.");
      }
    } else {
      console.error("[Push] Send error:", err.message);
    }
  }
};

// ─── Send email ───────────────────────────────────────────────────────────────
const sendEmail = async (email, reminder) => {
  if (!emailEnabled) return;
  try {
    await transporter.sendMail({
      from: `"Remindly" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `🔔 Reminder: ${reminder.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="color:#e8571a;margin-top:0;">⏰ Reminder Due</h2>
          <h3>${reminder.title}</h3>
          ${reminder.description ? `<p style="color:#6b7280">${reminder.description}</p>` : ""}
          <p style="color:#9ca3af;font-size:13px;">
            Scheduled: <strong>${new Date(reminder.dateTime).toLocaleString()}</strong>
          </p>
        </div>`,
    });
    console.log(`[Email] ✅ Sent to: ${email}`);
  } catch (err) {
    console.error("[Email] Send error:", err.message);
  }
};

// ─── Cron: every minute ───────────────────────────────────────────────────────
const startReminderJob = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const reminders = await Reminder.find({
        dateTime: { $gte: oneMinuteAgo, $lte: now },
        completed: false,
        notificationSent: false,
      }).populate("user", "name email pushSubscription");

      if (!reminders.length) return;

      console.log(`[Cron] ${reminders.length} reminder(s) due.`);

      for (const reminder of reminders) {
        const user = reminder.user;
        if (!user) continue;

        if (user.pushSubscription)
          await sendPush(user.pushSubscription, reminder);
        if (user.email) await sendEmail(user.email, reminder);

        reminder.notificationSent = true;
        await reminder.save();
        console.log(`[Cron] ✅ Done: "${reminder.title}" → ${user.email}`);
      }
    } catch (err) {
      console.error("[Cron] Error:", err.message);
    }
  });

  console.log("[Cron] ✅ Started — checking every minute.");
};

export default startReminderJob;
