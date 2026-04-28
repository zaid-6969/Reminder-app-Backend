import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import reminderRoutes from "./routes/reminder.routes.js";
import authRoutes from "./routes/auth.routes.js";

const app = express(); 


const allowedOrigin = [
  "http://localhost:5173",
];

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());



app.use("/api/v1/reminders", reminderRoutes);
app.use("/api/v1/auth", authRoutes);

export default app;
