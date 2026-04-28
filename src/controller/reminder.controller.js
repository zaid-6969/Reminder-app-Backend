import Reminder from "../models/Reminder.model.js";

// ─── Controllers ────────────────────────────────────────────────────────────

// POST /api/v1/reminders
export const createReminder = async (req, res) => {
  try {
    const { title, description, dateTime } = req.body;

    // Input validation
    if (!title || !dateTime) {
      return res.status(400).json({ message: "Title and dateTime are required" });
    }

    const reminderDate = new Date(dateTime);
    if (isNaN(reminderDate.getTime())) {
      return res.status(400).json({ message: "Invalid dateTime format" });
    }

    if (reminderDate <= new Date()) {
      return res.status(400).json({ message: "Reminder dateTime must be in the future" });
    }

    const reminder = await Reminder.create({
      title: title.trim(),
      description: description?.trim() || "",
      dateTime: reminderDate,
      user: req.user._id,
    });

    return res.status(201).json({
      message: "Reminder created successfully",
      reminder,
    });
  } catch (error) {
    console.error("Create reminder error:", error.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

// GET /api/v1/reminders
export const getReminders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    // Build filter
    const filter = { user: req.user._id };
    if (status === "pending") filter.completed = false;
    if (status === "completed") filter.completed = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reminders, total] = await Promise.all([
      Reminder.find(filter)
        .sort({ dateTime: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Reminder.countDocuments(filter),
    ]);

    return res.status(200).json({
      reminders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get reminders error:", error.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

// GET /api/v1/reminders/:id
export const getReminderById = async (req, res) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    return res.status(200).json({ reminder });
  } catch (error) {
    console.error("Get reminder error:", error.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

// PUT /api/v1/reminders/:id
export const updateReminder = async (req, res) => {
  try {
    const { title, description, dateTime, completed } = req.body;

    // Ensure reminder belongs to this user
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    // Validate dateTime if being changed
    if (dateTime) {
      const dt = new Date(dateTime);
      if (isNaN(dt.getTime())) {
        return res.status(400).json({ message: "Invalid dateTime format" });
      }
      reminder.dateTime = dt;
      // Reset notification flag so cron sends it again at new time
      reminder.notificationSent = false;
    }

    if (title !== undefined) reminder.title = title.trim();
    if (description !== undefined) reminder.description = description.trim();
    if (completed !== undefined) reminder.completed = completed;

    await reminder.save();

    return res.status(200).json({
      message: "Reminder updated successfully",
      reminder,
    });
  } catch (error) {
    console.error("Update reminder error:", error.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

// DELETE /api/v1/reminders/:id
export const deleteReminder = async (req, res) => {
  try {
    // Ensure reminder belongs to this user
    const reminder = await Reminder.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    return res.status(200).json({ message: "Reminder deleted successfully" });
  } catch (error) {
    console.error("Delete reminder error:", error.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

// PATCH /api/v1/reminders/:id/complete
export const markComplete = async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { completed: true },
      { new: true }
    );

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    return res.status(200).json({
      message: "Reminder marked as complete",
      reminder,
    });
  } catch (error) {
    console.error("Mark complete error:", error.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};
