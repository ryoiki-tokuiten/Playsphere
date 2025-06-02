import express, { Router } from 'express';
import serverless from 'serverless-http';
import { setupPassport } from './passport';
import { pool } from './db';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import connectPgSimple from 'connect-pg-simple';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import videosRouter from './routes/videos';

// Create Express app
const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true,
}));

// Session configuration
const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  pool,
  tableName: 'session',
  createTableIfMissing: true,
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
      secure: true,
      sameSite: 'none',
    },
    name: 'playsphere.sid',
  })
);

// Authentication middleware
app.use(passport.initialize());
app.use(passport.session());
setupPassport();

// Create a router for the API
const apiRouter = Router();

// API routes
apiRouter.use('/users', usersRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/videos', videosRouter);

// Mount the API router
app.use('/', apiRouter);

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Export the serverless handler
export const handler = serverless(app);
