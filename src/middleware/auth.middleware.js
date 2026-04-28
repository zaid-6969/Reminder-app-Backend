import jwt from "jsonwebtoken";
import User from "../models/User.model.js";

const protect = async (req, res, next) => {
  try {
    let token;

    // Check cookie
    if (req.cookies?.token) {
      token = req.cookies.token;
    }

    // Check Bearer token
    else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized. Please log in." });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    req.user = user;
    next();

  } catch (error) {
    console.error(error.message); // helpful debug
    return res.status(401).json({
      message: "Invalid or expired token. Please log in again."
    });
  }
};

export default protect;