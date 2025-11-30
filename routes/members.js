// routes/members.js
import express from "express";
import familymember from "../models/familymember.js";



const router = express.Router();

/* ===========================
   GET all members (user only)
=========================== */
router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    const members = await familymember
      .find({ user: userId })
      .sort({ createdAt: -1 });

    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   CREATE member
=========================== */
router.post("/", async (req, res) => {
  try {
    const userId = req.userId;
    const { name, age, gender, avatar } = req.body;

    if (!name) return res.status(400).json({ message: "Name required" });

    const m = new familyMember({
      user: userId,
      name,
      age,
      gender,
      avatar,
      health: {} // ensure empty health object
    });

    await m.save();
    res.status(201).json(m);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create member" });
  }
});

/* ===========================
   GET single member
=========================== */
router.get("/:id", async (req, res) => {
  try {
    const userId = req.userId;

    const member = await FamilyMember.findOne({
      _id: req.params.id,
      user: userId
    });

    if (!member) return res.status(404).json({ message: "Not found" });

    res.json(member);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   UPDATE HEALTH ONLY  ⭐
=========================== */
router.put("/:id", async (req, res) => {
  try {
    const userId = req.userId;

    if (!req.body.health) {
      return res.status(400).json({ error: "Missing health object" });
    }

    const member = await FamilyMember.findOneAndUpdate(
      { _id: req.params.id, user: userId },   // security filter
      { $set: { health: req.body.health } },  // update only health
      { new: true, runValidators: true }
    );

    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    res.json(member);

  } catch (err) {
    console.log("UPDATE MEMBER ERROR:", err);
    res.status(500).json({ error: "Error updating member" });
  }
});

// DELETE /members/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    // TODO: check req.user.id or ownerId before deleting (authorization)
    const doc = await Member.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "Member not found" });
    return res.json({ success: true, id });
  } catch (err) {
    console.error("delete member err", err);
    return res.status(500).json({ error: "Server error" });
  }
});



export default router;
