
import ChatMessage from "../models/chatModel.js";
import Contact from "../models/ContactModel.js";
import Activity from "../models/activityModel.js";
import Tag from "../models/tagModel.js";
import axios from "axios";

// Get CRM context for AI
const getCRMContext = async (userId) => {
  try {
    // Get user's contacts with recent activities
    const contacts = await Contact.find({ user: userId })
      .select('name email phone company tags note lastInteraction')
      .limit(50) // Limit to avoid token limits
      .sort({ lastInteraction: -1 });

    // Get recent activities
    const activities = await Activity.find({ user: userId })
      .select('action description timestamp contactId')
      .limit(20)
      .sort({ timestamp: -1 });

    // Get contact statistics
    const contactStats = {
      totalContacts: await Contact.countDocuments({ user: userId }),
      companiesCount: await Contact.distinct('company', { user: userId }).then(companies => companies.length),
      tagsCount: await Tag.countDocuments({ user: userId })
    };

    // Get top companies
    const topCompanies = await Contact.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$company", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get all tags
    const tags = await Tag.find({ user: userId }).select('name color');

    return {
      contacts,
      activities,
      contactStats,
      topCompanies,
      tags
    };
  } catch (error) {
    console.error("Error fetching CRM context:", error);
    return null;
  }
};

// Create system prompt with CRM context
const createSystemPrompt = (crmContext) => {
  if (!crmContext) {
    return "You are a helpful CRM assistant. Help users manage their contacts and business relationships.";
  }

  const { contacts, activities, contactStats, topCompanies, tags } = crmContext;

  return `You are an AI assistant for a CRM system. You have access to the user's CRM data and should provide helpful, contextual responses about their contacts, activities, and business relationships.

CURRENT CRM DATA SUMMARY:
- Total Contacts: ${contactStats.totalContacts}
- Companies: ${contactStats.companiesCount}
- Tags: ${contactStats.tagsCount}

TOP COMPANIES (by contact count):
${topCompanies.map(c => `- ${c._id}: ${c.count} contacts`).join('\n')}

RECENT CONTACTS (last 10):
${contacts.slice(0, 10).map(c => `- ${c.name} (${c.email}) at ${c.company}${c.tags?.length ? ` - Tags: ${c.tags.join(', ')}` : ''}`).join('\n')}

RECENT ACTIVITIES (last 5):
${activities.slice(0, 5).map(a => `- ${a.action}: ${a.description} (${new Date(a.timestamp).toLocaleDateString()})`).join('\n')}

AVAILABLE TAGS:
${tags.map(t => `- ${t.name}`).join('\n')}

You can help users with:
- Finding specific contacts or companies
- Analyzing contact data and relationships
- Suggesting follow-up actions
- Providing insights about their business network
- Managing tags and organization
- Tracking activities and interactions

When users ask about specific contacts, companies, or data, reference the actual information from their CRM. Be proactive in offering insights and suggestions based on their data.

If users ask about contacts or companies not in the current data, let them know you don't see that information in their current CRM data and suggest they check if it needs to be added.

Keep responses helpful, professional, and focused on CRM-related tasks.`;
};

// Handle chat message - Enhanced with CRM context
export const handleChatMessage = async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const userId = req.user.uid || req.user.id;
    
    console.log("Message from user:", message);
    console.log("Conversation ID:", conversationId);
    console.log("User ID:", userId);

    // Get CRM context
    const crmContext = await getCRMContext(userId);
    
    // Find or create conversation
    let conversation = await ChatMessage.findOne({
      conversationId: conversationId,
      user: userId
    });

    if (!conversation) {
      conversation = await ChatMessage.create({
        conversationId: conversationId,
        user: userId,
        messages: [],
      });
    }

    // Add user message
    conversation.messages.push({
      sender: "user",
      message: message,
      timestamp: new Date(),
    });

    // Prepare messages for OpenAI with system context
    const systemPrompt = createSystemPrompt(crmContext);
    
    const openAIMessages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...conversation.messages.map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.message,
      }))
    ];

    // Get AI response
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: openAIMessages,
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiMessage = response.data.choices[0].message.content;
    console.log("AI response:", aiMessage);

    // Add AI message
    conversation.messages.push({
      sender: "ai",
      message: aiMessage,
      timestamp: new Date(),
    });

    await conversation.save();

    // Return AI response
    res.json({
      success: true,
      response: aiMessage,
      conversationId: conversationId,
      crmDataIncluded: !!crmContext
    });

  } catch (error) {
    console.error("Error communicating with OpenAI:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get AI response",
      details: error.message
    });
  }
};

// Get chat history with CRM context indicator
export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    
    // Get all conversations for this user
    const conversations = await ChatMessage.find({
      user: userId
    }).sort({ updatedAt: -1 });

    console.log("Fetched conversations:", conversations.length);

    // Add CRM context indicator to each conversation
    const conversationsWithContext = conversations.map(conv => ({
      ...conv.toObject(),
      hasCRMContext: true // Since we're now always including CRM context
    }));

    res.json(conversationsWithContext);

  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch chat history",
      details: error.message
    });
  }
};

// Get specific conversation with CRM context
export const getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.uid || req.user.id;

    const conversation = await ChatMessage.findOne({
      conversationId: conversationId,
      user: userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found"
      });
    }

    // Get current CRM context for this conversation
    const crmContext = await getCRMContext(userId);

    res.json({
      success: true,
      conversation: conversation,
      crmContext: crmContext ? {
        contactsCount: crmContext.contacts.length,
        activitiesCount: crmContext.activities.length,
        lastUpdated: new Date().toISOString()
      } : null
    });

  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversation",
      details: error.message
    });
  }
};

// Delete conversation - same as before
export const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.uid || req.user.id;

    const result = await ChatMessage.deleteOne({
      conversationId: conversationId,
      user: userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found"
      });
    }

    res.json({
      success: true,
      message: "Conversation deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete conversation",
      details: error.message
    });
  }
};

// Update conversation title - same as before
export const updateConversationTitle = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title } = req.body;
    const userId = req.user.uid || req.user.id;

    const conversation = await ChatMessage.findOneAndUpdate(
      {
        conversationId: conversationId,
        user: userId
      },
      { title: title },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found"
      });
    }

    res.json({
      success: true,
      conversation: conversation
    });

  } catch (error) {
    console.error("Error updating conversation title:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update conversation title",
      details: error.message
    });
  }
};

// New endpoint to refresh CRM context for a conversation
export const refreshCRMContext = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.uid || req.user.id;

    // Get fresh CRM context
    const crmContext = await getCRMContext(userId);

    res.json({
      success: true,
      message: "CRM context refreshed",
      crmContext: crmContext ? {
        contactsCount: crmContext.contacts.length,
        activitiesCount: crmContext.activities.length,
        lastUpdated: new Date().toISOString()
      } : null
    });

  } catch (error) {
    console.error("Error refreshing CRM context:", error);
    res.status(500).json({
      success: false,
      error: "Failed to refresh CRM context",
      details: error.message
    });
  }
};
