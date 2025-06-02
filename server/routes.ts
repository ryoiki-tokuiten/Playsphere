import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertMessageSchema, insertGroupSchema, insertGameSchema, users } from "@shared/schema";
import { setupWebSocket } from "./websocket";
import path from "path";
import fs from "fs";
import multer from "multer";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import ideasRouter from "./routes/ideas";

// Configure multer for file uploads
const storage_uploads = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({ 
  storage: storage_uploads,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  }
});

export function registerRoutes(app: Express): Server {
  // Ideas routes
  app.use("/api/ideas", ideasRouter);

  // User endpoints
  app.get("/api/users", async (req, res) => {
    const users = await storage.getActiveUsers();
    res.json(users);
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(parseInt(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(parseInt(req.params.id), updates);
      res.json(user);
    } catch (err) {
      res.status(400).json({ message: "Invalid update data" });
    }
  });

  // Password change endpoint
  app.post("/api/user/change-password", async (req, res) => {
    try {
      const { userId, currentPassword, newPassword } = req.body;
      
      if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Get the user to verify the current password
      const user = await storage.getUser(parseInt(userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify the current password (this is a simplified example, use proper password hashing)
      if (user.password !== currentPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      
      // Update the password
      await storage.updateUser(parseInt(userId), { password: newPassword });
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Message endpoints
  app.get("/api/messages/:fromUserId/:toUserId", async (req, res) => {
    const messages = await storage.getMessages(
      parseInt(req.params.fromUserId),
      parseInt(req.params.toUserId)
    );
    res.json(messages);
  });

  // Group endpoints
  
  // Create a new group
  app.post("/api/groups", async (req, res) => {
    try {
      const groupData = insertGroupSchema.parse(req.body);
      const group = await storage.createGroup(groupData);
      res.status(201).json(group);
    } catch (err) {
      res.status(400).json({ message: "Invalid group data" });
    }
  });

  // Get all groups for a user
  app.get("/api/users/:userId/groups", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const groups = await storage.getUserGroups(userId);
      res.json(groups);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  // Get a specific group
  app.get("/api/groups/:groupId", async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const group = await storage.getGroup(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      res.json(group);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch group" });
    }
  });

  // Delete a group
  app.delete("/api/groups/:groupId", async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const userId = parseInt(req.body.userId);
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      const success = await storage.deleteGroup(groupId, userId);
      
      if (!success) {
        return res.status(403).json({ message: "You don't have permission to delete this group" });
      }
      
      res.json({ message: "Group deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete group" });
    }
  });

  // Get all members of a group
  app.get("/api/groups/:groupId/members", async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const members = await storage.getGroupMembers(groupId);
      res.json(members);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch group members" });
    }
  });

  // Add a member to a group
  app.post("/api/groups/:groupId/members", async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const { userId, currentUserId } = req.body;
      
      if (!userId || !currentUserId) {
        return res.status(400).json({ message: "User IDs are required" });
      }
      
      // Check if the current user is the owner
      const isOwner = await storage.isGroupOwner(groupId, currentUserId);
      
      if (!isOwner) {
        return res.status(403).json({ message: "Only the group owner can add members" });
      }
      
      await storage.addGroupMember({
        groupId,
        userId: parseInt(userId)
      });
      
      res.json({ message: "Member added successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to add member to group" });
    }
  });

  // Remove a member from a group
  app.delete("/api/groups/:groupId/members/:memberId", async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const memberId = parseInt(req.params.memberId);
      const currentUserId = parseInt(req.body.currentUserId);
      
      if (!currentUserId) {
        return res.status(400).json({ message: "Current user ID is required" });
      }
      
      // Check if the current user is the owner
      const isOwner = await storage.isGroupOwner(groupId, currentUserId);
      
      // Allow users to remove themselves (leave the group)
      const isSelfRemoval = memberId === currentUserId;
      
      if (!isOwner && !isSelfRemoval) {
        return res.status(403).json({ message: "You don't have permission to remove this member" });
      }
      
      const success = await storage.removeGroupMember(groupId, memberId);
      
      if (!success) {
        return res.status(400).json({ message: "Failed to remove member" });
      }
      
      res.json({ message: "Member removed successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to remove member from group" });
    }
  });

  // Transfer group ownership
  app.post("/api/groups/:groupId/transfer-ownership", async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const { currentOwnerId, newOwnerId } = req.body;
      
      if (!currentOwnerId || !newOwnerId) {
        return res.status(400).json({ message: "Owner IDs are required" });
      }
      
      const success = await storage.transferGroupOwnership(
        groupId,
        parseInt(currentOwnerId),
        parseInt(newOwnerId)
      );
      
      if (!success) {
        return res.status(403).json({ message: "Ownership transfer failed" });
      }
      
      res.json({ message: "Ownership transferred successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to transfer ownership" });
    }
  });

  // Get messages for a group
  app.get("/api/groups/:groupId/messages", async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const userId = parseInt(req.query.userId as string);
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Check if the user is a member of the group
      const isMember = await storage.isGroupMember(groupId, userId);
      
      if (!isMember) {
        return res.status(403).json({ message: "You don't have permission to view these messages" });
      }
      
      const messages = await storage.getGroupMessages(groupId);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch group messages" });
    }
  });

  // Image upload endpoint
  app.post("/api/upload/image", upload.single("image"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Generate the URL for the uploaded file
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
      
      res.json({
        url: fileUrl,
        success: true
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Serve static files from uploads directory
  app.use("/uploads", (req, res, next) => {
    // Set cache headers for uploaded files
    res.setHeader("Cache-Control", "public, max-age=31536000");
    next();
  }, express.static(path.join(process.cwd(), "uploads")));

  // Game endpoints
  app.get("/api/games", async (req, res) => {
    try {
      const games = await storage.getAllGames();
      res.json(games);
    } catch (error) {
      console.error("Error fetching games:", error);
      res.status(500).json({ message: "Error fetching games" });
    }
  });

  app.get("/api/games/category", async (req, res) => {
    try {
      const categories = req.query.categories as string;
      if (!categories) {
        return res.status(400).json({ message: "No categories specified" });
      }
      
      const categoryList = categories.split(',');
      const games = await storage.getGamesByCategory(categoryList);
      res.json(games);
    } catch (error) {
      console.error("Error fetching games by category:", error);
      res.status(500).json({ message: "Error fetching games by category" });
    }
  });

  app.get("/api/games/:id", async (req, res) => {
    try {
      const game = await storage.getGameById(parseInt(req.params.id));
      if (!game) return res.status(404).json({ message: "Game not found" });
      res.json(game);
    } catch (error) {
      console.error("Error fetching game:", error);
      res.status(500).json({ message: "Error fetching game" });
    }
  });

  // Admin middleware to check if user is an admin
  const isAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      // Check if user ID is in request
      const userId = req.body.userId || req.query.userId || req.params.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized - User ID not provided" });
      }
      
      // Get user from database
      const user = await storage.getUser(parseInt(userId));
      
      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: "Forbidden - Admin access required" });
      }
      
      next();
    } catch (error) {
      console.error("Admin authorization error:", error);
      res.status(500).json({ message: "Server error during authorization" });
    }
  };

  // Admin endpoint to delete a user
  app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userIdToDelete = parseInt(req.params.id);
      await storage.deleteUser(userIdToDelete);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin endpoint to delete a game
  app.delete("/api/admin/games/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteGame(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting game:", error);
      res.status(500).json({ message: "Failed to delete game" });
    }
  });

  // Debug endpoint - no auth check, just returns dummy data
  app.get("/api/admin/user-stats/debug", (req, res) => {
    console.log("Debug user stats endpoint called");
    res.setHeader('Content-Type', 'application/json');
    
    // Return dummy data
    return res.json({
      success: true,
      users: {
        total: 42,
        byRegion: {
          "North America": 20,
          "Europe": 15,
          "Asia": 7
        },
        byLanguage: {
          "English": 30,
          "Spanish": 8,
          "French": 4
        }
      },
      activeUsers: {
        daily: 15,
        weekly: 28,
        monthly: 38
      }
    });
  });

  // Get user statistics for admin dashboard - completely rewritten
  app.get("/api/admin/user-stats", async (req, res) => {
    // Always set JSON content type to avoid HTML responses
    res.setHeader('Content-Type', 'application/json');
    
    try {
      // Extract user ID from query parameter
      const userId = req.query.userId;
      
      // Basic validation
      if (!userId || typeof userId !== 'string') {
        return res.status(401).json({ 
          success: false, 
          message: "Unauthorized: User ID missing or invalid" 
        });
      }
      
      // Get user from database
      const userIdNumber = parseInt(userId);
      if (isNaN(userIdNumber)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid user ID format" 
        });
      }
      
      const user = await storage.getUser(userIdNumber);
      
      // Check if user exists and is an admin
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }
      
      if (!user.isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: "Access denied: Admin privileges required" 
        });
      }
      
      // Get the statistics data
      const userStats = await storage.getUserStatsByRegionAndLanguage();
      const activeUserCounts = await storage.getActiveUserCounts();
      
      // Return success response
      return res.status(200).json({
        success: true,
        users: userStats,
        activeUsers: activeUserCounts
      });
    } catch (error) {
      console.error("Error getting user statistics:", error);
      
      // Return error response
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get games by region statistics for admin dashboard
  app.get("/api/admin/games-by-region", async (req, res) => {
    // Always set JSON content type to avoid HTML responses
    res.setHeader('Content-Type', 'application/json');
    
    try {
      // Extract user ID from query parameter
      const userId = req.query.userId;
      
      // Basic validation
      if (!userId || typeof userId !== 'string') {
        return res.status(401).json({ 
          success: false, 
          message: "Unauthorized: User ID missing or invalid" 
        });
      }
      
      // Get user from database
      const userIdNumber = parseInt(userId);
      if (isNaN(userIdNumber)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid user ID format" 
        });
      }
      
      const user = await storage.getUser(userIdNumber);
      
      // Check if user exists and is an admin
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }
      
      if (!user.isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: "Access denied: Admin privileges required" 
        });
      }
      
      // Get the actual games by region data from storage
      const gamesByRegion = await storage.getGamesPlayedByRegion();
      
      // Return success response with real data
      return res.status(200).json({
        success: true,
        gamesByRegion
      });
    } catch (error) {
      console.error("Error getting games by region statistics:", error);
      
      // Return error response
      return res.status(500).json({
        success: false,
        message: "Error retrieving games data from database",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Admin endpoint to add a new game
  app.post("/api/admin/games", isAdmin, async (req, res) => {
    try {
      const gameData = insertGameSchema.parse(req.body.game);
      const newGame = await storage.createGame(gameData);
      res.status(201).json(newGame);
    } catch (error) {
      console.error("Error adding game:", error);
      res.status(400).json({ message: "Failed to add game", error: String(error) });
    }
  });

  // Debug endpoint - no auth check, just returns plain text
  app.get("/api/admin/debug-text", (req, res) => {
    console.log("Debug text endpoint called");
    res.setHeader('Content-Type', 'text/plain');
    return res.send("This is a plain text response to test if proxy is interfering");
  });

  // Redirect any signup requests to the auth route
  app.post("/api/signup", (req, res) => {
    res.redirect(307, '/api/auth/signup');
  });

  // Debug endpoint - no auth check, returns the request details for inspection
  app.get("/api/admin/debug-echo", (req, res) => {
    console.log("Debug echo endpoint called");
    res.setHeader('Content-Type', 'application/json');
    
    // Return information about the request
    return res.json({
      success: true,
      request: {
        path: req.path,
        method: req.method,
        headers: req.headers,
        query: req.query,
        ip: req.ip
      }
    });
  });

  const httpServer = createServer(app);
  setupWebSocket(httpServer);

  return httpServer;
}
