const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { isSupportedRole } = require("../middleware/authorization");

let io;

const init = (server, allowedOrigins) => {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required."));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (
        !user ||
        user.status !== "active" ||
        !isSupportedRole(user.role) ||
        (decoded.tokenVersion || 0) !== (user.tokenVersion || 0)
      ) {
        return next(new Error("Authentication failed."));
      }
      socket.data.user = { id: String(user._id), role: user.role };
      next();
    } catch {
      next(new Error("Authentication failed."));
    }
  });

  io.on("connection", (socket) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`🔌 New client connected: ${socket.id}`);
    }

    socket.on("disconnect", () => {
      if (process.env.NODE_ENV !== "production") {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { init, getIO };
