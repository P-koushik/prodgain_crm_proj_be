import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true,
    enum: ['user', 'ai']
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  user: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    default: function() {
      // Generate a more meaningful default title
      return `Chat - ${new Date().toLocaleDateString()}`;
    }
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
chatSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create compound index for better query performance
chatSchema.index({ user: 1, conversationId: 1 });

export default mongoose.model("ChatMessage", chatSchema);