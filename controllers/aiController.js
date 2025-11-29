import Reminder from "../models/reminder.js";
import FamilyMember from "../models/familyMember.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);



// -----------------------------------------------------
// 🔍 FIXED REMINDER DETECTION LOGIC
// -----------------------------------------------------
function isReminderQuery(text) {
  const lower = text.toLowerCase();

  // Common reminder keywords
  const keywords = ["remind", "reminder", "medicine", "appointment", "vaccination", "dose"];
  if (keywords.some(k => lower.includes(k))) return true;

  // Patterns for checkup reminders when user intends to schedule
  const reminderPatterns = [
    /set .*checkup/,
    /schedule .*checkup/,
    /remind .*checkup/,
    /checkup reminder/,
    /checkup on/,
    /checkup at/,
  ];

  if (reminderPatterns.some(p => p.test(lower))) return true;

  return false;
}



// -----------------------------------------------------
// ❌ DELETE DETECTION
// -----------------------------------------------------
function isDeleteQuery(text) {
  const keywords = ["delete", "remove", "cancel", "clear", "stop reminder"];
  return keywords.some(k => text.toLowerCase().includes(k));
}



// -----------------------------------------------------
// ✏️ UPDATE DETECTION
// -----------------------------------------------------
function isUpdateQuery(text) {
  const keywords = ["update", "change", "modify", "reschedule", "edit", "shift"];
  return keywords.some(k => text.toLowerCase().includes(k));
}



// -----------------------------------------------------
// 🧠 MAIN CONTROLLER
// -----------------------------------------------------
export const chatWithAI = async (req, res) => {
  try {
    const user = req.user;
    const { message } = req.body;

    if (!message) return res.status(400).json({ error: "Message is required" });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // ORDER MATTERS → Update → Delete → Create → Normal Chat

    // 1️⃣ Update Reminder
    if (isUpdateQuery(message)) {
      return await handleUpdateReminder(message, user, res, model);
    }

    // 2️⃣ Delete Reminder
    if (isDeleteQuery(message)) {
      return await handleDeleteReminder(message, user, res, model);
    }

    // 3️⃣ Create Reminder
    if (isReminderQuery(message)) {
      return await handleCreateReminder(message, user, res, model);
    }

    // 4️⃣ Normal Chat
    const ai = await model.generateContent([{ text: message }]);
    return res.json({ reply: ai.response.text() });

  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
};



// -----------------------------------------------------
// 🟢 CREATE REMINDER
// -----------------------------------------------------
async function handleCreateReminder(message, user, res, model) {
  const prompt = `
Extract reminder information from the message. 
Respond ONLY with this JSON (no explanation):

{
  "title": "",
  "description": "",
  "category": "medicine | vaccination | checkup | custom",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "frequency": "once | daily | weekly | monthly | yearly",
  "memberName": ""
}

All values must be lowercase enums.

User: "${message}"
`;

  const ai = await model.generateContent([{ text: prompt }]);
  const raw = ai.response.text().replace(/```json|```/g, "").trim();

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch {
    return res.status(400).json({ error: "Invalid JSON from AI", raw });
  }

  if (!parsed.title || !parsed.date || !parsed.time) {
    return res.status(400).json({ error: "Missing required fields", raw: parsed });
  }

  // Validate category
  const allowedCategories = ["medicine", "vaccination", "checkup", "custom"];
  if (!allowedCategories.includes(parsed.category)) parsed.category = "custom";

  // Member mapping
  let memberId = null;
  if (parsed.memberName) {
    const m = await FamilyMember.findOne({ name: parsed.memberName, ownerId: user._id });
    if (m) memberId = m._id;
  }

  // nextRunAt generation
  const nextRunAt = new Date(`${parsed.date} ${parsed.time}`);

  const reminder = await Reminder.create({
    ownerId: user._id,
    memberId,
    title: parsed.title,
    description: parsed.description || "",
    category: parsed.category,
    frequency: parsed.frequency || "once",
    nextRunAt,
    meta: parsed
  });

  return res.json({
    reply: `🟢 Reminder created for **${parsed.title}** on **${parsed.date} at ${parsed.time}**`,
    reminder
  });
}



// -----------------------------------------------------
// 🔴 DELETE REMINDER (Smart Fuzzy Matching)
// -----------------------------------------------------
async function handleDeleteReminder(message, user, res, model) {
  const prompt = `
Extract ONLY the main reminder title user wants to delete.
Do NOT include names like aarav, aarya, mom, dad.

Return JSON ONLY:

{ "title": "" }

Examples:
"delete aarav's checkup reminder" → "checkup"
"remove vaccination for aarav" → "vaccination"
"delete my medicine reminder" → "medicine"

User: "${message}"
`;

  const ai = await model.generateContent([{ text: prompt }]);
  const raw = ai.response.text().replace(/```json|```/g, "").trim();

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return res.status(400).json({ error: "Invalid JSON from AI", raw }); }

  if (!parsed.title) {
    return res.status(400).json({ error: "Title missing for deletion", raw: parsed });
  }

  const cleanTitle = parsed.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const keyword = cleanTitle.split(" ").slice(-1)[0];

  // Fuzzy search logic
  const reminder = await Reminder.findOne({
    ownerId: user._id,
    deletedAt: null,
    $or: [
      { title: { $regex: cleanTitle, $options: "i" } },
      { title: { $regex: keyword, $options: "i" } },
      ...cleanTitle.split(" ").map(w => ({
        title: { $regex: w, $options: "i" }
      }))
    ]
  });

  if (!reminder) {
    return res.status(404).json({ error: "No matching reminder found" });
  }

  reminder.deletedAt = new Date();
  await reminder.save();

  return res.json({
    reply: `🗑️ Reminder **${reminder.title}** deleted successfully.`,
    deletedId: reminder._id
  });
}



// -----------------------------------------------------
// ✏️ UPDATE REMINDER
// -----------------------------------------------------
async function handleUpdateReminder(message, user, res, model) {
  const prompt = `
Extract update instruction for a reminder.
Return ONLY JSON:

{
  "title": "",
  "newTitle": "",
  "newDate": "",
  "newTime": "",
  "newFrequency": "",
  "newCategory": ""
}

User: "${message}"
`;

  const ai = await model.generateContent([{ text: prompt }]);
  const raw = ai.response.text().replace(/```json|```/g, "").trim();

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return res.status(400).json({ error: "Invalid JSON for update", raw }); }

  // Find reminder
  const reminder = await Reminder.findOne({
    ownerId: user._id,
    deletedAt: null,
    title: { $regex: parsed.title, $options: "i" }
  });

  if (!reminder) {
    return res.status(404).json({ error: "No matching reminder found to update" });
  }

  // Apply updates
  if (parsed.newTitle) reminder.title = parsed.newTitle;
  if (parsed.newDate && parsed.newTime) {
    reminder.nextRunAt = new Date(`${parsed.newDate} ${parsed.newTime}`);
  }
  if (parsed.newFrequency) reminder.frequency = parsed.newFrequency;
  if (parsed.newCategory) reminder.category = parsed.newCategory;

  await reminder.save();

  return res.json({
    reply: `🟢 Reminder updated successfully.`,
    updatedReminder: reminder
  });
}
