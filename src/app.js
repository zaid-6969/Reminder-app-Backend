import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import reminderRoutes from "./routes/reminder.routes.js";
import authRoutes from "./routes/auth.routes.js";
import pushRoutes from "./routes/push.routes.js";
import webPush from "web-push";
import nodemailer from "nodemailer";
import Reminder from "./models/Reminder.model.js";
import connectDB from "./config/database.js";

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://reminder-app-frontend-puce.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/reminders", reminderRoutes);
app.use("/api/v1/push", pushRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// ─── Push + Email setup ───────────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    `mailto:${process.env.EMAIL_USER || "admin@remindly.app"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

let mailer = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  mailer = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

// ─── /api/cron — Vercel calls this every minute ───────────────────────────────
app.get("/api/cron", async (req, res) => {
  try {
    // Always ensure DB is connected (Vercel serverless has no persistent state)
    await connectDB();

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    const reminders = await Reminder.find({
      dateTime:         { $gte: oneMinuteAgo, $lte: now },
      completed:        false,
      notificationSent: false,
    }).populate("user", "name email pushSubscription");

    console.log(`[Cron] ${reminders.length} due at ${now.toISOString()}`);

    for (const reminder of reminders) {
      const user = reminder.user;
      if (!user) continue;

      // Push notification
      if (process.env.VAPID_PUBLIC_KEY && user.pushSubscription) {
        try {
          await webPush.sendNotification(
            user.pushSubscription,
            JSON.stringify({
              title: `🔔 ${reminder.title}`,
              body:  reminder.description || "Your reminder is due now!",
              icon:  "/favicon.svg",
              tag:   reminder._id.toString(),
            })
          );
          console.log(`[Push] ✅ "${reminder.title}"`);
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            user.pushSubscription = null;
            await user.save();
          } else {
            console.error("[Push] Error:", e.message);
          }
        }
      }

      // Email
      if (mailer && user.email) {
        try {
          await mailer.sendMail({
            from:    `"Remindly" <${process.env.EMAIL_USER}>`,
            to:      user.email,
            subject: `🔔 Reminder: ${reminder.title}`,
            html: `<div style="font-family:Arial,sans-serif;padding:24px;max-width:480px;border:1px solid #e5e7eb;border-radius:12px;">
              <h2 style="color:#e8571a;">⏰ ${reminder.title}</h2>
              ${reminder.description ? `<p>${reminder.description}</p>` : ""}
              <p style="color:#9ca3af;font-size:13px;">Due: ${new Date(reminder.dateTime).toLocaleString()}</p>
            </div>`,
          });
          console.log(`[Email] ✅ ${user.email}`);
        } catch (e) {
          console.error("[Email] Error:", e.message);
        }
      }

      reminder.notificationSent = true;
      await reminder.save();
    }

    return res.status(200).json({
      ok: true,
      processed: reminders.length,
      time: now.toISOString(),
    });
  } catch (err) {
    console.error("[Cron] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

export default app;