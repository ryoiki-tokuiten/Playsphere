import { User } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Copy, MessageCircle, Share2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { ShareCardModal } from './share-card-modal';
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
import { useAuth } from '@/hooks/use-auth';
import { useQueryClient } from '@tanstack/react-query';

interface GamingCardProps {
  user: User;
  onChatClick?: () => void;
  onCardClick?: () => void;
  isEditable?: boolean;
  onUserDeleted?: () => void;
}

// Function to check if user is active (within last 5 minutes)
function isUserActive(lastActive: Date): boolean {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return new Date(lastActive) > fiveMinutesAgo;
}

export function GamingCard({ 
  user, 
  onChatClick, 
  onCardClick, 
  isEditable = false, 
  onUserDeleted 
}: GamingCardProps) {
  const { toast } = useToast();
  const { user: currentUser, isAdmin } = useAuth();
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const copyGameId = () => {
    navigator.clipboard.writeText(user.currentGameId);
    toast({
      title: "Copied!",
      description: "Game ID copied to clipboard",
    });
  };

  const fallbackInitial = user?.username ? user.username[0].toUpperCase() : '?';

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card click if clicking on a button
    if (!(e.target as HTMLElement).closest('button')) {
      onCardClick?.();
    }
  };

  const handleDeleteUser = async () => {
    if (!currentUser || !isAdmin) return;
    
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.id // For admin verification
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete user');
      }
      
      toast({
        title: 'User Deleted',
        description: `User "${user.username}" has been deleted.`,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      // Call the callback if provided
      if (onUserDeleted) {
        onUserDeleted();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete user.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Determine background color based on user activity
  const isActive = isUserActive(user.lastActive);
  const bgColor = isActive ? '#07412382' : '#250d11';

  return (
    <>
      <Card 
        className="w-full max-w-sm text-white cursor-pointer hover:opacity-90 transition-colors duration-200 border border-[#eb0028]"
        onClick={handleCardClick}
        style={{ backgroundColor: bgColor }}
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={user?.profilePicture || undefined} alt={user?.username} />
              <AvatarFallback>{fallbackInitial}</AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">{user?.username}</h3>
              <div className="flex gap-2 text-sm text-white/70">
                <span>{user?.language}</span>
                <span>•</span>
                <span>{user?.region}</span>
              </div>
            </div>

            <div className="flex gap-1">
              {/* Admin Delete Button */}
              {isAdmin && currentUser?.id !== user.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="text-white hover:bg-red-800/20"
                >
                  <Trash2 className="h-5 w-5 text-red-500" />
                </Button>
              )}
              
              {!isEditable && onChatClick && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChatClick();
                  }}
                  className="text-white hover:text-white/90"
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShareModal(true);
                }}
                className="text-white hover:text-white/90"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-black/20 border border-[#eb0028]">
            <div className="text-sm text-white/70">Currently Playing</div>
            <div className="mt-1 flex justify-between items-center">
              <span className="font-medium text-white">{user?.currentGame}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  copyGameId();
                }}
                className="text-white hover:text-white/90"
              >
                <Copy className="h-4 w-4 mr-1" />
                <span>ID</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {showShareModal && (
        <ShareCardModal 
          username={user.username} 
          onClose={() => setShowShareModal(false)} 
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-[#2D221C] text-white border border-red-600">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to delete user "{user.username}"? This will permanently remove their account, card, and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-white border-gray-600 hover:bg-gray-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}