import Contact from '../models/ContactModel.js';
import Activity from '../models/activityModel.js';
import mongoose from 'mongoose';
import { logActivity } from '../activityLogger.js';
import Tag from "../models/tagModel.js";

import { startOfWeek, subWeeks, endOfWeek, startOfDay, endOfDay, subDays } from "date-fns";

// Get the date range for the previous week (Monday to Sunday)
const today = new Date();
const startOfLastWeek = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }); // Monday last week
const endOfLastWeek = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });     // Sunday last week


export const createContact = async (req, res) => {
  console.log("req.user", req.user)
  try {
    const { name, email, phone, company, tags, note } = req.body;
    console.log("Creating contact with data:", { name, email, phone, company, note });
    if (!name || !email || !phone || !company) {
      return res.status(400).json({ error: "All fields are required" });
    }
    console.log("note",note)
    const contact = await Contact.create({
      name,
      email,
      phone,
      company,
      tags,
      note,
      user: req.user.uid,
    });

    // Log activity for contact creation
    await logActivity(
      req.user.uid,
      "CREATE_CONTACT",
      `Created contact: "${contact.name}" (${contact.email}, ${contact.company})`
    );

    res.status(201).json({
      contact,
      message: "Contact created successfully",
      success: true
    });
  } catch (error) {
    console.error("Error creating contact:", error.message);
    res.status(500).json({ error: "Failed to create contact" });
  }
}

export const getAllContacts = async (req, res) => {
  try {
    const { limit, page, search, tags } = req.query;
    console.log("Query parameters:", { limit, page, search, tags });
    const query = { user: req.user.uid };

    console.log("Query parameters:", query);
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }
    if (tags) {
      query.tags = { $in: tags.split(',') };
    }
    const options = {
      limit: parseInt(limit) || 10,
      skip: (parseInt(page) - 1) * (parseInt(limit) || 10),
      sort: { createdAt: -1 }
    };

    const totalContacts = await Contact.countDocuments(query);
    const totalPages = Math.ceil(totalContacts / options.limit);

    let contacts = [];

    if (search) {
      contacts = await Contact.find(query, null, options);
    } else {
      contacts = await Contact.find({}, null, options);
    }

    if (await Contact.find(query, null, options)) {
      contacts = await Contact.find(query, null, options);
    } else {
      contacts = [];
    }

    if (!contacts || contacts.length === 0) {
      return res.status(404).json({ message: "No contacts found" });
    }

    const pagination = {
      totalContacts,
      totalPages,
      currentPage: parseInt(page) || 1,
      limit: options.limit
    };

    res.status(200).json({
      contacts,
      message: "Contacts retrieved successfully",
      success: true,
      pagination
    });
  } catch (error) {
    console.error("Error retrieving contacts:", error.message);
    res.status(500).json({ error: "Failed to retrieve contacts" });
  }
}

export const getContactById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Contact ID:", id);

    if (!id) {
      return res.status(400).json({ error: "Contact ID is required" });
    }

    // Correct usage:
    const contact = await Contact.findOne({ _id: id, user: req.user.uid });

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.status(200).json({
      contact,
      message: "Contact retrieved successfully",
      success: true
    });
  } catch (error) {
    console.error("Error retrieving contact:", error.message);
    res.status(500).json({ error: "Failed to retrieve contact" });
  }
}

export const deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("id", id);
    if (!id) {
      return res.status(400).json({ error: "Contact ID is required" });
    }

    // First, get the contact to know its tags
    const contactToDelete = await Contact.findOne({ _id: id, user: req.user.uid });

    if (!contactToDelete) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Delete the contact
    const deletedContact = await Contact.findOneAndDelete({ _id: id, user: req.user.uid });

    // Check for orphaned tags and delete them
    if (contactToDelete.tags && contactToDelete.tags.length > 0) {
      await deleteOrphanedTags(contactToDelete.tags, req.user.uid);
    }

    // Log activity for contact deletion
    await logActivity(
      req.user.uid,
      "DELETE_CONTACT",
      `Deleted contact: "${deletedContact.name}" (${deletedContact.email}, ${deletedContact.company})`
    );

    res.status(200).json({
      message: "Contact deleted successfully",
      success: true
    });
  } catch (error) {
    console.error("Error deleting contact:", error.message);
    res.status(500).json({ error: "Failed to delete contact" });
  }
};

export const updateContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company, note } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Contact ID is required" });
    }

    const updatedContact = await Contact.findByIdAndUpdate(
      id,
      { name, email, phone, company, note },
      { new: true }
    );

    if (!updatedContact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Log activity for contact update
    await logActivity(
      req.user.uid,
      "UPDATE_CONTACT",
      `Updated contact: "${updatedContact.name}" (${updatedContact.email}, ${updatedContact.company})`,
      id
    );

    res.status(200).json({
      contact: updatedContact,
      message: "Contact updated successfully",
      success: true
    });
  } catch (error) {
    console.error("Error updating contact:", error.message);
    res.status(500).json({ error: "Failed to update contact" });
  }
}

