import express from "express";
import {
  subscribePush,
  unsubscribePush,
  getVapidPublicKey,
} from "../controller/push.controller.js";
import protect from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/vapid-public-key", getVapidPublicKey);
router.post("/subscribe", protect, subscribePush);
router.delete("/unsubscribe", protect, unsubscribePush);

export default router;
