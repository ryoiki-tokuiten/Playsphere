// client/src/pages/watch-page.tsx
// Watch page component that displays game-specific video content from YouTube and Twitch

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  platform: 'youtube' | 'twitch';
  url: string;
}

export default function WatchPage() {
  const { user } = useAuth();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);

  // Set initial selected game to user's current game
  useEffect(() => {
    if (user?.currentGame && !selectedGame) {
      console.log('Setting initial game to current game:', user.currentGame);
      setSelectedGame(user.currentGame);
    }
  }, [user?.currentGame]);

  // Fetch videos when a game is selected
  const { data: videoData, isLoading: videosLoading } = useQuery({
    queryKey: ['videos', selectedGame],
    queryFn: async () => {
      if (!selectedGame) return [];
      console.log('Fetching videos for game:', selectedGame);
      try {
        const response = await apiRequest({
          url: `/api/videos/${encodeURIComponent(selectedGame)}`,
          method: 'GET'
        });
        console.log('Video API response:', response);
        return response as Video[];
      } catch (error) {
        console.error('Error fetching videos:', error);
        throw error;
      }
    },
    enabled: !!selectedGame
  });

  // Update videos state when data changes
  useEffect(() => {
    if (videoData) {
      console.log('Setting videos:', videoData);
      setVideos(videoData);
    }
  }, [videoData]);

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Please log in to view game content</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Watch Game Videos</h1>
      
      <div className="flex flex-wrap gap-2 mb-6">
        {user.gamesPlayed?.map((game) => (
          <Button
            key={game}
            variant={selectedGame === game ? "default" : "outline"}
            className={`rounded-full ${game === user.currentGame ? 'border-primary' : ''}`}
            onClick={() => setSelectedGame(game)}
          >
            {game} {game === user.currentGame && '(Current)'}
          </Button>
        ))}
        {(!user.gamesPlayed || user.gamesPlayed.length === 0) && (
          <p className="text-muted-foreground">No games added to your profile yet. Add games from your profile page.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videosLoading ? (
          <p className="col-span-full text-center text-muted-foreground">Loading videos...</p>
        ) : videos.length > 0 ? (
          videos.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              <CardContent className="p-0">
                <a 
                  href={video.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img 
                    src={video.thumbnail} 
                    alt={video.title}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold line-clamp-2">{video.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {video.channelTitle} • {new Date(video.publishedAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {video.platform}
                      </span>
                    </div>
                  </div>
                </a>
              </CardContent>
            </Card>
          ))
        ) : selectedGame ? (
          <p className="col-span-full text-center text-muted-foreground">
            No videos found for {selectedGame}
          </p>
        ) : (
          <p className="col-span-full text-center text-muted-foreground">
            Select a game to see related videos
          </p>
        )}
      </div>
    </div>
  );
} 