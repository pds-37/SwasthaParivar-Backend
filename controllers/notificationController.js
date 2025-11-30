import webpush from "web-push";
import User from "../models/user_temp.js";

webpush.setVapidDetails(
  "mailto:you@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Save subscription to DB
export const saveSubscription = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      pushSubscription: req.body.subscription,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Send Push Notification
export async function sendPush(user, title, body) {
  if (!user.pushSubscription) return;

  const payload = JSON.stringify({ title, body });

  try {
    await webpush.sendNotification(user.pushSubscription, payload);
  } catch (err) {
    console.error("Push Error:", err);

    // If subscription expired → remove it
    if (
      err.statusCode === 410 || // Gone
      err.statusCode === 404    // Not Found
    ) {
      console.log("Removing invalid push subscription");
      user.pushSubscription = null;
      await user.save();
    }
  }
}

export default webpush;
