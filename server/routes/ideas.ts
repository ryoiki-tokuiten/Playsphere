import { Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { authenticateToken } from '../passport';
import { type IdeaWithRelations } from '@shared/schema';

const router = Router();

// Schema for creating a new idea
const createIdeaSchema = z.object({
  gameId: z.number(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
});

// Admin middleware
const isAdmin = async (req: any, res: any, next: any) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get all ideas with pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { ideas, total } = await storage.getIdeas(req.user!.id, page, limit);

    res.json({
      ideas: ideas.map((idea: IdeaWithRelations) => ({
        id: idea.id,
        gameId: idea.gameId,
        gameName: idea.game_name,
        gameContact: idea.game.contact,
        title: idea.title,
        description: idea.description,
        votes: idea.votes,
        hasVoted: idea.has_voted,
        creatorUsername: idea.creator_username,
        createdAt: idea.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching ideas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new idea
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { gameId, title, description } = createIdeaSchema.parse(req.body);
    const idea = await storage.createIdea({
      gameId,
      userId: req.user!.id,
      title,
      description,
    });

    res.status(201).json({
      id: idea.id,
      gameId: idea.gameId,
      gameName: idea.game_name,
      title: idea.title,
      description: idea.description,
      votes: idea.votes,
      hasVoted: idea.has_voted,
      creatorUsername: idea.creator_username,
      createdAt: idea.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('Error creating idea:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Vote for an idea
router.post('/:id/vote', authenticateToken, async (req, res) => {
  try {
    const ideaId = parseInt(req.params.id);
    const updatedIdea = await storage.toggleIdeaVote(ideaId, req.user!.id);
    res.json({
      id: updatedIdea.id,
      gameId: updatedIdea.gameId,
      gameName: updatedIdea.game_name,
      title: updatedIdea.title,
      description: updatedIdea.description,
      votes: updatedIdea.votes,
      hasVoted: updatedIdea.has_voted,
      creatorUsername: updatedIdea.creator_username,
      createdAt: updatedIdea.createdAt,
    });
  } catch (error) {
    console.error('Error voting for idea:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an idea (admin only)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const ideaId = parseInt(req.params.id);
    await storage.deleteIdea(ideaId);
    res.json({ message: 'Idea deleted successfully' });
  } catch (error) {
    console.error('Error deleting idea:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 