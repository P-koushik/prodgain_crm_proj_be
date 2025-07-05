import ChatMessage from "../models/chatModel.js";
import axios from "axios";

// Handle chat message - REST API endpoint
export const handleChatMessage = async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const userId = req.user.uid || req.user.id; // Handle both possible formats
    console.log("Message from user:", message);
    console.log("Conversation ID:", conversationId);
    console.log("User ID:", userId);

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

    // Prepare context for OpenAI
    const openAIMessages = conversation.messages.map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.message,
    }));

    // Get AI response
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: openAIMessages,
        temperature: 0.7,
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
      conversationId: conversationId
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

// Get chat history - REST API endpoint
export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id; // Handle both possible formats
    
    // Get all conversations for this user
    const conversations = await ChatMessage.find({
      user: userId
    }).sort({ updatedAt: -1 }); // Sort by most recent

    console.log("Fetched conversations:", conversations.length);

    // Return the conversations array directly (not wrapped in conversations object)
    res.json(conversations);

  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch chat history",
      details: error.message
    });
  }
};

// Get specific conversation - REST API endpoint
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

    res.json({
      success: true,
      conversation: conversation
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

// Delete conversation - REST API endpoint
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

// Update conversation title - REST API endpoint
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