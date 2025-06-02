import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddGameForm } from '@/components/admin/add-game-form';
import { Shield, Trash2, Home, Search, Plus, Settings, LogOut, Users, Activity, Globe, MessageSquare, Gamepad2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Interface for user statistics
interface UserStats {
  users: {
    byRegion: Record<string, number>;
    byLanguage: Record<string, number>;
    total: number;
  };
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
    quarterly: number;
  };
}

// Interface for games by region statistics
interface GamesByRegion {
  byRegion: Record<string, Record<string, number>>;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { user, isAdmin, isAuthenticated, isLoading, logout } = useAuth();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [gamesByRegion, setGamesByRegion] = useState<GamesByRegion | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Fetch user statistics
  useEffect(() => {
    if (isAuthenticated && isAdmin && activeTab === 'overview' && user?.id) {
      setIsLoadingStats(true);
      setError(null);
      
      // Fetch real user statistics from the server
      fetch(`/api/admin/user-stats?userId=${user.id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      })
        .then(response => {
          if (!response.ok) {
            return response.text().then(text => {
              console.error('Error response body:', text);
              try {
                // Try to parse as JSON anyway
                const errorData = JSON.parse(text);
                throw new Error(errorData.message || `Failed with status ${response.status}`);
              } catch (e) {
                // If it's not valid JSON, throw with the status
                throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
              }
            });
          }
          return response.json();
        })
        .then(data => {
          console.log('Received stats data:', data);
          
          // Handle the response structure
          if (data && data.success === true) {
            setUserStats(data);
          } else {
            throw new Error(data.message || 'Unknown error in data');
          }
        })
        .catch(err => {
          console.error('Error fetching user statistics:', err);
          setError(`${err.message}`);
        })
        .finally(() => {
          setIsLoadingStats(false);
        });
        
      // Fetch games by region statistics
      fetch(`/api/admin/games-by-region?userId=${user.id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      })
        .then(response => {
          if (!response.ok) {
            return response.text().then(text => {
              console.error('Error response body:', text);
              try {
                // Try to parse as JSON anyway
                const errorData = JSON.parse(text);
                throw new Error(errorData.message || `Failed with status ${response.status}`);
              } catch (e) {
                // If it's not valid JSON, throw with the status
                throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
              }
            });
          }
          return response.json();
        })
        .then(data => {
          console.log('Received games by region data:', data);
          
          // Handle the response structure
          if (data && data.success === true) {
            setGamesByRegion(data.gamesByRegion);
            
            // Set default selected region if there are regions available
            if (data.gamesByRegion?.byRegion && Object.keys(data.gamesByRegion.byRegion).length > 0) {
              setSelectedRegion(Object.keys(data.gamesByRegion.byRegion)[0]);
            }
          } else {
            throw new Error(data.message || 'Unknown error in data');
          }
        })
        .catch(err => {
          console.error('Error fetching games by region statistics:', err);
          // We don't set error state here to avoid replacing the user stats error
        });
    }
  }, [isAuthenticated, isAdmin, activeTab, user?.id]);

  // Calculate colors for game bars - replacing with more subtle, muted colors
  const getGameColor = (index: number) => {
    const colors = [
      'bg-slate-600', 'bg-zinc-600', 'bg-stone-600', 'bg-neutral-600', 
      'bg-gray-700', 'bg-blue-900', 'bg-indigo-900', 'bg-violet-900'
    ];
    return colors[index % colors.length];
  };
  
