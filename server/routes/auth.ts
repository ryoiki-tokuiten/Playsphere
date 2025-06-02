import express from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import { storage } from '../storage';
import { db } from '../db';
import { users, type User } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Extend express session types
declare module 'express-session' {
  interface SessionData {
    pendingAuth?: {
      username: string;
      password: string;
      [key: string]: any;
    };
  }
}

const router = express.Router();

// Login route
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err: Error | null, user: User | false, info: { message: string }) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ message: info.message });
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      // Don't send password back to client
      const { password, ...userWithoutPassword } = user;
      
      // Log user data for debugging
      console.log('Login successful, user data:', { 
        id: user.id, 
        username: user.username, 
        isAdmin: user.isAdmin 
      });
      
      return res.json({ 
        user: {
          ...userWithoutPassword,
          isAdmin: !!user.isAdmin  // Explicitly include and convert to boolean
        },
        redirect: 'home'  // Add redirect information
      });
    });
  })(req, res, next);
});

// Signup route
router.post('/signup', async (req, res) => {
  try {
    const userData = req.body;
    console.log('Processing signup request:', userData);

    // Check if user exists
    const existingUser = await storage.getUserByUsername(userData.username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    let hashedPasswordToUse: string | undefined;

    // If this is the initial signup (not the setup completion step)
    if (!userData.language || !userData.region) {
      if (!userData.password) {
        return res.status(400).json({ message: 'Password is required for initial signup step' });
      }
      // Store the username and hashed password for later use
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const pendingAuthData = { // Renamed to avoid conflict
        username: userData.username, // Only store necessary fields
        password: hashedPassword
        // Do not store other userData like language/region here as they are not provided yet
      };
      
      // Store necessary pending auth data in session
      req.session.pendingAuth = pendingAuthData;
      
      return res.json({ redirect: 'setup' });
    } else {
      // Language and region are present, this is either setup completion or direct signup
      if (req.session.pendingAuth) {
        if (req.session.pendingAuth.username !== userData.username) {
          return res.status(400).json({ message: 'Session data mismatch. Please try signing up again.' });
        }
        hashedPasswordToUse = req.session.pendingAuth.password;
        delete req.session.pendingAuth; // Clear pending auth data
      } else {
        // No pending session, this must be a direct signup with all data
        if (!userData.password) {
          return res.status(400).json({ message: 'Password is required for direct signup' });
        }
        hashedPasswordToUse = await bcrypt.hash(userData.password, 10);
      }
    }

    if (!hashedPasswordToUse) {
      // This case should ideally not be reached if logic above is correct
      // but serves as a fallback.
      return res.status(400).json({ message: 'Missing password or session. Unable to create user.' });
    }

    // Create new user with the determined hashed password
    const newUserPayload = {
      ...userData, // Contains username, language, region, etc.
      password: hashedPasswordToUse 
    };

    // Create the new user
    const newUser = await storage.createUser(newUserPayload);
    
    // Log the user in after creation
    req.logIn(newUser, (err) => {
      if (err) {
        console.error('Error logging in after user creation:', err);
        return res.status(500).json({ message: 'Failed to log in after account creation' });
      }
      
      // Don't send password back to client
      const { password, ...userWithoutPassword } = newUser;
      return res.status(201).json({ 
        user: {
          ...userWithoutPassword,
          isAdmin: !!userWithoutPassword.isAdmin 
        },
        message: 'User created successfully' // Provide a success message
      });
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ 
      message: 'Failed to create user account',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Logout route
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.json({ message: 'Logged out successfully' });
  });
});

export default router; 