import mongoose from "mongoose";

const Schema = mongoose.Schema;

const contactSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    company: {
      type: String,
      required: true,
    },
    tags: {
      type: [String], // Use [String] or [ObjectId] if you're referencing Tag
      required: true,
    },
    note: String,
    user: {
      type: String, // Firebase UID is a string
      required: true,
    },
  },
  { timestamps: true }
); // Automatically adds createdAt and updatedAt fields

const Contact =
  mongoose.models.Contact || mongoose.model("Contact", contactSchema);

export default Contact;
