const { Server } = require("socket.io");

let io;

const init = (server, allowedOrigins) => {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
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
