import express, { Request, Response } from 'express';
import { db } from '../db'; // Import your database connection
import { insertUserSchema, users, User } from '@shared/schema';
import { eq } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
    }
  }
});

const router = express.Router();

// Handle image upload
router.post('/upload', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get server URL from request
    const protocol = req.protocol;
    const host = req.get('host');
    
    // Return the full URL for the uploaded file
    const imageUrl = `${protocol}://${host}/api/users/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    
    // Handle specific multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size must be less than 2MB' });
      }
    }
    
    res.status(500).json({ message: error.message || 'Error uploading file' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    console.log("Request Body:", req.body);
    
    // Add validation for empty fields
    if (!req.body.username?.trim() || 
        !req.body.password?.trim() ||
        !req.body.language?.trim() || 
        !req.body.region?.trim() || 
        !req.body.currentGame?.trim() || 
        !req.body.currentGameId?.trim()) {
      return res.status(400).json({ 
        message: 'All required fields must be filled',
        errors: {
          username: !req.body.username?.trim() ? "Username is required" : undefined,
          password: !req.body.password?.trim() ? "Password is required" : undefined,
          language: !req.body.language?.trim() ? "Language is required" : undefined,
          region: !req.body.region?.trim() ? "Region is required" : undefined,
          currentGame: !req.body.currentGame?.trim() ? "Current game is required" : undefined,
          currentGameId: !req.body.currentGameId?.trim() ? "Current game ID is required" : undefined,
        }
      });
    }

    // Check if username already exists
    const existingUser = await db.select().from(users).where(eq(users.username, req.body.username));
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Ensure gamesPlayed is a string array
    const gamesPlayed = Array.isArray(req.body.gamesPlayed) 
      ? req.body.gamesPlayed.filter((game: unknown): game is string => typeof game === 'string')
      : [];

    // Create user data with proper types
    const userInput = {
      username: String(req.body.username),
      password: hashedPassword,
      language: String(req.body.language),
      region: String(req.body.region),
      gamesPlayed: JSON.stringify(gamesPlayed),
      currentGame: String(req.body.currentGame),
      currentGameId: String(req.body.currentGameId),
      profilePicture: req.body.profilePicture ? String(req.body.profilePicture) : null,
    };

    const validatedData = insertUserSchema.parse(userInput);
    
    // Parse gamesPlayed back to array for database insertion
    const newUser = {
      ...validatedData,
      gamesPlayed: JSON.parse(validatedData.gamesPlayed as unknown as string) as string[],
    };

    const result = await db.insert(users).values(newUser).returning();
    console.log("Result after insert:", result);

    // Log the user in after creation
    return new Promise((resolve, reject) => {
      req.logIn(result[0], (err) => {
        if (err) {
          console.error('Error logging in after user creation:', err);
          reject(err);
          return;
        }
        // Don't send password back to client
        const { password, ...userWithoutPassword } = result[0];
        res.status(201).json(userWithoutPassword);
        resolve();
      });
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod Validation Errors:", error.errors);
      return res.status(400).json({ 
        message: 'Invalid user data', 
        errors: error.errors 
      });
    }
    console.error("Database or other error:", error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update user endpoint
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const updates: Partial<Omit<User, 'gamesPlayed'>> & { gamesPlayed?: unknown } = { ...req.body };

    // Remove username and password from updates if present
    delete updates.username;
    delete updates.password;

    // Get current user data
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Handle gamesPlayed field
    let gamesPlayedArray: string[] = currentUser.gamesPlayed || [];
    
    if (updates.gamesPlayed) {
      if (Array.isArray(updates.gamesPlayed)) {
        // Merge new games with existing ones, removing duplicates
        gamesPlayedArray = Array.from(new Set([...gamesPlayedArray, ...updates.gamesPlayed.filter((game): game is string => typeof game === 'string')]));
      } else if (typeof updates.gamesPlayed === 'string') {
        try {
          const parsed = JSON.parse(updates.gamesPlayed);
          if (Array.isArray(parsed)) {
            // Merge new games with existing ones, removing duplicates
            gamesPlayedArray = Array.from(new Set([...gamesPlayedArray, ...parsed.filter((game): game is string => typeof game === 'string')]));
          }
        } catch (e) {
          console.error('Error parsing gamesPlayed:', e);
        }
      }
    }

    // Create the update data with properly typed fields
    const { gamesPlayed: _, ...otherUpdates } = updates;
    const updateData = {
      ...otherUpdates,
      gamesPlayed: gamesPlayedArray,
      lastActive: new Date(),
    };

    console.log('Updating user with data:', updateData); // Debug log

    const result = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    if (!result.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't send password back to client
    const { password, ...userWithoutPassword } = result[0];
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ 
      message: 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
});

// Update user password
router.patch('/:id/password', async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = parseInt(req.params.id, 10);

    // Validate input
    if (!currentPassword || !newPassword || isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid request parameters' });
    }

    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Change password endpoint
router.post('/:id/change-password', async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = parseInt(req.params.id, 10);

    // Validate input
    if (!oldPassword || !newPassword || isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid request parameters' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const allUsers = await db.query.users.findMany();
    // Don't send passwords back to client
    const usersWithoutPasswords = allUsers.map(({ password, ...user }) => user);
    res.json(usersWithoutPasswords);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      message: 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined 
    });
  }
});

// Serve uploaded files
router.use('/uploads', express.static(uploadsDir));

export default router; 