import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "../hooks/use-auth";
import { useEffect, useState } from "react";
import { deleteIdea, getIdeas, voteForIdea, createIdea, type Idea } from "../lib/api";
import { toast } from "@/components/ui/use-toast";
import { LightbulbIcon, Plus, ChevronDown, ChevronUp, ThumbsUp, Search, Trash2 } from "lucide-react";
import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGames } from "@/hooks/use-games";
import { cn } from "@/lib/utils";

interface IdeasResponse {
  ideas: Idea[];
  totalPages: number;
}

export default function IdeasPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState("");
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expandedIdeas, setExpandedIdeas] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const [gameSearch, setGameSearch] = useState("");
  const { user } = useAuth();

  // Fetch games for the dropdown
  const { data: games } = useGames();

  // Fetch ideas with pagination and proper configuration
  const { data: ideasData, isLoading } = useQuery<IdeasResponse>({
    queryKey: ["ideas", page],
    queryFn: () => getIdeas(page),
    gcTime: 1000 * 60 * 5, // Keep data in garbage collection for 5 minutes
    staleTime: 1000 * 60, // Consider data fresh for 1 minute
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Prefetch next page
  useEffect(() => {
    if (ideasData?.totalPages && page < ideasData.totalPages) {
      queryClient.prefetchQuery({
        queryKey: ["ideas", page + 1],
        queryFn: () => getIdeas(page + 1),
      });
    }
  }, [page, ideasData?.totalPages, queryClient]);

  // Create idea mutation
  const createMutation = useMutation({
    mutationFn: (data: { gameId: number; title: string; description: string }) =>
      createIdea(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      setIsDialogOpen(false);
      setSelectedGame("");
      setSelectedGameId(null);
      setTitle("");
      setDescription("");
      toast({
        title: "Success",
        description: "Idea created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create idea",
        variant: "destructive",
      });
    },
  });

  // Vote mutation with optimistic updates
  const voteMutation = useMutation({
    mutationFn: (ideaId: number) => voteForIdea(ideaId),
    onMutate: async (ideaId) => {
      await queryClient.cancelQueries({ queryKey: ["ideas"] });
      const previousData = queryClient.getQueryData(["ideas", page]);

      queryClient.setQueryData(["ideas", page], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          ideas: old.ideas.map((idea: Idea) =>
            idea.id === ideaId
              ? { ...idea, votes: idea.votes + 1, hasVoted: true }
              : idea
          ),
        };
      });

      return { previousData };
    },
    onError: (err, ideaId, context) => {
      queryClient.setQueryData(["ideas", page], context?.previousData);
      toast({
        title: "Error",
        description: "Failed to vote for idea",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteIdea(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      toast({
        title: "Success",
        description: "Idea deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete idea",
        variant: "destructive",
      });
    },
  });

  const toggleIdea = (id: string) => {
    setExpandedIdeas(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredGames = games?.filter(game => 
    game.name.toLowerCase().includes(gameSearch.toLowerCase())
  ) || [];

  const handleSubmit = () => {
    if (!selectedGameId || !title || !description) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      gameId: selectedGameId,
      title,
      description,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="bg-muted/50 p-6 mb-8">
        <p className="text-lg leading-relaxed">
          Ever thought, 'This game would be perfect with just one more thing?' Maybe a new game mode, some extra content, or a way to power up your character? Here, you can share your ideas directly with the game developers. If your suggestion gets 100+ votes from other players, we'll send it to the company for you!
        </p>
      </Card>

      <div className="mb-8">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Request a feature
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Feature Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Game name</label>
                <Select
                  value={selectedGameId?.toString()}
                  onValueChange={(value) => {
                    const game = games?.find(g => g.id === parseInt(value));
                    if (game) {
                      setSelectedGameId(game.id);
                      setSelectedGame(game.name);
                      setGameSearch(""); // Reset search when a game is selected
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a game" />
                  </SelectTrigger>
                  <SelectContent 
                    onKeyDown={(e) => {
                      // Ignore special keys
                      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
                          e.key === 'Enter' || e.key === 'Escape' ||
                          e.key === 'Tab') {
                        return;
                      }
                      // Handle backspace
                      if (e.key === 'Backspace') {
                        setGameSearch(prev => prev.slice(0, -1));
                        return;
                      }
                      // Add character to search if it's a single character
                      if (e.key.length === 1) {
                        setGameSearch(prev => prev + e.key);
                      }
                    }}
                  >
                    <ScrollArea className="h-[200px]">
                      {filteredGames.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2 text-center">
                          No games found
                        </p>
                      ) : (
                        filteredGames.map(game => (
                          <SelectItem key={game.id} value={game.id.toString()}>
                            {game.name}
                          </SelectItem>
                        ))
                      )}
                    </ScrollArea>
                  </SelectContent>
                </Select>
                {selectedGame && (
                  <p className="text-sm text-muted-foreground">Selected: {selectedGame}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Request title</label>
                <Input
                  placeholder="Short summary of your request"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Describe your suggestion</label>
                <Textarea
                  placeholder="Detailed description of your feature request..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="h-32"
                />
                <p className="text-xs text-muted-foreground">
                  {description.split(" ").length}/300 words
                </p>
              </div>
              <Button 
                className="w-full" 
                onClick={handleSubmit}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Submitting..." : "Request"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {ideasData?.ideas.map(idea => (
            <Card key={idea.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{idea.title} - {idea.gameName}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={idea.hasVoted ? "default" : "outline"}
                    size="sm"
                    onClick={() => voteMutation.mutate(idea.id)}
                    disabled={voteMutation.isPending}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    {idea.votes}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleIdea(idea.id.toString())}
                  >
                    {expandedIdeas.includes(idea.id.toString()) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  {user?.isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(idea.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {expandedIdeas.includes(idea.id.toString()) && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm">{idea.description}</p>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Posted by {idea.creatorUsername} on {new Date(idea.createdAt).toLocaleDateString()}
                    </p>
                    {user?.isAdmin && idea.gameContact && (
                      <p className="text-xs text-muted-foreground">
                        Game Contact: {idea.gameContact}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {ideasData && ideasData.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={page === ideasData.totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
} 