// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import "express-async-errors";

import { connectDB } from "./utils/db.js";
import authRouter from "./routes/authroute.js";
import membersRouter from "./routes/members.js";
import healthRouter from "./routes/health.js";
import aiRoutes from "./routes/aiRoutes.js";
import reminderRoutes from "./routes/reminderRoutes.js";
import aiMemoryRoutes from "./routes/aiMemoryRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

import auth from "./middleware/auth.js";

// ⭐ Import the CRON JOB (runs automatically every minute)
import "./utils/reminderCron.js";

const PORT = process.env.PORT || 5000;

const app = express();

// ----------------------------------------
// MIDDLEWARES
// ----------------------------------------
app.use(helmet());
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

// ----------------------------------------
// PUBLIC ROUTES
// ----------------------------------------
app.use("/api/auth", authRouter);
app.use("/api/ai", aiRoutes);               // AI Chat
app.use("/api/reminders", reminderRoutes);  // Reminder CRUD (auth inside routes)

// ----------------------------------------
// PROTECTED ROUTES
// ----------------------------------------
app.use("/api/members", auth, membersRouter);
app.use("/api/health", auth, healthRouter);
app.use("/api/ai/memory", aiMemoryRoutes);
app.use("/api", auth, notificationRoutes); // Notifications require login

// ----------------------------------------
// ROOT ROUTE
// ----------------------------------------
app.get("/", (req, res) => res.send("SwasthaParivar API Running 🚀"));

// ----------------------------------------
// GLOBAL ERROR HANDLER
// ----------------------------------------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && err.stack ? err.stack : err);
  res.status(500).json({ message: "Internal server error" });
});

// ----------------------------------------
// START SERVER (NO MORE MANUAL SCHEDULER)
// ----------------------------------------
(async () => {
  try {
    console.log(
      "Loaded MONGO_URI =",
      process.env.MONGO_URI
        ? process.env.MONGO_URI.replace(/:\/\/.*@/, "://<user>:<pass>@")
        : "NONE"
    );

    await connectDB(process.env.MONGO_URI);

    app.listen(PORT, () => {
      console.log(`🚀 Backend running on port ${PORT}`);
      console.log("⏳ ReminderCron is active and running every minute...");
    });

  } catch (err) {
    console.error("Fatal - could not start server due to DB connect error:", err);
    process.exit(1);
  }
})();
