import User from "../models/user.js";
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary config (move to env vars in production)
cloudinary.config({
  cloud_name: 'ddlrkl4jy',
  api_key: '212535856243683',
  api_secret: 'nGJwawCFcUd0VXpesvJI_VHTxeg'
});

export const getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });

    console.log("Requested UID:", req.user.uid);
    console.log("Found User:", user);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      user: {
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        company: user.company || "",
        avatar: user.photoUrl || "",
      },
      message: "Profile retrieved successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error retrieving profile:", error.message);
    res.status(500).json({ error: "Failed to retrieve profile" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, company, avatar } = req.body;
    
    console.log("Update profile request:", { name, email, phone, company, avatar: avatar ? "URL provided" : "No avatar" });
    
    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    // Find existing user first
    const existingUser = await User.findOne({ uid: req.user.uid });
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    let photoUrl = existingUser.photoUrl; // Keep existing avatar by default
    
    // Handle avatar upload to Cloudinary if needed
    if (avatar) {
      if (avatar.startsWith("data:")) {
        // base64 or data URL - upload to Cloudinary
        try {
          const uploadResult = await cloudinary.uploader.upload(avatar, {
            folder: "avatars",
            public_id: `avatar_${req.user.uid}`,
            overwrite: true,
            resource_type: "image",
          });
          photoUrl = uploadResult.secure_url;
          console.log("Cloudinary upload successful:", photoUrl);
        } catch (uploadError) {
          console.error("Cloudinary upload failed:", uploadError);
          return res.status(500).json({ error: "Failed to upload image to Cloudinary" });
        }
      } else if (avatar.startsWith("http")) {
        // Already a URL (from Cloudinary or elsewhere)
        photoUrl = avatar;
      }
    }

    // Update user profile
    const updateFields = { 
      name: name.trim(), 
      email: email.trim(), 
      phone: phone || "", 
      company: company || "",
      photoUrl: photoUrl
    };

    console.log("Updating user with fields:", updateFields);

    const updatedUser = await User.findOneAndUpdate(
      { uid: req.user.uid },
      updateFields,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("Profile updated successfully:", updatedUser);

    // Optional: Log activity if you have a logging system
    // await logActivity(req.user.uid, "UPDATE_PROFILE", `Updated profile for user: ${updatedUser.name}`);

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        company: updatedUser.company,
        avatar: updatedUser.photoUrl,
      },
      success: true,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
    }
    
    res.status(500).json({ error: "Failed to update profile" });
  }
};  