export const deleteMultipleContacts = async (req, res) => {
  try {
    const { ids } = req.body;
    console.log("IDs to delete:", ids);

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Contact IDs are required" });
    }

    const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));

    // First, get all contacts to collect their tags
    const contactsToDelete = await Contact.find({
      _id: { $in: objectIds },
      user: req.user.uid
    });

    // Collect all unique tags from contacts being deleted
    const allTagsToCheck = new Set();
    contactsToDelete.forEach(contact => {
      if (contact.tags && contact.tags.length > 0) {
        contact.tags.forEach(tag => allTagsToCheck.add(tag));
      }
    });

    // Delete the contacts
    const result = await Contact.deleteMany({
      _id: { $in: objectIds },
      user: req.user.uid
    });

    console.log("Delete result:", result);
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "No contacts found to delete" });
    }

    // Check for orphaned tags and delete them
    if (allTagsToCheck.size > 0) {
      await deleteOrphanedTags(Array.from(allTagsToCheck), req.user.uid);
    }

    // Log activity for multiple contact deletions
    await logActivity(
      req.user.uid,
      "DELETE_MULTIPLE_CONTACTS",
      `Deleted ${result.deletedCount} contacts`
    );

    res.status(200).json({
      message: `${result.deletedCount} contacts deleted successfully`,
      success: true
    });
  } catch (error) {
    console.error("Error deleting contacts:", error.message);
    res.status(500).json({ error: "Failed to delete contacts" });
  }
};
// Call this before saving/updating a contact
export async function ensureTagsExist(tags, userId) {
  for (const tagName of tags) {
    const exists = await Tag.findOne({ name: tagName, user: userId });
    if (!exists) {
      // You can set a default color or generate a random one
      await Tag.create({
        name: tagName,
        color: "#3b82f6", // default blue, or random color logic
        user: userId,
      });
    }
  }
}

