import { User } from '@shared/schema';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Copy, MessageCircle, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { ShareCardModal } from './share-card-modal';

interface ExpandedUserCardProps {
  user: User;
  onClose: () => void;
}

export function ExpandedUserCard({ user, onClose }: ExpandedUserCardProps) {
  const { toast } = useToast();
  const [showShareModal, setShowShareModal] = useState(false);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const copyGameId = () => {
    navigator.clipboard.writeText(user.currentGameId);
    toast({
      title: "Copied!",
      description: "Game ID copied to clipboard",
    });
  };

  const fallbackInitial = user?.username ? user.username[0].toUpperCase() : '?';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <Card className="w-full max-w-2xl bg-[#0f0f0f] text-white overflow-hidden">
        <CardHeader className="bg-[#2D221C] py-4 px-6 flex flex-row justify-between items-center">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.profilePicture || undefined} alt={user?.username} />
              <AvatarFallback>{fallbackInitial}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold">{user?.username}</h2>
              <div className="flex gap-2 text-sm text-gray-400">
                <span>{user?.language}</span>
                <span>•</span>
                <span>{user?.region}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowShareModal(true)}
              className="text-[#EC1146]"
            >
              <Share2 className="h-5 w-5" />
            </Button>
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
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-[#2D221C]">
                <div className="text-sm text-gray-400 mb-2">Currently Playing</div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{user?.currentGame}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyGameId}
                    className="text-[#EC1146]"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {user?.currentGameId}
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Games Played</h3>
                <div className="grid grid-cols-2 gap-2">
                  {user.gamesPlayed.map((game) => (
                    <div
                      key={game}
                      className="p-2 rounded bg-[#2D221C] text-sm"
                    >
                      {game}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Last Active</h3>
                <div className="text-sm text-gray-400">
                  {new Date(user.lastActive).toLocaleString()}
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <ShareCardModal
        user={user}
        open={showShareModal}
        onOpenChange={setShowShareModal}
      />
    </div>
  );
} 