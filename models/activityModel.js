// models/Activity.js
import mongoose from "mongoose";

const Schema = mongoose.Schema;

const activitySchema = new Schema({
  contactId: { type: String, required: false}, 
  user: { type: String, required: true },
  activityType: { type: String, required: true }, 
  timestamp: { type: Date, default: Date.now },
  details: String,
});

const Activity = mongoose.models.Activity || mongoose.model("Activity", activitySchema);
export default Activity;
