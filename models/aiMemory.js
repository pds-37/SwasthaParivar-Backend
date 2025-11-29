import mongoose from "mongoose";

const aiMemorySchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  member: {
    type: String,
    required: true, // "Self" or family member name
  },
  messages: [
    {
      sender: { type: String, enum: ["user", "ai"], required: true },
      text: { type: String, required: true },
      ts: { type: Date, default: Date.now },
      attachment: { type: String }, // optional image
    },
  ],
});

aiMemorySchema.index({ ownerId: 1, member: 1 }, { unique: true });

export default mongoose.model("AIMemory", aiMemorySchema);