export const importContacts = async (req, res) => {
  try {
    const { contacts } = req.body;
    const userId = req.user.uid;

    console.log("Contacts to import:", contacts.length);

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: "No contacts provided for import" });
    }

    // Extract all unique tags from contacts
    const allTags = new Set();
    contacts.forEach(contact => {
      if (contact.tags && Array.isArray(contact.tags)) {
        contact.tags.forEach(tag => {
          if (tag && tag.trim()) {
            allTags.add(tag.trim());
          }
        });
      }
    });

    console.log("Unique tags found:", Array.from(allTags));

    // Upsert all tags (create if not exists)
    const tagUpsertPromises = Array.from(allTags).map(tagName =>
      Tag.findOneAndUpdate(
        { name: tagName, user: userId },
        {
          $setOnInsert: {
            name: tagName,
            user: userId,
            color: "#3b82f6" // default blue color
          }
        },
        { upsert: true, new: true }
      )
    );

    await Promise.all(tagUpsertPromises);
    console.log("Tags upserted successfully");

    // Check for existing contacts by email to identify duplicates
    const existingEmails = await Contact.find(
      {
        user: userId,
        email: { $in: contacts.map(c => c.email) }
      },
      { email: 1, name: 1 }
    );

    const existingEmailSet = new Set(existingEmails.map(c => c.email));
    const newContacts = contacts.filter(c => !existingEmailSet.has(c.email));
    const duplicateContacts = contacts.filter(c => existingEmailSet.has(c.email));

    console.log("New contacts to insert:", newContacts.length);
    console.log("Duplicate contacts found:", duplicateContacts.length);

    if (newContacts.length === 0) {
      return res.status(400).json({
        error: "All contacts already exist",
        success: false,
        imported: 0,
        rejected: contacts.length,
        duplicates: duplicateContacts.map(c => ({ email: c.email, name: c.name }))
      });
    }

    // Prepare contacts for bulk insert
    const contactsToInsert = newContacts.map(contact => ({
      user: userId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone || "",
      company: contact.company || "",
      tags: contact.tags || [],
      note: contact.note || "",
      lastInteraction: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // Bulk insert only unique contacts
    const insertedContacts = await Contact.insertMany(contactsToInsert);

    console.log("Insert result:", insertedContacts.length);

    // Log activity for bulk import
    await logActivity(
      userId,
      "BULK_IMPORT_CONTACTS",
      `Imported ${insertedContacts.length} contacts from CSV. Rejected ${duplicateContacts.length} duplicates.`
    );

    res.status(200).json({
      message: `Successfully imported ${insertedContacts.length} contacts. ${duplicateContacts.length} duplicates were rejected.`,
      success: true,
      imported: insertedContacts.length,
      rejected: duplicateContacts.length,
      duplicates: duplicateContacts.map(c => ({ email: c.email, name: c.name })),
      importedContacts: insertedContacts
    });

  } catch (error) {
    console.error("Error importing contacts:", error.message);
    res.status(500).json({ error: "Failed to import contacts" });
  }
};

export const countofcontact = async (req, res) => {
  try {
    const userId = req.user.uid;

    // Use MongoDB aggregation to get comprehensive contact statistics
    const contactStats = await Contact.aggregate([
      // Match contacts for the current user
      { $match: { user: userId } },

      // Group by company and count contacts
      {
        $group: {
          _id: "$company",
          count: { $sum: 1 },
          contacts: { $push: "$$ROOT" }
        }
      },

      // Sort by count in descending order
      { $sort: { count: -1 } },

      {$limit: 5}, // Limit to top 5 companies
      // Project the final format
      {
        $project: {
          name: "$_id",
          contacts: "$count",
          _id: 0
        }
      }
    ]);

    // Get total contact count
    const totalContacts = await Contact.countDocuments({ user: userId });
    const activities = await Activity.countDocuments({ user: userId });

    
    const startOfThisWeek = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday 00:00
    const endOfThisWeek = endOfWeek(new Date(), { weekStartsOn: 1 });     // Sunday 23:59

    const newThisWeek = await Contact.countDocuments({
      user: userId,
      timestamp: {
        $gte: startOfThisWeek,
        $lte: endOfThisWeek,
      },
    });

    console.log("newThisWeek", newThisWeek);

    // Get contacts by tag distribution
    const tagDistribution = await Contact.aggregate([
      { $match: { user: userId } },
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },

      {
        $project: {
          name: "$_id",
          count: 1,
          _id: 0
        }
      }
    ]);

    // Get contacts created per day (date histogram)
    const contactsPerDay = await Contact.aggregate([
      {
        $match: {
          user: userId,
          timestamp: {
            $gte: startOfLastWeek,
            $lte: endOfLastWeek
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      
    ]);

    // Dynamic last 7 days (including today)
    const last7Days = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      last7Days.push({
        date: date,
        dayName: dayNames[date.getDay()],
        iso: date.toISOString().slice(0, 10)
      });
    }

    // Aggregate activities for each of the last 7 days (by day name)
    const activitiesByDay = {};
    for (const day of last7Days) {
      const count = await Activity.countDocuments({
        user: userId,
        timestamp: {
          $gte: startOfDay(day.date),
          $lte: endOfDay(day.date)
        }
      });
      console.log("count", count);
      activitiesByDay[day.dayName] = count;
    }

    console.log("date",new Date());
    // Get all contacts for tag colors (we'll need this for the pie chart)
    const allContacts = await Contact.find({ user: userId }).select('tags');

    res.status(200).json({
      success: true,
      message: "Contact statistics retrieved successfully",
      data: {
        totalContacts,
        newThisWeek,
        contactsByCompany: contactStats,
        tagDistribution,
        allContacts, // For processing tag colors in frontend
        activitiesByDay, // <-- This is your dynamic 7-day activity object
        activities,
        contactsPerDay
      }
    });

  } catch (error) {
    console.error("Error getting contact statistics:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve contact statistics"
    });
  }
};

// Utility to delete tags that are no longer used by any contact for a user
export const deleteOrphanedTags = async (tags, userId) => {
  if (!Array.isArray(tags) || tags.length === 0) return;
  // Find tags that are not referenced by any contact for this user
  for (const tag of tags) {
    const isUsed = await Contact.exists({ user: userId, tags: tag });
    if (!isUsed) {
      await Tag.deleteOne({ name: tag, user: userId });
    }
  }
}

// Helper to get day name from a Date object
const getDayName = (date) => {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};

export const getWeeklyActivityCounts = async (req, res) => {
  try {
    const userId = req.user.uid;

    // Get the date 6 days ago (so we have 7 days including today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);

    // Aggregate activities for the last 7 days
    const activities = await Activity.aggregate([
      {
        $match: {
          user: userId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $addFields: {
          day: { $dayOfWeek: "$timestamp" }, // 1 (Sunday) - 7 (Saturday)
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          }
        }
      },
      {
        $group: {
          _id: "$date",
          count: { $sum: 1 },
          dayOfWeek: { $first: "$day" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Build a map of date string to count
    const dateToCount = {};
    activities.forEach(a => {
      dateToCount[a._id] = a.count;
    });

    // Build the response for the last 7 days, with day names
    const result = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = getDayName(d);
      result[dayName] = dateToCount[dateStr] || 0;
    }

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error getting weekly activity counts:", error);
    res.status(500).json({ success: false, error: "Failed to get activity counts" });
  }
};