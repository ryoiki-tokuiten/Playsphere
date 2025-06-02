import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User } from '@shared/schema';
import { GamingCard } from '@/components/gaming-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatWindow } from '@/components/chat-window';
import { Search, User as UserIcon, LogOut, ChevronRight, SlidersHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useLocation } from 'wouter';
import { ExpandedUserCard } from '@/components/expanded-user-card';

export default function HomePage() {
  const [sortBy, setSortBy] = useState<string>('recent');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showChatWith, setShowChatWith] = useState<User | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showEditCard, setShowEditCard] = useState(false);
  const [expandedUser, setExpandedUser] = useState<User | null>(null);
  const [, setLocation] = useLocation();
  const [chatMinimized, setChatMinimized] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Add event listener for chat events from search page
  useEffect(() => {
    const handleChatEvent = (event: Event) => {
      const { userId } = (event as CustomEvent).detail;
      const userToChat = users.find(user => user.id === userId);
      if (userToChat) {
        setShowChatWith(userToChat);
      }
    };

    window.addEventListener('openChat', handleChatEvent as EventListener);
    
    return () => {
      window.removeEventListener('openChat', handleChatEvent as EventListener);
    };
  }, [users]);

  // Check for chatWithUserId in sessionStorage
  useEffect(() => {
    if (users.length && !isLoading) {
      const chatWithUserId = sessionStorage.getItem('chatWithUserId');
      if (chatWithUserId) {
        const userToChat = users.find(user => user.id === parseInt(chatWithUserId));
        if (userToChat) {
          setShowChatWith(userToChat);
          // Clear the sessionStorage after using it
          sessionStorage.removeItem('chatWithUserId');
        }
      }
    }
  }, [users, isLoading]);

  // Extract unique regions and languages
  const { regions, languages } = useMemo(() => {
    const regionsSet = new Set<string>();
    const languagesSet = new Set<string>();
    
    users.forEach(user => {
      if (user.region) regionsSet.add(user.region);
      if (user.language) languagesSet.add(user.language);
    });

    return {
      regions: Array.from(regionsSet).sort(),
      languages: Array.from(languagesSet).sort(),
    };
  }, [users]);

  const filteredUsers = users
    .filter(user => user.id !== currentUser.id)
    .filter(user => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        user.username.toLowerCase().includes(query) ||
        user.currentGame.toLowerCase().includes(query) ||
        user.region.toLowerCase().includes(query) ||
        user.language.toLowerCase().includes(query)
      );
    })
    .filter(user => {
      // If no regions selected, show all
      if (selectedRegions.length === 0) return true;
      return selectedRegions.includes(user.region);
    })
    .filter(user => {
      // If no languages selected, show all
      if (selectedLanguages.length === 0) return true;
      return selectedLanguages.includes(user.language);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
        case 'game':
          return a.currentGame.localeCompare(b.currentGame);
        default:
          return 0;
      }
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f0f0f]">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white pl-16">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between py-6 mb-6">
          <h1 className="text-2xl font-bold">Playsphere</h1>
          <div className="flex gap-4 items-center">
            <Button
              variant="outline"
              className="bg-[#2D221C] text-white hover:bg-[#2D221C]/90"
              onClick={() => setLocation('/edit')}
            >
              <UserIcon className="h-5 w-5 mr-2" />
              My Card
            </Button>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-[#2D221C] text-white hover:bg-[#2D221C]/90">
                  <SlidersHorizontal className="h-5 w-5 mr-2" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px] bg-[#2D221C] text-white border-[#EC1146]">
                <DropdownMenuCheckboxItem
                  checked={sortBy === 'recent'}
                  onCheckedChange={() => setSortBy('recent')}
                >
                  Most Recent
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={sortBy === 'game'}
                  onCheckedChange={() => setSortBy('game')}
                >
                  By Game
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Region Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-[#2D221C] text-white hover:bg-[#2D221C]/90">
                  {selectedRegions.length > 0 
                    ? `${selectedRegions.length} Region${selectedRegions.length > 1 ? 's' : ''}`
                    : 'Region'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px] bg-[#2D221C] text-white border-[#EC1146]">
                <DropdownMenuItem 
                  onClick={() => setSelectedRegions([])}
                  className="justify-between"
                >
                  All Regions
                  {selectedRegions.length === 0 && <span>✓</span>}
                </DropdownMenuItem>
                {regions.map(region => (
                  <DropdownMenuCheckboxItem
                    key={region}
                    checked={selectedRegions.includes(region)}
                    onCheckedChange={(checked) => {
                      setSelectedRegions(prev => 
                        checked 
                          ? [...prev, region]
                          : prev.filter(r => r !== region)
                      );
                    }}
                  >
                    {region}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Language Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-[#2D221C] text-white hover:bg-[#2D221C]/90">
                  {selectedLanguages.length > 0
                    ? `${selectedLanguages.length} Language${selectedLanguages.length > 1 ? 's' : ''}`
                    : 'Language'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px] bg-[#2D221C] text-white border-[#EC1146]">
                <DropdownMenuItem 
                  onClick={() => setSelectedLanguages([])}
                  className="justify-between"
                >
                  All Languages
                  {selectedLanguages.length === 0 && <span>✓</span>}
                </DropdownMenuItem>
                {languages.map(language => (
                  <DropdownMenuCheckboxItem
                    key={language}
                    checked={selectedLanguages.includes(language)}
                    onCheckedChange={(checked) => {
                      setSelectedLanguages(prev =>
                        checked
                          ? [...prev, language]
                          : prev.filter(l => l !== language)
                      );
                    }}
                  >
                    {language}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Logout Button */}
            <Button
              variant="outline"
              className="bg-[#2D221C] text-white hover:bg-[#2D221C]/90"
              onClick={() => {
                localStorage.removeItem('user');
                window.location.reload();
              }}
            >
              <LogOut className="h-5 w-5 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <GamingCard
              key={user.id}
              user={user}
              onChatClick={() => setShowChatWith(user)}
              onCardClick={() => setExpandedUser(user)}
            />
          ))}
        </div>
      </div>

      {showChatWith && (
        <ChatWindow
          currentUser={currentUser}
          otherUser={showChatWith}
          onClose={() => setShowChatWith(null)}
          isMinimized={chatMinimized}
          onMinimize={() => setChatMinimized(!chatMinimized)}
        />
      )}

      {expandedUser && (
        <ExpandedUserCard
          user={expandedUser}
          onClose={() => setExpandedUser(null)}
        />
      )}
    </div>
  );
}