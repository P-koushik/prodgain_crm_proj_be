import admin from "./firebase.js";

const authMiddleware = async (req, res, next) => {
  let token;

  // Try to get token from Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.token) {
    // Fallback to cookie
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {uid: decodedToken.uid};
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export default authMiddleware;
