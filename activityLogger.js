// middleware/logActivity.js
import Activity from "./models/activityModel.js";

export const logActivity = async ( userId, activityType, details = "", id) => {
  try {
    if (!userId) {
      console.error("No user ID provided for activity logging");
      return;
    }

    await Activity.create({
      user: userId,
      activityType,
      details,
      contactId :id,
      timestamp: new Date()
    });

    console.log(`Activity logged: ${activityType} - ${details} for user: ${userId}`);
  } catch (error) {
    console.error("Activity logging failed:", error.message);
  }
};
