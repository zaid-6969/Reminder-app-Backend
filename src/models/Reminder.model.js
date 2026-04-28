import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    dateTime: {
      type: Date,
      required: [true, "Date and time is required"],
    },
    completed: {
      type: Boolean,
      default: false,
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Index for efficient cron job queries — find pending reminders by time range
reminderSchema.index({ dateTime: 1, completed: 1, notificationSent: 1 });

const Reminder = mongoose.model("Reminder", reminderSchema);

export default Reminder;