  // Format the games data for the selected region
  const gamesInSelectedRegion = useMemo(() => {
    if (!gamesByRegion?.byRegion || !selectedRegion) return [];
    
    const regionData = gamesByRegion.byRegion[selectedRegion] || {};
    return Object.entries(regionData)
      .map(([game, count]) => ({ game, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 games
  }, [gamesByRegion, selectedRegion]);
  
  // Get available regions from data
  const availableRegions = useMemo(() => {
    if (!gamesByRegion?.byRegion) return [];
    return Object.keys(gamesByRegion.byRegion).sort();
  }, [gamesByRegion]);
  
  // Get max count for visualizing the games
  const maxGameCount = useMemo(() => {
    if (gamesInSelectedRegion.length === 0) return 0;
    return Math.max(...gamesInSelectedRegion.map(item => item.count));
  }, [gamesInSelectedRegion]);

  // Redirect if user is not authenticated or not an admin
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EC1146]"></div>
        <p className="ml-3">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white pl-16">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between py-6 mb-6">
          <div className="flex items-center">
            <Shield className="text-[#EC1146] h-6 w-6 mr-2" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-[#2D221C] px-4 py-2 rounded-md">
              <span className="text-sm text-gray-400">Logged in as</span>
              <span className="ml-2 font-semibold">{user?.username}</span>
            </div>
            <Button
              variant="outline"
              className="bg-[#2D221C] text-white hover:bg-[#2D221C]/90 border-[#3D322C]"
              onClick={() => window.location.href = '/'}
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            <Button
              variant="outline"
              className="bg-transparent text-white hover:bg-red-800/20 border-red-800/50"
              onClick={logout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <Tabs 
          defaultValue="overview" 
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid grid-cols-3 mb-8 bg-[#2D221C] p-1 rounded-md">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-[#EC1146] data-[state=active]:text-white"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="add-game" 
              className="data-[state=active]:bg-[#EC1146] data-[state=active]:text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Game
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="data-[state=active]:bg-[#EC1146] data-[state=active]:text-white"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="bg-[#2D221C] border-[#EC1146]">
              <CardHeader>
                <CardTitle>User Analytics</CardTitle>
                <CardDescription className="text-gray-400">
                  Platform user statistics and analytics data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingStats ? (
                  <div className="flex justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EC1146]"></div>
                    <p className="ml-3">Loading statistics...</p>
                  </div>
                ) : error ? (
                  <div className="bg-red-950/30 border border-red-500/50 p-4 rounded-md text-center">
                    {error}
                  </div>
                ) : userStats && userStats.users && userStats.activeUsers ? (
                  <div className="space-y-6">
                    {/* Summary Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-[#1A1A1A] p-6 rounded-lg border border-[#3D322C] flex flex-col items-center">
                        <Users className="h-8 w-8 text-white mb-2" />
                        <h3 className="text-xl font-bold">{userStats.users.total}</h3>
                        <p className="text-gray-400">Total Users</p>
                      </div>
                      
                      <div className="bg-[#1A1A1A] p-6 rounded-lg border border-[#3D322C] flex flex-col items-center">
                        <Activity className="h-8 w-8 text-white mb-2" />
                        <h3 className="text-xl font-bold">{userStats.activeUsers.daily}</h3>
                        <p className="text-gray-400">Active Today</p>
                      </div>
                      
                      <div className="bg-[#1A1A1A] p-6 rounded-lg border border-[#3D322C] flex flex-col items-center">
                        <Activity className="h-8 w-8 text-white mb-2" />
                        <h3 className="text-xl font-bold">{userStats.activeUsers.weekly}</h3>
                        <p className="text-gray-400">Active This Week</p>
                      </div>

                      <div className="bg-[#1A1A1A] p-6 rounded-lg border border-[#3D322C] flex flex-col items-center">
                        <Activity className="h-8 w-8 text-white mb-2" />
                        <h3 className="text-xl font-bold">{userStats.activeUsers.monthly}</h3>
                        <p className="text-gray-400">Active This Month</p>
                      </div>
                    </div>
                    
                    {/* Users by Region */}
                    <div className="bg-[#1A1A1A] p-6 rounded-lg border border-[#3D322C]">
                      <div className="flex items-center mb-4">
                        <h3 className="text-lg font-semibold">Users by Region</h3>
                      </div>
                      
                      {Object.keys(userStats.users.byRegion).length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {Object.entries(userStats.users.byRegion)
                            .sort((a, b) => b[1] - a[1]) // Sort by count descending
                            .map(([region, count]) => (
                              <div key={region} className="bg-[#0F0F0F] p-3 rounded-md flex justify-between items-center">
                                <span className="text-sm font-medium">{region}</span>
                                <span className="bg-[#EC1146] px-2 py-1 rounded-md text-xs font-bold">{count}</span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-center">No region data available</p>
                      )}
                    </div>
                    
                    {/* Users by Language */}
                    <div className="bg-[#1A1A1A] p-6 rounded-lg border border-[#3D322C]">
                      <div className="flex items-center mb-4">
                        <h3 className="text-lg font-semibold">Users by Language</h3>
                      </div>
                      
                      {Object.keys(userStats.users.byLanguage).length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {Object.entries(userStats.users.byLanguage)
                            .sort((a, b) => b[1] - a[1]) // Sort by count descending
                            .map(([language, count]) => (
                              <div key={language} className="bg-[#0F0F0F] p-3 rounded-md flex justify-between items-center">
                                <span className="text-sm font-medium">{language}</span>
                                <span className="bg-[#EC1146] px-2 py-1 rounded-md text-xs font-bold">{count}</span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-center">No language data available</p>
                      )}
                    </div>
                    
                    {/* Games by Region */}
                    <div className="bg-[#1A1A1A] p-6 rounded-lg border border-[#3D322C]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <Gamepad2 className="h-5 w-5 text-gray-400 mr-2" />
                          <h3 className="text-lg font-semibold">Games Distribution</h3>
                        </div>
                        
                        {availableRegions.length > 0 && (
                          <div className="flex items-center">
                            <Select 
                              value={selectedRegion || undefined} 
                              onValueChange={setSelectedRegion}
                            >
                              <SelectTrigger className="w-36 bg-[#0F0F0F] border-[#3D322C]">
                                <SelectValue placeholder="Select Region" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#0F0F0F] border-[#3D322C]">
                                {availableRegions.map(region => (
                                  <SelectItem key={region} value={region}>
                                    {region}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      
                      {gamesInSelectedRegion.length > 0 ? (
                        <div className="mt-4 relative">
                          {/* Chart title */}
                          <div className="text-center text-sm font-medium text-gray-400 mb-4">
                            Game Distribution in {selectedRegion}
                          </div>
                          
                          {/* X-axis with ticks and labels */}
                          <div className="h-[400px] relative border-b border-l border-gray-700">
                            {/* X-axis ticks and labels */}
                            <div className="absolute bottom-0 left-0 right-4 flex justify-between">
                              {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
                                <div key={tick} className="relative">
                                  <div className="absolute bottom-0 w-[1px] h-2 bg-gray-700" style={{left: '50%'}}></div>
                                  <div className="absolute bottom-[-20px] text-xs text-gray-500 transform -translate-x-1/2" style={{left: '50%'}}>
                                    {Math.floor(maxGameCount * tick)}
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* X-axis title */}
                            <div className="absolute bottom-[-40px] left-0 right-0 text-center text-xs text-gray-400">
                              Number of Players
                            </div>
                            
                            {/* Y-axis title */}
                            <div className="absolute top-1/2 left-[-30px] transform -rotate-90 text-xs text-gray-400 whitespace-nowrap" style={{transformOrigin: 'center'}}>
                              Games
                            </div>
                            
                            {/* Function plot - game bubbles positioned according to player count */}
                            <div className="absolute inset-4 bottom-4">
                              {gamesInSelectedRegion.map((item, index) => {
                                // Calculate the x position based on player count (percentage of max count)
                                const xPos = `${Math.min(Math.max(5, (item.count / maxGameCount) * 100), 95)}%`;
                                // Calculate y position to distribute evenly in the available space
                                const yPos = `${(index / (gamesInSelectedRegion.length - 1 || 1)) * 100}%`;
                                
                                return (
                                  <div 
                                    key={item.game}
                                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-md text-xs font-medium text-white shadow-lg cursor-pointer
                                              transition-all duration-300 hover:scale-105 hover:shadow-xl 
                                              flex items-center justify-center ${getGameColor(index)}`}
                                    style={{
                                      left: xPos,
                                      top: yPos,
                                      padding: '6px 10px',
                                      minWidth: '60px',
                                      maxWidth: '140px',
                                      animation: `fadeIn 0.5s ease-out ${index * 0.1}s both`
                                    }}
                                    onMouseEnter={() => {
                                      const tooltip = document.getElementById(`tooltip-game-${index}`);
                                      if (tooltip) tooltip.style.opacity = '1';
                                    }}
                                    onMouseLeave={() => {
                                      const tooltip = document.getElementById(`tooltip-game-${index}`);
                                      if (tooltip) tooltip.style.opacity = '0';
                                    }}
                                  >
                                    <span className="truncate block text-center w-full">{item.game}</span>
                                    
                                    {/* Enhanced Tooltip */}
                                    <div 
                                      id={`tooltip-game-${index}`}
                                      className="fixed z-50 bg-[#0A0A0A]/95 border border-gray-800 p-3 rounded-md shadow-xl opacity-0 transition-opacity duration-300 pointer-events-none"
                                      style={{
                                        bottom: '20px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: '220px'
                                      }}
                                    >
                                      <p className="font-bold mb-1">{item.game}</p>
                                      <div className="grid grid-cols-2 gap-x-4 text-sm">
                                        <p><span className="text-gray-400">Region:</span> {selectedRegion}</p>
                                        <p><span className="text-gray-400">Players:</span> {item.count}</p>
                                        <p><span className="text-gray-400">% of Max:</span> {Math.round((item.count / maxGameCount) * 100)}%</p>
                                        <p><span className="text-gray-400">Ranking:</span> #{index + 1}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Horizontal guide lines */}
                            {gamesInSelectedRegion.map((_, index) => {
                              const yPos = `${(index / (gamesInSelectedRegion.length - 1 || 1)) * 100}%`;
                              return (
                                <div 
                                  key={`guide-${index}`} 
                                  className="absolute left-0 right-0 h-[1px] bg-gray-800/30"
                                  style={{ top: yPos }}
                                ></div>
                              );
                            })}
                            
                            {/* Vertical guide lines */}
                            {[0.25, 0.5, 0.75].map((tick) => (
                              <div 
                                key={`vguide-${tick}`} 
                                className="absolute top-0 bottom-0 w-[1px] bg-gray-800/30"
                                style={{ left: `${tick * 100}%` }}
                              ></div>
                            ))}
                          </div>
                          
                          {/* Legend */}
                          <div className="flex flex-wrap justify-center gap-2 mt-14 text-xs">
                            {gamesInSelectedRegion.map((item, index) => (
                              <div key={`legend-${index}`} className="flex items-center">
                                <div className={`w-3 h-3 rounded-full mr-1 ${getGameColor(index)}`}></div>
                                <span className="truncate max-w-[100px]">{item.game}</span>
                                <span className="ml-1 text-gray-500">({item.count})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : selectedRegion ? (
                        <div className="py-16 flex flex-col items-center justify-center">
                          <Gamepad2 className="h-12 w-12 text-gray-700 mb-3 opacity-50" />
                          <p className="text-gray-400 text-center">No game data available for {selectedRegion}</p>
                          <p className="text-gray-500 text-sm mt-2">Users in this region haven't played any games yet.</p>
                        </div>
                      ) : (
                        <div className="py-16 flex flex-col items-center justify-center">
                          <Globe className="h-12 w-12 text-gray-700 mb-3 opacity-50" />
                          <p className="text-gray-400 text-center">Select a region to view game distribution</p>
                          <p className="text-gray-500 text-sm mt-2">Game statistics will be displayed based on the selected region.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">No data available</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="add-game">
            <Card className="bg-[#2D221C] border-[#EC1146]">
              <CardHeader>
                <CardTitle>Add New Game</CardTitle>
                <CardDescription className="text-gray-400">
                  Add a new game to the platform's database.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddGameForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="bg-[#2D221C] border-[#EC1146]">
              <CardHeader>
                <CardTitle>Admin Settings</CardTitle>
                <CardDescription className="text-gray-400">
                  System administration settings and account management.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-[#1A1A1A] p-6 rounded-lg border border-[#3D322C]">
                    <h3 className="text-lg font-semibold mb-2">Admin Account</h3>
                    <p className="text-gray-400 mb-4">
                      You are the system administrator with user ID: {user?.id}. Your account has all privileges enabled.
                    </p>
                    <div className="bg-[#0F0F0F] p-4 rounded-md border border-[#3D322C] mb-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-sm text-gray-400">Username:</span>
                          <p>{user?.username}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-400">User ID:</span>
                          <p>{user?.id}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-400">Region:</span>
                          <p>{user?.region}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-400">Language:</span>
                          <p>{user?.language}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">
                      Note: This section is reserved for future administrative functionality. More settings will be available in future updates.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 