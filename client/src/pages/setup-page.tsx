import { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from '@tanstack/react-query';
import { InsertUser, insertUserSchema } from '@shared/schema';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ImageUpload } from '@/components/image-upload';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { standardLanguages, findClosestLanguage, getLanguageSuggestions } from '@/lib/languages';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES = ['English', 'Spanish', 'Chinese', 'Japanese', 'Korean', 'Portuguese', 'Russian'];
const REGIONS = ['North America', 'South America', 'Europe', 'Asia', 'Oceania'];

// Game categories based on Games.json analysis
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

export default function SetupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortByDownloads, setSortByDownloads] = useState<'asc' | 'desc' | null>(null);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [openLanguage, setOpenLanguage] = useState(false);
  const itemsPerPage = 20;
  
  // Get initial user data from URL if available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const username = params.get('username');
    const password = params.get('password');
    
    if (username) {
      form.setValue('username', username);
    }
    
    if (password) {
      form.setValue('password', password);
    }
  }, []);

  // Fetch games data
  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ['games'],
    queryFn: async () => {
      const res = await fetch('/api/games');
      if (!res.ok) throw new Error('Failed to fetch games');
      return res.json();
    }
  });

  // Filter and sort games based on search query and filters
  const filteredGames = games
    .filter(game => {
      // Filter by search query
      if (searchQuery && !game.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Filter by categories
      if (selectedCategories.length > 0) {
        return selectedCategories.some(category => 
          game.categories.includes(category)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by downloads if selected
      if (sortByDownloads === 'asc') {
        return (a.downloads || 0) - (b.downloads || 0);
      } else if (sortByDownloads === 'desc') {
        return (b.downloads || 0) - (a.downloads || 0);
      }
      
      // Default sort by name
      return a.name.localeCompare(b.name);
    });

  // Pagination
  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
  const paginatedGames = filteredGames.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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

  // Toggle game selection
  const toggleGameSelection = (game: string) => {
    setSelectedGames(prev => 
      prev.includes(game)
        ? prev.filter(g => g !== game)
        : [...prev, game]
    );
  };

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: '',
      password: '',
      language: '',
      region: '',
      currentGame: '',
      currentGameId: '',
      gamesPlayed: [],
    },
  });

  // Load pending auth data on mount
  useEffect(() => {
    const pendingAuth = localStorage.getItem('pendingAuth');
    if (pendingAuth) {
      const { username, password } = JSON.parse(pendingAuth);
      form.setValue('username', username);
      form.setValue('password', password);
    }
  }, [form]);

  // Update the form when selectedGames changes
  useEffect(() => {
    form.setValue('gamesPlayed', selectedGames);
  }, [selectedGames, form]);

  // When a current game is selected, update the currentGameId
  useEffect(() => {
    const currentGameName = form.getValues('currentGame');
    if (currentGameName) {
      const game = games.find(g => g.name === currentGameName);
      if (game) {
        form.setValue('currentGameId', game.id.toString());
      }
    }
  }, [form.getValues('currentGame'), games, form]);

  const setupMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      console.log('Submitting user setup data:', data);
      try {
        const response = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to create account');
        }
        
        const result = await response.json();
        
        // Store user data and redirect to home
        localStorage.setItem('user', JSON.stringify(result));
        // Clear the pending auth data
        localStorage.removeItem('pendingAuth');
        
        // Redirect to home page
        window.location.href = '/';
        
        return result;
      } catch (error) {
        console.error('Signup error:', error);
        throw error;
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create account',
        variant: 'destructive',
      });
    },
  });

  function onSubmit(data: InsertUser) {
    setupMutation.mutate(data);
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Complete Your Profile</h1>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Language</FormLabel>
                    <Popover open={openLanguage} onOpenChange={setOpenLanguage}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openLanguage}
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? standardLanguages.find(
                                  (language) => language === field.value
                                )
                              : "Select language..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search language..." />
                          <CommandEmpty>No language found.</CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-72">
                              {standardLanguages.map((language) => (
                                <CommandItem
                                  value={language}
                                  key={language}
                                  onSelect={() => {
                                    form.setValue("language", language);
                                    setOpenLanguage(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      language === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {language}
                                </CommandItem>
                              ))}
                            </ScrollArea>
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your region" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="profilePicture"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Picture</FormLabel>
                    <FormControl>
                      <ImageUpload 
                        currentImage={field.value || ''} 
                        onImageSelected={field.onChange}
                        maxSize={2 * 1024 * 1024} // 2MB size limit
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div>
              <FormField
                control={form.control}
                name="gamesPlayed"
                render={() => (
                  <FormItem>
                    <FormLabel>Games You Play</FormLabel>
                    <Card>
                      <CardContent className="p-4">
                        {/* Search and filter bar */}
                        <div className="flex space-x-2 mb-4">
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
                          <div className="flex flex-wrap gap-2 mb-4">
                            {selectedCategories.map(category => (
                              <Badge 
                                key={category} 
                                variant="secondary" 
                                className="cursor-pointer" 
                                onClick={() => toggleCategory(category)}
                              >
                                {category} ✕
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        {/* Selected games */}
                        {selectedGames.length > 0 && (
                          <div className="mb-4">
                            <h3 className="text-sm font-medium mb-2">Selected Games:</h3>
                            <div className="flex flex-wrap gap-2">
                              {selectedGames.map(game => (
                                <Badge 
                                  key={game} 
                                  className="cursor-pointer" 
                                  onClick={() => toggleGameSelection(game)}
                                >
                                  {game} ✕
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Game list with scrolling */}
                        {gamesLoading ? (
                          <div className="py-8 text-center">Loading games...</div>
                        ) : (
                          <ScrollArea className="h-[300px]">
                            <div className="space-y-2">
                              {paginatedGames.map((game) => (
                                <div 
                                  key={game.id}
                                  className={`p-2 rounded-md flex items-center justify-between cursor-pointer ${
                                    selectedGames.includes(game.name) 
                                      ? 'bg-primary/10' 
                                      : 'hover:bg-muted'
                                  }`}
                                  onClick={() => toggleGameSelection(game.name)}
                                >
                                  <div>
                                    <div className="font-medium">{game.name}</div>
                                    <div className="text-xs text-muted-foreground flex gap-1 flex-wrap">
                                      {game.categories.map(cat => (
                                        <span key={cat} className="bg-muted px-1 rounded">
                                          {cat}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {game.downloads.toLocaleString()} downloads
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                        
                        {/* Pagination */}
                        {totalPages > 1 && (
                          <div className="flex justify-center mt-4 space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                            >
                              Previous
                            </Button>
                            <span className="py-2 px-3">
                              Page {currentPage} of {totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                            >
                              Next
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Current Game and Game ID fields below the Games You Play card */}
              <div className="mt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="currentGame"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Game</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select current game" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {selectedGames.map((game) => (
                            <SelectItem key={game} value={game}>
                              {game}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="currentGameId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Game ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your game ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setLocation('/')}>
              Cancel
            </Button>
            <Button type="submit" disabled={setupMutation.isPending}>
              {setupMutation.isPending ? 'Creating Account...' : 'Complete Setup'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}