import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { storage } from './storage'; // Import your storage
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      password: string;
      profilePicture: string | null;
      language: string;
      region: string;
      gamesPlayed: string[];
      currentGame: string;
      currentGameId: string;
      lastActive: Date;
      isAdmin: boolean;
    }
  }
}

export function setupPassport() {
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'username', // Use 'username' as the username field
        passwordField: 'password', // You might not have a password field initially
      },
      async (username, password, done) => {
        try {
          const user = await storage.getUserByUsername(username);

          if (!user) {
            return done(null, false, { message: 'Incorrect username.' });
          }

          // Compare password with stored hash
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return done(null, false, { message: 'Incorrect password.' });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id); // Serialize the user ID
  });

  passport.deserializeUser(async (id: any, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // Check if user is authenticated via session
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ error: 'Unauthorized' });
} 