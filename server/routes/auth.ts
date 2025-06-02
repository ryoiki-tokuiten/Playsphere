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

    // If this is the initial signup (not the setup completion)
    if (!userData.language || !userData.region) {
      // Store the username and hashed password for later use
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const pendingAuth = {
        ...userData,
        password: hashedPassword
      };
      
      // Store hashed password in session
      req.session.pendingAuth = pendingAuth;
      
      return res.json({ redirect: 'setup' });
    }

    // Get the stored pending auth data with hashed password
    const pendingAuth = req.session.pendingAuth;
    if (!pendingAuth) {
      return res.status(400).json({ message: 'No pending authentication data found' });
    }

    // Create new user with the previously hashed password
    const userDataWithHash = {
      ...userData,
      password: pendingAuth.password // Use the previously hashed password
    };

    // Create the new user
    const newUser = await storage.createUser(userDataWithHash);
    
    // Clear pending auth data
    delete req.session.pendingAuth;
    
    // Log the user in after creation
    req.logIn(newUser, (err) => {
      if (err) {
        console.error('Error logging in after user creation:', err);
        return res.status(500).json({ message: 'Failed to log in after account creation' });
      }
      
      // Don't send password back to client
      const { password, ...userWithoutPassword } = newUser;
      return res.status(201).json(userWithoutPassword);
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