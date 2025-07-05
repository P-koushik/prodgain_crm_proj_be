import Tag from "../models/tagModel.js";
import { logActivity } from "../activityLogger.js";
import Contact from "../models/ContactModel.js";

// Bulk add tags
export const bulkAddTags = async (req, res) => {
  try {
    const { tags } = req.body;
    const userId = req.user.uid;
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Tags array is required" });
    }

    const newTags = [];
    for (const tag of tags) {
      const { name, color } = tag;
      if (!name || !color) continue;
      const exists = await Tag.findOne({ user: userId, name });
      if (exists) continue;
      const newTag = await Tag.create({ name, color, user: userId });
      newTags.push(newTag);
      await logActivity(
        userId,
        "CREATE_TAG",
        `Created tag: ${name} with color ${color}`
      );
    }

    if (newTags.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "No new tags were created (duplicates or missing fields).",
        });
    }

    return res.status(201).json({
      success: true,
      message: `${newTags.length} tag(s) created successfully`,
      tags: newTags,
    });
  } catch (error) {
    console.error("Error creating bulk tags:", error.message);
    res.status(500).json({ success: false, error: "Failed to create tags" });
  }
};

// Get all tags for user
export const getallTags = async (req, res) => {
  try {
    const tags = await Tag.find({ user: req.user.uid });
    const counts = await Contact.aggregate([
      { $match: { user: req.user.uid } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
    ]);
    const tagCounts = {};
    counts.forEach((c) => {
      tagCounts[c._id] = c.count;
    });

    res.status(200).json({
      message: "Tags retrieved successfully",
      tags,
      tagCounts,
    });
  } catch (error) {
    console.error("Error retrieving tags:", error.message);
    res.status(500).json({ error: "Failed to retrieve tags" });
  }
};

// Edit tag
export const editTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    if (!name || !color) {
      return res
        .status(400)
        .json({ success: false, error: "Tag name and color are required" });
    }
    const originalTag = await Tag.findById(id);
    if (!originalTag) {
      return res.status(404).json({ success: false, error: "Tag not found" });
    }
    const updatedTag = await Tag.findByIdAndUpdate(
      id,
      { name, color },
      { new: true }
    );
    await logActivity(
      req.user.uid,
      "EDIT_TAG",
      `Updated tag: "${originalTag.name}" to "${name}" (color: ${originalTag.color} → ${color})`
    );
    res.status(200).json({
      success: true,
      message: "Tag updated successfully",
      tag: updatedTag,
    });
  } catch (error) {
    console.error("Error updating tag:", error.message);
    res.status(500).json({ success: false, error: "Failed to update tag" });
  }
};

// Delete tag (with force option)
export const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;
    const userId = req.user.uid;
    const tagToDelete = await Tag.findById(id);
    if (!tagToDelete) {
      return res.status(404).json({ error: "Tag not found" });
    }
    const contactCount = await Contact.countDocuments({
      user: userId,
      tags: tagToDelete.name,
    });
    if (contactCount > 0) {
      if (force === "true") {
        await Contact.updateMany(
          { user: userId, tags: tagToDelete.name },
          { $pull: { tags: tagToDelete.name } }
        );
        await Tag.findByIdAndDelete(id);
        await logActivity(
          userId,
          "FORCE_DELETE_TAG",
          `Force deleted tag "${tagToDelete.name}" and removed from ${contactCount} contacts`
        );
        res.status(200).json({
          message: `Tag "${tagToDelete.name}" force deleted and removed from ${contactCount} contacts`,
          success: true,
        });
      } else {
        return res.status(400).json({
          error: `Cannot delete tag "${tagToDelete.name}" - it is currently used by ${contactCount} contact(s)`,
          success: false,
          tagName: tagToDelete.name,
          contactCount: contactCount,
          suggestion:
            "Use ?force=true to remove tag from all contacts and delete it",
        });
      }
    } else {
      await Tag.findByIdAndDelete(id);
      await logActivity(
        userId,
        "DELETE_TAG",
        `Deleted unused tag: "${tagToDelete.name}"`
      );
      res.status(200).json({
        message: `Tag "${tagToDelete.name}" deleted successfully`,
        success: true,
      });
    }
  } catch (error) {
    console.error("Error deleting tag:", error.message);
    res.status(500).json({ error: "Failed to delete tag" });
  }
};
