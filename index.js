// server/server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import axios from "axios";
import authRoutes from "./routes/auth.js";
import contactRoutes from "./routes/contactRoutes.js";
import tagRoutes from "./routes/tagRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import Contact from "./models/ContactModel.js"; // Adjust path as needed
import chatRoutes from "./routes/chatRoutes.js"; // Import chat routes
import searchRoutes from "./routes/searchRoutes.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.PRODUCTION_URL, // Change this in production
    methods: ["GET", "POST"]
  }
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin:  process.env.PRODUCTION_URL,
  credentials: true
}));

app.use("/api", authRoutes);
app.use("/api", contactRoutes);
app.use("/api", tagRoutes);
app.use("/api", profileRoutes);
app.use("/api", activityRoutes);
app.use("/api", chatRoutes)
app.use("/api/search", searchRoutes);

// --- Socket.io AI Chat Integration ---
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("userMessage", async (userMessage) => {
    console.log("Message from user:", userMessage);

    try {
      // 1. Fetch relevant data from MongoDB
      const contacts = await Contact.find({}).limit(20); // Limit for prompt size

      // 2. Format the data as a string (summarize if needed)
      const contactsSummary = contacts.map(c =>
        `Name: ${c.name}, Email: ${c.email}, Company: ${c.company}, Phone: ${c.phone}`
      ).join("\n");

      // 3. Build the system prompt with your data
      const systemPrompt = `
You are a helpful assistant. Here is the current contacts data from the CRM:
${contactsSummary}
Answer the user's question based on this data.
      `;

      // 4. Send both system prompt and user message to OpenAI
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          temperature: 0.7
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      const aiReply = response.data.choices[0].message.content;
      socket.emit("aiResponse", aiReply);

    } catch (err) {
      console.error("Error from OpenAI:", err?.response?.data || err.message);
      socket.emit("aiResponse", "Sorry, there was an error processing your request.");
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
