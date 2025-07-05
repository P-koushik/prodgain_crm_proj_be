import Activity from "../models/activityModel.js";

export const getPaginatedActivities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Optionally filter by user: { user: req.user._id }
    const activities = await Activity.find({user: req.user.uid})
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getActivityById = async (req, res) => {
  try {
    // Assuming activities have a contactId field
    const activities = await Activity.findOne({ contactId: req.params.contactId }).sort({ timestamp: -1 });
    res.json({ activities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};