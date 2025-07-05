import express from 'express';
import { 
  getChatHistory, 
  handleChatMessage, 
  getConversation, 
  deleteConversation, 
  updateConversationTitle 
} from '../control/chatController.js';
import authMiddleware from '../authMiddleware.js';

const router = express.Router();

// Get all chat history for authenticated user
router.get('/chat/history', authMiddleware, getChatHistory);

// Send a message and get AI response
router.post('/chat/send', authMiddleware, handleChatMessage);

// Get specific conversation
router.get('/chat/conversation/:conversationId', authMiddleware, getConversation);

// Delete specific conversation
router.delete('/chat/conversation/:conversationId', authMiddleware, deleteConversation);

// Update conversation title
router.put('/chat/conversation/:conversationId/title', authMiddleware, updateConversationTitle);

export default router;