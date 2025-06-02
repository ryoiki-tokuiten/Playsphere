import { users, messages, groups, groupMembers, games, ideas, ideaVotes, type User, type InsertUser, type Message, type Group, type InsertGroup, type GroupMember, type InsertGroupMember, type Game, type InsertGame, type Idea, type InsertIdea, type IdeaWithRelations } from "@shared/schema";
import { db } from "./db";
import { eq, or, and, desc, inArray, gte, lt, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  getActiveUsers(): Promise<User[]>;
  setUserAsAdmin(username: string): Promise<User>;
  
  // Message operations
  getMessages(fromUserId: number, toUserId: number): Promise<Message[]>;
  getGroupMessages(groupId: number): Promise<Message[]>;
  createMessage(message: Omit<Message, "id">): Promise<Message>;
  
  // Group operations
  createGroup(group: InsertGroup): Promise<Group>;
  getGroup(id: number): Promise<Group | undefined>;
  getUserGroups(userId: number): Promise<Group[]>;
  deleteGroup(groupId: number, userId: number): Promise<boolean>;
  transferGroupOwnership(groupId: number, currentOwnerId: number, newOwnerId: number): Promise<boolean>;
  
  // Group membership operations
  getGroupMembers(groupId: number): Promise<User[]>;
  addGroupMember(groupMember: InsertGroupMember): Promise<void>;
  removeGroupMember(groupId: number, userId: number): Promise<boolean>;
  isGroupMember(groupId: number, userId: number): Promise<boolean>;
  isGroupOwner(groupId: number, userId: number): Promise<boolean>;
  
  // Game operations
  getAllGames(): Promise<Game[]>;
  getGameById(id: number): Promise<Game | undefined>;
  getGamesByCategory(categories: string[]): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  deleteGame(id: number): Promise<void>;
  
  // User statistics operations
  getUserStatsByRegionAndLanguage(): Promise<{
    byRegion: Record<string, number>;
    byLanguage: Record<string, number>;
    total: number;
  }>;
  getActiveUserCounts(): Promise<{
    daily: number;
    weekly: number;
    monthly: number;
    quarterly: number;
  }>;
  getGamesPlayedByRegion(): Promise<{
    byRegion: Record<string, Record<string, number>>;
  }>;

  // Idea operations
  getIdeas(userId: number, page: number, limit: number): Promise<{ ideas: IdeaWithRelations[], total: number }>;
  createIdea(idea: InsertIdea): Promise<IdeaWithRelations>;
  toggleIdeaVote(ideaId: number, userId: number): Promise<IdeaWithRelations>;
  deleteIdea(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Existing user methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        username: insertUser.username,
        password: insertUser.password,
        language: insertUser.language,
        region: insertUser.region,
        currentGame: insertUser.currentGame,
        currentGameId: insertUser.currentGameId,
        gamesPlayed: sql`${JSON.stringify(insertUser.gamesPlayed)}::json`,
        lastActive: new Date(),
      })
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const updateValues: any = {
      ...updates,
      lastActive: new Date(),
    };

    if (updates.gamesPlayed) {
      updateValues.gamesPlayed = sql`${JSON.stringify(updates.gamesPlayed)}::json`;
    }

    const [user] = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    try {
      // Step 1: Delete all messages where the user is the sender or receiver
      await db
        .delete(messages)
        .where(
          or(
            eq(messages.fromUserId, id),
            eq(messages.toUserId, id)
          )
        );
      
      // Step 2: Get all groups where this user is the owner
      const groupsOwnedByUser = await db
        .select()
        .from(groups)
        .where(eq(groups.ownerId, id));
      
      // Step 3: For each group owned by this user:
      for (const group of groupsOwnedByUser) {
        // 3a: Delete all messages in the group
        await db
          .delete(messages)
          .where(eq(messages.groupId, group.id));
          
        // 3b: Delete ALL memberships for this group (not just the user's)
        await db
          .delete(groupMembers)
          .where(eq(groupMembers.groupId, group.id));
      }
      
      // Step 4: Delete all groups owned by this user
      // (now safe since we've removed all memberships)
      await db
        .delete(groups)
        .where(eq(groups.ownerId, id));
      
      // Step 5: Delete memberships of this user in groups they don't own
      await db
        .delete(groupMembers)
        .where(eq(groupMembers.userId, id));
      
      // Step 6: Finally, delete the user
      await db.delete(users).where(eq(users.id, id));
      
      console.log(`User with ID ${id} and all related data successfully deleted`);
    } catch (error) {
      console.error(`Error deleting user with ID ${id}:`, error);
      throw new Error(`Failed to delete user: ${(error as Error).message}`);
    }
  }

  async getActiveUsers(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .orderBy(desc(users.lastActive));
  }

  async setUserAsAdmin(username: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isAdmin: true })
      .where(eq(users.username, username))
      .returning();
    
    if (!user) throw new Error("User not found");
    return user;
  }

  // Existing and modified message methods
  async getMessages(fromUserId: number, toUserId: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(
        or(
          and(
            eq(messages.fromUserId, fromUserId),
            eq(messages.toUserId, toUserId)
          ),
          and(
            eq(messages.fromUserId, toUserId),
            eq(messages.toUserId, fromUserId)
          )
        )
      )
      .orderBy(messages.timestamp);
  }

  async getGroupMessages(groupId: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.groupId, groupId))
      .orderBy(messages.timestamp);
  }

  async createMessage(message: Omit<Message, "id">): Promise<Message> {
    const [createdMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    return createdMessage;
  }

  // New group methods
  async createGroup(group: InsertGroup): Promise<Group> {
    const [createdGroup] = await db
      .insert(groups)
      .values(group)
      .returning();
    
    // Add the owner as the first member
    await this.addGroupMember({
      groupId: createdGroup.id,
      userId: group.ownerId
    });
    
    return createdGroup;
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, id));
    return group;
  }

  async getUserGroups(userId: number): Promise<Group[]> {
    // Get all groups where the user is a member
    const memberships = await db
      .select({
        groupId: groupMembers.groupId
      })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));

    if (memberships.length === 0) {
      return [];
    }

    // Get the group details
    return db
      .select()
      .from(groups)
      .where(inArray(groups.id, memberships.map(m => m.groupId)));
  }

  async deleteGroup(groupId: number, userId: number): Promise<boolean> {
    // Check if the user is the owner of the group
    const isOwner = await this.isGroupOwner(groupId, userId);
    if (!isOwner) {
      return false;
    }

    // Delete group members first (due to foreign key constraints)
    await db
      .delete(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    // Delete group messages
    await db
      .delete(messages)
      .where(eq(messages.groupId, groupId));

    // Delete the group
    await db
      .delete(groups)
      .where(eq(groups.id, groupId));
    
    return true;
  }

  async transferGroupOwnership(groupId: number, currentOwnerId: number, newOwnerId: number): Promise<boolean> {
    // Verify that the user is the current owner
    const isOwner = await this.isGroupOwner(groupId, currentOwnerId);
    if (!isOwner) {
      return false;
    }
    
    // Verify that the new owner is a member of the group
    const isMember = await this.isGroupMember(groupId, newOwnerId);
    if (!isMember) {
      return false;
    }
    
    // Update the group owner
    await db
      .update(groups)
      .set({ ownerId: newOwnerId })
      .where(eq(groups.id, groupId));
    
    return true;
  }

  // Group membership methods
  async getGroupMembers(groupId: number): Promise<User[]> {
    const memberships = await db
      .select({
        userId: groupMembers.userId
      })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    
    if (memberships.length === 0) {
      return [];
    }
    
    return db
      .select()
      .from(users)
      .where(inArray(users.id, memberships.map(m => m.userId)));
  }

  async addGroupMember(groupMember: InsertGroupMember): Promise<void> {
    // Check if the user is already a member of the group
    const isMember = await this.isGroupMember(groupMember.groupId, groupMember.userId);
    if (isMember) {
      return; // User is already a member, no need to add again
    }
    
    await db
      .insert(groupMembers)
      .values(groupMember);
  }

  async removeGroupMember(groupId: number, userId: number): Promise<boolean> {
    // Check if the user is a member of the group
    const isMember = await this.isGroupMember(groupId, userId);
    if (!isMember) {
      return false;
    }
    
    // Check if the user is the owner
    const isOwner = await this.isGroupOwner(groupId, userId);
    if (isOwner) {
      return false; // Owners cannot be removed, they must transfer ownership first
    }
    
    await db
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId)
        )
      );
    
    return true;
  }

  async isGroupMember(groupId: number, userId: number): Promise<boolean> {
    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId)
        )
      );
    
    return !!membership;
  }

  async isGroupOwner(groupId: number, userId: number): Promise<boolean> {
    const [group] = await db
      .select()
      .from(groups)
      .where(
        and(
          eq(groups.id, groupId),
          eq(groups.ownerId, userId)
        )
      );
    
    return !!group;
  }

  // Game methods
  async getAllGames(): Promise<Game[]> {
    return await db.select().from(games);
  }

  async getGameById(id: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game;
  }

  async getGamesByCategory(categories: string[]): Promise<Game[]> {
    // This is a simplified approach - in production, you'd need a more sophisticated query
    // to match JSON array contents, which varies by database
    const allGames = await this.getAllGames();
    return allGames.filter(game => {
      const gameCategories = game.categories as string[];
      return categories.some(category => gameCategories.includes(category));
    });
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const [game] = await db
      .insert(games)
      .values({
        name: insertGame.name,
        contact: insertGame.contact,
        downloads: insertGame.downloads,
        categories: sql`${JSON.stringify(insertGame.categories)}::json`,
        platforms: sql`${JSON.stringify(insertGame.platforms)}::json`,
      })
      .returning();
    return game;
  }

  async deleteGame(id: number): Promise<void> {
    await db.delete(games).where(eq(games.id, id));
  }

  // User statistics methods
  async getUserStatsByRegionAndLanguage(): Promise<{
    byRegion: Record<string, number>;
    byLanguage: Record<string, number>;
    total: number;
  }> {
    // Initialize return object
    const results = {
      byRegion: {} as Record<string, number>,
      byLanguage: {} as Record<string, number>,
      total: 0
    };
    
    // Get all users
    const allUsers = await db.select().from(users);
    results.total = allUsers.length;
    
    // Count by region
    for (const user of allUsers) {
      if (user.region) {
        results.byRegion[user.region] = (results.byRegion[user.region] || 0) + 1;
      }
      
      if (user.language) {
        results.byLanguage[user.language] = (results.byLanguage[user.language] || 0) + 1;
      }
    }
    
    return results;
  }
  
  async getActiveUserCounts(): Promise<{
    daily: number;
    weekly: number;
    monthly: number;
    quarterly: number;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    // Users active in the last 24 hours
    const dailyActive = await db
      .select()
      .from(users)
      .where(gte(users.lastActive, oneDayAgo));
    
    // Users active in the last 7 days
    const weeklyActive = await db
      .select()
      .from(users)
      .where(gte(users.lastActive, oneWeekAgo));
    
    // Users active in the last 30 days
    const monthlyActive = await db
      .select()
      .from(users)
      .where(gte(users.lastActive, oneMonthAgo));

    // Users active in the last 90 days
    const quarterlyActive = await db
      .select()
      .from(users)
      .where(gte(users.lastActive, threeMonthsAgo));
    
    return {
      daily: dailyActive.length,
      weekly: weeklyActive.length,
      monthly: monthlyActive.length,
      quarterly: quarterlyActive.length
    };
  }
  
  /**
   * Gets the distribution of games played across different regions
   * Returns a mapping of regions to games and their counts
   */
  async getGamesPlayedByRegion(): Promise<{
    byRegion: Record<string, Record<string, number>>;
  }> {
    const result: {
      byRegion: Record<string, Record<string, number>>;
    } = {
      byRegion: {}
    };

    try {
      // Get all users with their region and gamesPlayed using Drizzle ORM
      // Using a different approach to avoid ORM-specific issues
      const allUsers = await db
        .select({
          region: users.region,
          gamesPlayed: users.gamesPlayed
        })
        .from(users);

      // Filter users with non-null gamesPlayed
      const usersWithGames = allUsers.filter(user => user.gamesPlayed != null);

      // Initialize regions if they don't exist in the result
      for (const user of usersWithGames) {
        if (user.region && !result.byRegion[user.region]) {
          result.byRegion[user.region] = {};
        }
      }

      // Count games played by region
      for (const user of usersWithGames) {
        if (!user.region || !user.gamesPlayed) continue;
        
        // Parse gamesPlayed if needed
        let gamesPlayedArray: string[] = [];
        
        if (typeof user.gamesPlayed === 'string') {
          try {
            gamesPlayedArray = JSON.parse(user.gamesPlayed);
          } catch (e) {
            console.error(`Failed to parse gamesPlayed for user in region ${user.region}:`, e);
            continue;
          }
        } else if (Array.isArray(user.gamesPlayed)) {
          gamesPlayedArray = user.gamesPlayed;
        }
        
        // Count each game
        for (const game of gamesPlayedArray) {
          if (typeof game === 'string') {
            if (!result.byRegion[user.region][game]) {
              result.byRegion[user.region][game] = 0;
            }
            result.byRegion[user.region][game]++;
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error in getGamesPlayedByRegion:', error);
      throw error;
    }
  }

  // Idea methods
  async getIdeas(userId: number, page: number, limit: number): Promise<{ ideas: IdeaWithRelations[], total: number }> {
    const offset = (page - 1) * limit;
    const ideasAlias = alias(ideas, "i");

    const result = await db.query.ideas.findMany({
      with: {
        game: true,
        creator: true,
      },
      extras: {
        has_voted: sql<boolean>`EXISTS(
          SELECT 1 FROM ${ideaVotes} v 
          WHERE v.idea_id = ${ideasAlias.id} AND v.user_id = ${userId}
        )`.as("has_voted"),
      },
      orderBy: [
        desc(ideas.votes),
        desc(ideas.createdAt),
      ],
      limit,
      offset,
    });

    const [{ count }] = await db.select({ count: sql<number>`count(*)`.as("count") }).from(ideas);

    return {
      ideas: result.map((idea: any) => ({
        id: idea.id,
        gameId: idea.gameId,
        userId: idea.userId,
        title: idea.title,
        description: idea.description,
        votes: idea.votes,
        createdAt: idea.createdAt,
        game: idea.game ?? { 
          id: -1, 
          name: 'Deleted Game',
          categories: [],
          platforms: [],
          contact: null,
          downloads: null
        },
        creator: idea.creator ?? {
          id: -1,
          username: 'Deleted User',
          password: '',
          profilePicture: null,
          isAdmin: false,
          lastActive: new Date(),
          region: null,
          language: null,
          gamesPlayed: []
        },
        game_name: idea.game?.name ?? 'Deleted Game',
        game_contact: idea.game?.contact ?? null,
        creator_username: idea.creator?.username ?? 'Deleted User',
        has_voted: idea.has_voted,
      })) as IdeaWithRelations[],
      total: Number(count),
    };
  }

  async createIdea(idea: InsertIdea): Promise<IdeaWithRelations> {
    // Insert the idea and get the created record
    const [createdIdea] = await db
      .insert(ideas)
      .values(idea)
      .returning();

    // Fetch the complete idea with relations
    const [completeIdea] = await db.query.ideas.findMany({
      where: eq(ideas.id, createdIdea.id),
      with: {
        game: true,
        creator: true,
      },
      extras: {
        has_voted: sql<boolean>`false`.as("has_voted"),
      },
    });

    if (!completeIdea) {
      throw new Error("Failed to create idea");
    }

    // Return the idea with the correct field names
    return {
      ...completeIdea,
      game_name: completeIdea.game.name,
      creator_username: completeIdea.creator.username,
      has_voted: false,
    } as IdeaWithRelations;
  }

  async toggleIdeaVote(ideaId: number, userId: number): Promise<IdeaWithRelations> {
    try {
      // Begin transaction
      return await db.transaction(async (tx) => {
        console.log(`Toggling vote for idea ${ideaId} by user ${userId}`);
        
        // Check if user has already voted
        const [existingVote] = await tx
          .select()
          .from(ideaVotes)
          .where(and(
            eq(ideaVotes.ideaId, ideaId),
            eq(ideaVotes.userId, userId)
          ));

        console.log('Existing vote:', existingVote);

        if (existingVote) {
          // Remove vote
          console.log('Removing vote');
          await tx
            .delete(ideaVotes)
            .where(and(
              eq(ideaVotes.ideaId, ideaId),
              eq(ideaVotes.userId, userId)
            ));

          await tx
            .update(ideas)
            .set({ votes: sql`votes - 1` })
            .where(eq(ideas.id, ideaId));
        } else {
          // Add vote
          console.log('Adding vote');
          await tx
            .insert(ideaVotes)
            .values({ ideaId, userId, createdAt: new Date() });

          await tx
            .update(ideas)
            .set({ votes: sql`votes + 1` })
            .where(eq(ideas.id, ideaId));
        }

        // Get updated idea with vote status
        const [updatedIdea] = await tx.query.ideas.findMany({
          where: eq(ideas.id, ideaId),
          with: {
            game: true,
            creator: true,
          },
          extras: {
            has_voted: sql<boolean>`EXISTS(
              SELECT 1 FROM ${ideaVotes} v 
              WHERE v.idea_id = ${ideas.id} AND v.user_id = ${userId}
            )`.as("has_voted"),
          },
        });

        if (!updatedIdea) {
          throw new Error("Idea not found");
        }

        console.log('Updated idea:', updatedIdea);

        return {
          ...updatedIdea,
          game_name: updatedIdea.game.name,
          creator_username: updatedIdea.creator.username,
          has_voted: updatedIdea.has_voted,
        } as IdeaWithRelations;
      });
    } catch (error) {
      console.error('Error in toggleIdeaVote:', error);
      throw error;
    }
  }

  async deleteIdea(id: number): Promise<void> {
    // First delete all votes for this idea
    await db.delete(ideaVotes).where(eq(ideaVotes.ideaId, id));
    // Then delete the idea itself
    await db.delete(ideas).where(eq(ideas.id, id));
  }
}

export const storage = new DatabaseStorage();