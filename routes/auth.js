// server/routes/auth.js
import express from "express";
import admin from "../firebase.js"
import User from "../models/user.js"

const router = express.Router();

// Route 1: Verify token (optional, if you want to use Firebase ID token verification)
router.post("/verify-token", async (req, res) => {
  const { token } = req.body;

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email, displayName, picture } = decodedToken;

    let user = await User.findOne({ uid });
    if (!user) {
      user = await User.create({
        uid,
        email,
        displayName,
        photoURL: picture || ""
      });
    }

    res.status(200).json({ message: "Authenticated", user });
  } catch (err) {
    console.error("Token verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

//  Route 2: Register (used during login/register in AuthProvider)
router.post("/auth/register", async (req, res) => {
  try {
    const { uid, email, name, photoURL } = req.body;

    if (!uid || !email) {
      console.log("Missing fields in request body:", req.body);
      return res.status(400).json({ error: "Missing required fields" });
    }
    console.log(User)
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        uid,
        email,
        name: name || "",
        photoURL: photoURL || "",
      });
      await user.save();
      console.log("New user saved to DB:", user);
    } else {
      console.log("User already exists in DB:", user.email);
    }

    res.status(201).json({ message: "User synced successfully", user });
  } catch (error) {
    console.error(" Sync error:", error.message);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

export default router;