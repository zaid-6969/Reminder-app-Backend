import express from "express";
import {
  createReminder,
  getReminders,
  getReminderById,
  updateReminder,
  deleteReminder,
  markComplete,
} from "../controller/reminder.controller.js";
import protect from "../middleware/auth.middleware.js";

const router = express.Router();

// All reminder routes require authentication
router.use(protect);

router.route("/")
  .get(getReminders)
  .post(createReminder);

router.route("/:id")
  .get(getReminderById)
  .put(updateReminder)
  .delete(deleteReminder);

router.patch("/:id/complete", markComplete);

export default router;
