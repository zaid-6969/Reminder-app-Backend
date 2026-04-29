import cron from "node-cron";
import webPush from "web-push";
import nodemailer from "nodemailer";
import Reminder from "../models/Reminder.model.js";

// ─── Web Push Setup ───────────────────────────────────────────────────────────
// Only initialise if VAPID keys are present in .env
let pushEnabled = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.EMAIL_USER) {
  try {
    webPush.setVapidDetails(
      `mailto:${process.env.EMAIL_USER}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    pushEnabled = true;
    console.log("[Push] Web Push notifications enabled.");
  } catch (err) {
    console.warn("[Push] VAPID setup failed — push notifications disabled:", err.message);
  }
} else {
  console.warn("[Push] VAPID keys not set — push notifications disabled. See .env.example");
}

// ─── Email Setup ──────────────────────────────────────────────────────────────
let emailEnabled = false;
let transporter  = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  emailEnabled = true;
  console.log("[Email] Email notifications enabled.");
} else {
  console.warn("[Email] EMAIL_USER/EMAIL_PASS not set — email notifications disabled.");
}

// ─── Senders ──────────────────────────────────────────────────────────────────

const sendPush = async (subscription, reminder) => {
  if (!pushEnabled) return;
  const payload = JSON.stringify({
    title: `🔔 Reminder: ${reminder.title}`,
    body:  reminder.description || "Your reminder is due now!",
    icon:  "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag:   reminder._id.toString(),
    data:  { reminderId: reminder._id },
  });
  try {
    await webPush.sendNotification(subscription, payload);
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      // Subscription expired — clear it
      await reminder.populate("user");
      if (reminder.user) {
        reminder.user.pushSubscription = null;
        await reminder.user.save();
      }
    } else {
      console.error("[Push] Send error:", err.message);
    }
  }
};

const sendEmail = async (email, reminder) => {
  if (!emailEnabled) return;
  try {
    await transporter.sendMail({
      from:    `"Remindly" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: `🔔 Reminder: ${reminder.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;padding:24px;border-radius:12px;border:1px solid #e5e7eb;">
          <h2 style="color:#e8571a;margin-top:0;">⏰ Reminder Alert</h2>
          <h3 style="margin-bottom:8px;">${reminder.title}</h3>
          ${reminder.description ? `<p style="color:#6b7280;">${reminder.description}</p>` : ""}
          <p style="color:#9ca3af;font-size:13px;margin-top:16px;">
            Scheduled for: <strong>${new Date(reminder.dateTime).toLocaleString()}</strong>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">Sent by Remindly</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[Email] Send error:", err.message);
  }
};

// ─── Cron job — runs every minute ────────────────────────────────────────────

const startReminderJob = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now          = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const reminders = await Reminder.find({
        dateTime:         { $gte: oneMinuteAgo, $lte: now },
        completed:        false,
        notificationSent: false,
      }).populate("user", "name email pushSubscription");

      if (!reminders.length) return;

      console.log(`[Cron] Processing ${reminders.length} due reminder(s).`);

      for (const reminder of reminders) {
        const user = reminder.user;
        if (!user) continue;

        if (user.pushSubscription) await sendPush(user.pushSubscription, reminder);
        if (user.email)            await sendEmail(user.email, reminder);

        reminder.notificationSent = true;
        await reminder.save();

        console.log(`[Cron] Notified: "${reminder.title}" → ${user.email}`);
      }
    } catch (err) {
      console.error("[Cron] Error:", err.message);
    }
  });

  console.log("[Cron] Reminder job started — checking every minute.");
};

export default startReminderJob;
