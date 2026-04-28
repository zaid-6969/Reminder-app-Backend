import User from "../middleware/auth.middleware.js";

// POST /api/v1/push/subscribe
export const subscribePush = async (req, res) => {
  try {
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "Invalid push subscription data" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      pushSubscription: { endpoint, keys },
    });

    return res.status(201).json({ message: "Push subscription saved successfully" });
  } catch (error) {
    console.error("Subscribe push error:", error.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

// DELETE /api/v1/push/unsubscribe
export const unsubscribePush = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      pushSubscription: null,
    });

    return res.status(200).json({ message: "Push subscription removed successfully" });
  } catch (error) {
    console.error("Unsubscribe push error:", error.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

// GET /api/v1/push/vapid-public-key
export const getVapidPublicKey = (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return res.status(500).json({ message: "Push notifications not configured" });
  }
  return res.status(200).json({ publicKey: key });
};
