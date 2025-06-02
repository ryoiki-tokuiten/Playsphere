import { User } from '@shared/schema';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, MessageCircle, Trash2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Game interface to match our database schema
interface Game {
  id: number;
  name: string;
  categories: string[];
  platforms: string[];
  contact: string;
  downloads: number;
}

interface ExpandedGameCardProps {
  game: Game;
  users: User[];
  onClose: () => void;
  onChatClick: (user: User) => void;
  onGameDeleted?: () => void;
}

export function ExpandedGameCard({ game, users, onClose, onChatClick, onGameDeleted }: ExpandedGameCardProps) {
  const { user: currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDeleteGame = async () => {
    if (!currentUser || !isAdmin) return;
    
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/admin/games/${game.id}`, {
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
        description: `Game "${game.name}" has been deleted.`,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['games'] });
      
      // Close the expanded card
      onClose();
      
      // Call callback if provided
      if (onGameDeleted) {
        onGameDeleted();
      }
    } catch (error) {
      console.error('Error deleting game:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete game.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4" onClick={handleBackdropClick}>
      <Card className="w-full max-w-2xl bg-[#0f0f0f] text-white overflow-hidden">
        <CardHeader className="bg-[#2D221C] py-4 px-6 flex flex-row justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">{game.name}</h2>
            <div className="flex gap-2 text-sm text-gray-400">
              <span>{game.platforms.join(', ')}</span>
              <span>•</span>
              <span>{game.downloads?.toLocaleString() || 0} downloads</span>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-white/60 hover:text-red-500"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white/60 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Game categories and platforms */}
          <div className="mb-6">
            <div className="mb-3">
              <h3 className="text-md font-medium mb-2">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {game.categories.map((category, index) => (
                  <span key={index} className="bg-[#2D221C] px-3 py-1 rounded-full text-sm">
                    {category}
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-md font-medium mb-2">Platforms</h3>
              <div className="flex flex-wrap gap-2">
                {game.platforms.map((platform, index) => (
                  <span key={index} className="bg-[#2D221C] px-3 py-1 rounded-full text-sm">
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          <h3 className="text-lg font-medium mb-3">Players with this game</h3>
          <ScrollArea className="h-[calc(100vh-450px)]">
            <div className="space-y-4">
              {users.length > 0 ? (
                users.map((user) => (
                  <div key={user.id} className="p-4 rounded-lg bg-[#2D221C] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user?.profilePicture || undefined} alt={user?.username} />
                        <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-sm text-gray-400">
                          {user.region} • {user.language}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onChatClick(user)}
                      className="text-[#EC1146]"
                    >
                      <MessageCircle className="h-5 w-5" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No players found with this game
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-[#2D221C] text-white border border-red-600">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Game</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to delete "{game.name}"? This will permanently remove the game from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-white border-gray-600 hover:bg-gray-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGame}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 