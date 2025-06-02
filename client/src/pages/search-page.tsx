import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MessageCircle, Filter, ArrowUpDown, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { User } from '@shared/schema';
import { ChatWindow } from '@/components/chat-window';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { ExpandedGameCard } from '@/components/expanded-game-card';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

// Game categories based on our Games.json analysis
const CATEGORIES = [
  'Action',
  'RPG',
  'Adventure',
  'Strategy',
  'Simulation',
  'Shooter',
  'Puzzle',
  'Survival',
  'Platformer',
  'Fighting',
  'Racing',
  'Sports'
];

// Game interface to match our database schema
interface Game {
  id: number;
  name: string;
  categories: string[];
  platforms: string[];
  contact: string;
  downloads: number;
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [sortByDownloads, setSortByDownloads] = useState<'asc' | 'desc' | null>(null);
  const itemsPerPage = 20;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser, isAdmin } = useAuth();

  // Fetch users data
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    }
  });

  // Fetch games data
  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ['games'],
    queryFn: async () => {
      const res = await fetch('/api/games');
      if (!res.ok) throw new Error('Failed to fetch games');
      const data = await res.json();
      console.log('Fetched games data:', data);
      return data;
    }
  });

  // Filter and sort games based on search query and filters
  const filteredGames = games
    .filter(game => {
      // Filter by search query
      if (searchQuery && !game.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Filter by selected categories
      if (selectedCategories.length > 0) {
        // Check if the game has at least one of the selected categories
        const hasSelectedCategory = game.categories.some(category => 
          selectedCategories.includes(category)
        );
        if (!hasSelectedCategory) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by downloads if specified
      if (sortByDownloads === 'asc') {
        return (a.downloads || 0) - (b.downloads || 0);
      } else if (sortByDownloads === 'desc') {
        return (b.downloads || 0) - (a.downloads || 0);
      }
      
      // Default sort by name
      return a.name.localeCompare(b.name);
    });

  // Debug information
  useEffect(() => {
    console.log('Games array length:', games.length);
    console.log('Filtered games length:', filteredGames.length);
    console.log('First few filtered games:', filteredGames.slice(0, 3));
  }, [games, filteredGames]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
  const paginatedGames = filteredGames.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  // Toggle category selection
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Toggle sort by downloads
  const toggleSortByDownloads = () => {
    setSortByDownloads(prev => {
      if (prev === null) return 'desc';
      if (prev === 'desc') return 'asc';
      return null;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedCategories([]);
    setSortByDownloads(null);
  };

  // Handle user selection for chat
  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    // When opening a chat, ensure it's not minimized
    setChatMinimized(false);
  };

  // Handle game selection
  const handleGameSelect = (game: Game) => {
    setSelectedGame(game);
    // When opening a game card, minimize any open chat
    if (selectedUser) {
      setChatMinimized(true);
    }
  };

  // Close game card
  const handleCloseGameCard = () => {
    setSelectedGame(null);
  };

  // Reset to user list view
  const handleBackToList = () => {
    setSelectedUser(null);
    setChatMinimized(false);
  };

  // Toggle chat minimized state
  const toggleChatMinimized = () => {
    setChatMinimized(!chatMinimized);
  };

  // Get users who have the selected game
  const getUsersWithGame = (gameName: string) => {
    return users.filter(user => 
      (user.gamesPlayed as string[]).includes(gameName) || 
      user.currentGame === gameName
    );
  };

  // Handle game deletion
  const handleDeleteGame = async (gameId: number, gameName: string) => {
    if (!currentUser || !isAdmin) return;
    
    try {
      const response = await fetch(`/api/admin/games/${gameId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.id // For admin verification
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete game');
      }
      
      toast({
        title: 'Game Deleted',
        description: `Game "${gameName}" has been deleted.`,
      });
      
      // Refresh games data
      queryClient.invalidateQueries({ queryKey: ['games'] });
    } catch (error) {
      console.error('Error deleting game:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete game.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col space-y-4">
        <h1 className="text-2xl font-bold">Find Players</h1>
        
        {/* Search and filter bar */}
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search games..."
              className="pl-8"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Categories filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={e => e.preventDefault()}>
                <div className="font-medium">Categories</div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {CATEGORIES.map(category => (
                <DropdownMenuCheckboxItem
                  key={category}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={() => toggleCategory(category)}
                  onSelect={e => e.preventDefault()}
                >
                  {category}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={clearFilters}>
                Clear filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Sort by downloads toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSortByDownloads}
            className={sortByDownloads ? "bg-secondary" : ""}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Selected category badges */}
        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map(category => (
              <Badge key={category} variant="secondary" className="cursor-pointer" onClick={() => toggleCategory(category)}>
                {category} ✕
              </Badge>
            ))}
          </div>
        )}

        {/* Sort indicator */}
        {sortByDownloads && (
          <div className="text-sm text-muted-foreground">
            Sorting by downloads: {sortByDownloads === 'asc' ? 'lowest first' : 'highest first'}
          </div>
        )}

        {selectedUser && currentUser ? (
          // Chat with selected user
          <div>
            <Button variant="ghost" onClick={handleBackToList} className="mb-4">
              ← Back to player list
            </Button>
            <ChatWindow 
              currentUser={currentUser} 
              otherUser={selectedUser} 
              onClose={handleBackToList} 
              isMinimized={chatMinimized}
              onMinimize={toggleChatMinimized}
            />
          </div>
        ) : gamesLoading ? (
          // Loading state
          <div className="py-8 text-center">Loading games...</div>
        ) : (
          // Game results
          <>
            {/* Display the games */}
            <h2 className="text-xl font-semibold mb-4">Games ({filteredGames.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
              {gamesLoading ? (
                <div className="col-span-full text-center py-10">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  <p className="mt-2 text-white">Loading games...</p>
                </div>
              ) : paginatedGames.length === 0 ? (
                <div className="col-span-full text-center py-10 text-white/70">
                  {searchQuery || selectedCategories.length > 0 ? 
                    "No games match your search criteria." : 
                    "No games found."}
                </div>
              ) : (
                paginatedGames.map(game => (
                  <Card 
                    key={game.id}
                    className="bg-[#2D221C] text-white hover:bg-[#2D221C]/90 transition-colors duration-200 cursor-pointer border border-[#3D322C]"
                    onClick={() => setSelectedGame(game)}
                  >
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-white truncate pr-2">{game.name}</h3>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGame(game.id, game.name);
                            }}
                            className="text-white/60 hover:text-red-500 -mt-1 -mr-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Game categories */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {game.categories.slice(0, 3).map((category, index) => (
                          <span key={index} className="bg-[#1A1A1A] px-2 py-0.5 rounded-sm text-xs">
                            {category}
                          </span>
                        ))}
                        {game.categories.length > 3 && (
                          <span className="bg-[#1A1A1A] px-2 py-0.5 rounded-sm text-xs">
                            +{game.categories.length - 3}
                          </span>
                        )}
                      </div>
                      
                      {/* Game platforms */}
                      <div className="text-sm text-white/70 mb-3">
                        {game.platforms.join(', ')}
                      </div>
                      
                      {/* Game downloads */}
                      <div className="text-sm text-white/60">
                        {game.downloads ? `${game.downloads.toLocaleString()} downloads` : 'No download data'}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
            
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6 mb-10 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="text-white border-[#3D322C] bg-[#2D221C]"
                >
                  Previous
                </Button>
                <div className="text-white flex items-center mx-2">
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="text-white border-[#3D322C] bg-[#2D221C]"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Expanded Game Card */}
      {selectedGame && (
        <ExpandedGameCard
          game={selectedGame}
          users={getUsersWithGame(selectedGame.name)}
          onClose={handleCloseGameCard}
          onChatClick={handleUserSelect}
          onGameDeleted={() => {
            // Refresh games data
            queryClient.invalidateQueries({ queryKey: ['games'] });
          }}
        />
      )}
    </div>
  );
} 