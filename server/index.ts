import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from 'express-session';
import passport from 'passport';
import { setupPassport } from './passport';
import { pool } from './db';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import connectPgSimple from 'connect-pg-simple';
import memorystore from 'memorystore';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import videosRouter from './routes/videos';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? false 
    : ['http://localhost:5000'],
  credentials: true,
}));

// Session configuration
const PgSession = connectPgSimple(session);
const MemoryStore = memorystore(session);

const sessionStore = process.env.NODE_ENV === 'production'
  ? new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    })
  : new MemoryStore({
      checkPeriod: 1000 * 60 * 60 * 24, // prune expired entries every 24h
    });

// Session middleware
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
    name: 'playsphere.sid',
  })
);

// Authentication middleware
app.use(passport.initialize());
app.use(passport.session());
setupPassport();

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// API routes
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/videos', videosRouter);

// Error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Start server
(async () => {
  const server = registerRoutes(app);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = parseInt(process.env.PORT || '5000', 10);
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();
