import express from "express";
import auth from "../middleware/auth.js";
import AIMemory from "../models/aiMemory.js";

const router = express.Router();

/**
 * GET /api/ai/memory?member=Self
 * Returns saved chat history
 */
router.get("/", auth, async (req, res) => {
  try {
    const member = req.query.member || "Self";
    const ownerId = req.user._id;

    let mem = await AIMemory.findOne({ ownerId, member });

    if (!mem)
      return res.status(200).json({ messages: [] });

    res.json({ messages: mem.messages });
  } catch (err) {
    console.error("AI Memory GET error:", err);
    res.status(500).json({ error: "Failed to load memory" });
  }
});

/**
 * POST /api/ai/memory
 * Saves updated memory
 */
router.post("/", auth, async (req, res) => {
  try {
    const { member, messages } = req.body;
    const ownerId = req.user._id;

    if (!member || !messages)
      return res.status(400).json({ error: "member & messages required" });

    let mem = await AIMemory.findOne({ ownerId, member });

    if (!mem) {
      mem = new AIMemory({ ownerId, member, messages });
    } else {
      mem.messages = messages;
    }

    await mem.save();
    res.json({ success: true });
  } catch (err) {
    console.error("AI Memory POST error:", err);
    res.status(500).json({ error: "Failed to save memory" });
  }
});

export default router;
