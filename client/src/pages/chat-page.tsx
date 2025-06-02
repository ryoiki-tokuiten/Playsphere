import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Message, Group } from '@shared/schema';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWebSocket } from '@/hooks/use-websocket';
import { 
  MessageCircle, 
  Search, 
  Users, 
  Image as ImageIcon, 
  Plus, 
  ArrowLeft, 
  Check, 
  CheckCheck,
  MoreVertical,
  Trash2,
  UserMinus
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { ImageUpload } from '@/components/image-upload';
import { useToast } from '@/hooks/use-toast';
import { CreateGroup } from '@/components/create-group';
import { GroupChat } from '@/components/group-chat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Define the GroupMessage interface
interface GroupMessage extends Omit<Message, 'toUserId'> {
  type: 'groupMessage';
  groupId: number;
}

// Define chat types
interface DirectChat {
  type: 'direct';
  user: User;
}

interface GroupChatType {
  type: 'group';
  group: Group;
}

type ChatType = DirectChat | GroupChatType;

function formatLastActive(lastActive: Date): string {
  const now = new Date();
  const lastActiveDate = new Date(lastActive);
  const diffInMinutes = Math.floor((now.getTime() - lastActiveDate.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 5) {
    return 'Online';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minutes ago`;
  } else if (diffInMinutes < 1440) { // Less than 24 hours
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else {
    const days = Math.floor(diffInMinutes / 1440);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
}

export default function ChatPage() {
  const [selectedChat, setSelectedChat] = useState<ChatType | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewGroupDialogOpen, setIsNewGroupDialogOpen] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeoutRef, setTypingTimeoutRef] = useState<NodeJS.Timeout | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'groups'>('chats');
  const { toast } = useToast();
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteMessageDialog, setShowDeleteMessageDialog] = useState(false);
  const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);

  // Get current user from localStorage
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Fetch all users
  const { data: users = [], refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Fetch user's groups
  const { data: groups = [], refetch: refetchGroups } = useQuery<Group[]>({
    queryKey: [`/api/users/${currentUser.id}/groups`],
    enabled: !!currentUser.id,
  });

  // Filter out current user and apply search
  const filteredUsers = users
    .filter(user => user.id !== currentUser.id)
    .filter(user => {
      if (!searchQuery) return true;
      return user.username.toLowerCase().includes(searchQuery.toLowerCase());
    });

  // Filter groups by search query
  const filteredGroups = groups.filter(group => {
    if (!searchQuery) return true;
    return group.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Improved onMessage function to ensure real-time updates
  const onMessage = useCallback((message: Message) => {
    if (!selectedChat) return;
    
    // Check if the message is relevant to the current chat
    const isRelevantMessage = 
      (selectedChat.type === 'direct' && 
        ((message.fromUserId === currentUser?.id && message.toUserId === selectedChat.user.id) || 
         (message.fromUserId === selectedChat.user.id && message.toUserId === currentUser?.id))) ||
      (selectedChat.type === 'group' && message.groupId === selectedChat.group.id);
    
    if (!isRelevantMessage) return;
    
    // Add message, avoiding duplicates by ID
    setChatMessages(prev => {
      // Check if the message with this ID already exists
      if (prev.some(m => m.id === message.id)) {
        return prev;
      }
      
      // Return new array with the message added
      return [...prev, message];
    });
    
    // Reset typing indicator when receiving a message from the other user
    if (selectedChat.type === 'direct' && message.fromUserId === selectedChat.user.id) {
      setIsTyping(false);
    }
    
    // Update to show the message is read if we're the recipient
    if (message.toUserId === currentUser?.id && !message.isRead) {
      // Mark message as read in the UI (this part depends on your backend API)
      // markMessageAsRead(message.id);
      
      // Here you would also call a function to update read status on the server
    }
    
    // Scroll to bottom after receiving new messages
    scrollToBottom();
  }, [selectedChat, currentUser]);

  // Handle group messages
  const onGroupMessage = (message: GroupMessage) => {
    // We don't need to handle group messages here as they are handled by the GroupChat component
    console.log('Group message received:', message);
  };
  
  // Handle typing status updates
  const onTypingStatus = useCallback((userId: number, isTyping: boolean) => {
    // Only update typing status if we're in a direct chat with this user
    if (selectedChat && selectedChat.type === 'direct' && selectedChat.user.id === userId) {
      setIsTyping(isTyping);
    }
  }, [selectedChat]);

  // Improved WebSocket setup
  const { sendMessage, sendGroupMessage, sendTypingStatus, sendGroupTypingStatus, isConnected } = useWebSocket(
    currentUser?.id || 0, 
    onMessage,
    (groupMessage) => {
      // Handle group messages if needed
      onMessage(groupMessage as unknown as Message);
    },
    (userId, isTyping) => {
      if (selectedChat?.type === 'direct' && selectedChat.user.id === userId) {
        setIsTyping(isTyping);
      }
    },
    (userId, groupId, isTyping) => {
      if (selectedChat?.type === 'group' && selectedChat.group.id === groupId) {
        setTypingUsers(prev => {
          if (isTyping) {
            if (!prev.includes(userId)) {
              return [...prev, userId];
            }
          } else {
            return prev.filter(id => id !== userId);
          }
          return prev;
        });
      }
    }
  );

  // Fetch messages when a chat is selected
  useEffect(() => {
    if (selectedChat && selectedChat.type === 'direct') {
      fetch(`/api/messages/${currentUser.id}/${selectedChat.user.id}`)
        .then(res => res.json())
        .then(data => {
          setChatMessages(data);
          
          // Scroll to bottom after messages load
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        })
        .catch(err => {
          console.error('Error fetching chat messages:', err);
          setChatMessages([]);
        });
    } else {
      setChatMessages([]);
    }
  }, [selectedChat, currentUser.id]);

  // Improved scroll handling
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatMessages.length > 0) {
      scrollToBottom();
    }
  }, [chatMessages]);

  // Handle message send
  const handleSendMessage = () => {
    if (!selectedChat || !messageInput.trim()) return;
    
    // Create a temporary message to display immediately
    const tempMessage: Message = {
      id: Date.now(), // Temporary ID
      fromUserId: currentUser.id,
      toUserId: selectedChat.type === 'direct' ? selectedChat.user.id : 0,
      groupId: selectedChat.type === 'group' ? selectedChat.group.id : null,
      content: messageInput.trim(),
      timestamp: new Date(),
      isRead: false,
      readAt: null,
      type: 'text'
    };
    
    // Clear input immediately for better UX
    setMessageInput('');
    
    // Add the message to the UI immediately
    setChatMessages(prev => [...prev, tempMessage]);
    
    // Then send via WebSocket
    if (selectedChat.type === 'direct') {
      sendMessage(selectedChat.user.id, messageInput.trim());
    } else if (selectedChat.type === 'group') {
      sendGroupMessage(selectedChat.group.id, messageInput.trim());
    }
    
    // Ensure scroll to bottom
    setTimeout(() => scrollToBottom(), 50);
  };

  // Handle image upload completion
  const handleImageUploaded = (imageUrl: string) => {
    if (!selectedChat) return;
    
    // Create a temporary message to display immediately
    const tempMessage: Message = {
      id: Date.now(), // Temporary ID
      fromUserId: currentUser.id,
      toUserId: selectedChat.type === 'direct' ? selectedChat.user.id : 0,
      groupId: selectedChat.type === 'group' ? selectedChat.group.id : null,
      content: `![image](${imageUrl})`,
      timestamp: new Date(),
      isRead: false,
      readAt: null,
      type: 'image'
    };
    
    // Add the message to the UI immediately
    setChatMessages(prev => [...prev, tempMessage]);
    
    // Then send via WebSocket
    if (selectedChat.type === 'direct') {
      sendMessage(selectedChat.user.id, `![image](${imageUrl})`);
    } else if (selectedChat.type === 'group') {
      sendGroupMessage(selectedChat.group.id, `![image](${imageUrl})`);
    }
    
    setShowImageUpload(false);
  };

  // Function to handle typing in the message input
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    // Only send typing status if we're in a chat and have input
    if (selectedChat && e.target.value) {
      // Clear any existing timeout
      if (typingTimeoutRef) {
        clearTimeout(typingTimeoutRef);
      }
      
      // Send typing status based on chat type
      if (selectedChat.type === 'direct') {
        sendTypingStatus(selectedChat.user.id, true);
        
        // Set a timeout to stop the typing indicator after 1.5 seconds of inactivity
        const timeout = setTimeout(() => {
          if (selectedChat && selectedChat.type === 'direct') {
            sendTypingStatus(selectedChat.user.id, false);
          }
        }, 1500);
        
        setTypingTimeoutRef(timeout);
      } else if (selectedChat.type === 'group') {
        sendGroupTypingStatus(selectedChat.group.id, true);
        
        // Set a timeout to stop the typing indicator after 1.5 seconds of inactivity
        const timeout = setTimeout(() => {
          if (selectedChat && selectedChat.type === 'group') {
            sendGroupTypingStatus(selectedChat.group.id, false);
          }
        }, 1500);
        
        setTypingTimeoutRef(timeout);
      }
    }
  };

  // Cleanup typing status when component unmounts or chat changes
  useEffect(() => {
    return () => {
      // Send false typing status when unmounting
      if (selectedChat && typingTimeoutRef) {
        clearTimeout(typingTimeoutRef);
        
        if (selectedChat.type === 'direct') {
          sendTypingStatus(selectedChat.user.id, false);
        } else if (selectedChat.type === 'group') {
          sendGroupTypingStatus(selectedChat.group.id, false);
        }
      }
    };
  }, [selectedChat]);

  // Handle WebSocket typing status updates
  const onGroupTypingStatus = useCallback((groupId: number, userId: number, isTyping: boolean) => {
    // Only update typing status if we're in this group chat and it's not the current user
    if (
      selectedChat && 
      selectedChat.type === 'group' && 
      selectedChat.group.id === groupId && 
      userId !== currentUser.id
    ) {
      if (isTyping) {
        setTypingUsers(prev => [...prev, userId]);
      } else {
        setTypingUsers(prev => prev.filter(id => id !== userId));
      }
    }
  }, [selectedChat, currentUser.id]);

  // Format message timestamp
  const formatMessageTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = 
      date.getDate() === now.getDate() && 
      date.getMonth() === now.getMonth() && 
      date.getFullYear() === now.getFullYear();
    
    const isYesterday = 
      date.getDate() === yesterday.getDate() && 
      date.getMonth() === yesterday.getMonth() && 
      date.getFullYear() === yesterday.getFullYear();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (isYesterday) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  };

  // Render message content (text or image)
  const renderMessageContent = (content: string) => {
    const imageMatch = content.match(/!\[image\]\((.*?)\)/);
    if (imageMatch && imageMatch[1]) {
      return <img src={imageMatch[1]} alt="Shared image" className="max-w-full max-h-64 rounded-lg" />;
    }
    return content;
  };

  // Handle group creation
  const handleGroupCreated = (newGroup: Group) => {
    toast({
      title: "Group Created",
      description: `Group "${newGroup.name}" has been created.`,
    });
    setIsNewGroupDialogOpen(false);
    refetchGroups();
    setActiveTab('groups');
    setSelectedGroup(newGroup);
    setSelectedChat(null);
  };

  // Function to delete a message
  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;
    
    try {
      const response = await fetch(`/api/messages/${messageToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.id
        })
      });
      
      if (response.ok) {
        // Remove the message from the UI
        setChatMessages(prev => prev.filter(msg => msg.id !== messageToDelete.id));
        
        toast({
          title: "Success",
          description: "Message deleted successfully",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete message",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive"
      });
    }
    
    setMessageToDelete(null);
    setShowDeleteMessageDialog(false);
  };
  
  // Function to delete a user from chats
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      const response = await fetch(`/api/users/${userToDelete.id}/chat`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.id
        })
      });
      
      if (response.ok) {
        // Remove the user from chats - this will be handled by refetching the users query instead
        // Refetch users
        refetchUsers();
        
        // If the deleted user was the selected chat, clear the selection
        if (selectedChat?.type === 'direct' && selectedChat.user.id === userToDelete.id) {
          setSelectedChat(null);
        }
        
        toast({
          title: "Success",
          description: "User deleted from your chats",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete user from chats",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user from chats",
        variant: "destructive"
      });
    }
    
    setUserToDelete(null);
    setShowDeleteUserDialog(false);
  };

  // Auto-focus on input when chat is selected
  useEffect(() => {
    if (selectedChat && messageInputRef.current) {
      // Short delay to ensure the DOM is ready
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 100);
    }
  }, [selectedChat]);

  // Update onSelectUser to set proper chat type
  const handleSelectUser = (user: User) => {
    setSelectedChat({ type: 'direct', user });
    setSelectedGroup(null);
    setChatMessages([]);
    // ... existing code ...
  };

  // Update onSelectGroup to set proper chat type
  const handleSelectGroup = (group: Group) => {
    setSelectedChat({ type: 'group', group });
    setSelectedGroup(group);
    setChatMessages([]);
    // ... existing code ...
  };

  // Return the UI
  return (
    <div className="flex h-screen bg-[#0f0f0f] text-white pl-16">
      {/* Left panel - Chat list */}
      <div className="w-1/3 border-r border-[#2D221C] flex flex-col">
        <div className="p-4 border-b border-[#2D221C] flex flex-col gap-4">
          <h1 className="text-xl font-bold">Messages</h1>
          
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
            <Input 
              placeholder="Search..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#2D221C] border-none" 
            />
          </div>

          {/* Tabs for direct chats and groups */}
          <Tabs 
            defaultValue="chats" 
            value={activeTab} 
            onValueChange={(value) => {
              setActiveTab(value as 'chats' | 'groups');
              setSelectedChat(null);
              setSelectedGroup(null);
            }}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-full bg-[#2D221C]">
              <TabsTrigger value="chats">Direct Chats</TabsTrigger>
              <TabsTrigger value="groups">Group Chats</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* New group chat button */}
          <Dialog open={isNewGroupDialogOpen} onOpenChange={setIsNewGroupDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#EC1146] hover:bg-[#EC1146]/90 gap-2">
                <Users className="h-4 w-4" />
                <span>New Group Chat</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0f0f0f] text-white border border-[#2D221C] max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Group Chat</DialogTitle>
              </DialogHeader>
              <CreateGroup 
                currentUser={currentUser} 
                onGroupCreated={handleGroupCreated} 
              />
            </DialogContent>
          </Dialog>
        </div>
        
        {/* User/Group list */}
        <ScrollArea className="flex-1">
          {activeTab === 'chats' && (
            <div className="p-2 space-y-2">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-[#2D221C]/50 transition-colors duration-200 ${
                    selectedChat?.type === 'direct' && selectedChat.user.id === user.id ? 'bg-[#2D221C]' : ''
                  }`}
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.profilePicture || undefined} alt={user.username} />
                      <AvatarFallback>
                        {user.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0f0f0f] ${
                      new Date(user.lastActive) > new Date(Date.now() - 5 * 60 * 1000) ? 'bg-green-500' : 'bg-gray-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium truncate">{user.username}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-400 truncate">
                        {user.currentGame}
                      </p>
                      <span className="text-xs text-gray-500">•</span>
                      <p className="text-xs text-gray-500">
                        {formatLastActive(user.lastActive)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="p-2 space-y-2">
              {filteredGroups.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  <p>No group chats yet.</p>
                  <p className="text-sm mt-1">Create one by clicking the button above.</p>
                </div>
              ) : (
                filteredGroups.map(group => (
                  <div
                    key={group.id}
                    className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-[#2D221C]/50 transition-colors duration-200 ${
                      selectedChat?.type === 'group' && selectedChat.group.id === group.id ? 'bg-[#2D221C]' : ''
                    }`}
                    onClick={() => handleSelectGroup(group)}
                  >
                    <Avatar className="h-12 w-12 bg-[#2D221C]">
                      <AvatarFallback className="text-white">
                        <Users size={20} />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium truncate">{group.name}</h3>
                      </div>
                      {group.ownerId === currentUser.id && (
                        <p className="text-sm text-gray-400">You're the owner</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </div>
      
      {/* Right panel - Chat content */}
      <div className="flex-1 flex flex-col">
        {selectedChat && selectedChat.type === 'direct' && (
          // Direct chat UI
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-[#2D221C] flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden" 
                onClick={() => setSelectedChat(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedChat.user.profilePicture || undefined} alt={selectedChat.user.username} />
                <AvatarFallback>
                  {selectedChat.user.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h2 className="font-medium">{selectedChat.user.username}</h2>
                <div className="text-sm text-gray-400 flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${
                    new Date(selectedChat.user.lastActive) > new Date(Date.now() - 5 * 60 * 1000) ? 'bg-green-500' : 'bg-gray-500'
                  }`} />
                  <span>{formatLastActive(selectedChat.user.lastActive)}</span>
                </div>
              </div>
              
              {/* Delete user option */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#1D1D1D] border-[#2D221C] text-white">
                  <DropdownMenuItem 
                    className="text-red-500 cursor-pointer flex items-center gap-2"
                    onClick={() => {
                      if (selectedChat && selectedChat.type === 'direct') {
                        setUserToDelete(selectedChat.user);
                        setShowDeleteUserDialog(true);
                      }
                    }}
                  >
                    <UserMinus className="h-4 w-4" />
                    <span>Delete User</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Chat messages */}
            <ScrollArea className="flex-1 p-4" id="chat-messages" ref={chatMessagesRef}>
              <div className="space-y-4">
                {chatMessages.map((msg, i) => {
                  const isSender = msg.fromUserId === currentUser.id;
                  const showReadStatus = isSender && i === chatMessages.length - 1;
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isSender ? 'items-end' : 'items-start'
                      } mb-3`}
                    >
                      <div className="flex items-start group">
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            isSender
                              ? 'bg-[#EC1146] rounded-br-none'
                              : 'bg-[#2D221C] rounded-bl-none'
                          }`}
                        >
                          {renderMessageContent(msg.content)}
                        </div>
                        
                        {/* Message options dropdown - only for messages sent by current user */}
                        {isSender && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 p-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#1D1D1D] border-[#2D221C] text-white">
                              <div className="px-2 py-1 text-xs text-gray-400">
                                {formatMessageTime(msg.timestamp)}
                              </div>
                              <DropdownMenuSeparator className="bg-[#2D221C]" />
                              <DropdownMenuItem 
                                className="text-red-500 cursor-pointer flex items-center gap-2"
                                onClick={() => {
                                  setMessageToDelete(msg);
                                  setShowDeleteMessageDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Delete Message</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      
                      {/* Add timestamp below each message */}
                      <div className={`flex items-center text-xs text-gray-400 mt-1 ${isSender ? 'justify-end' : 'justify-start'}`}>
                        <span>{formatMessageTime(msg.timestamp)}</span>
                        {showReadStatus && (
                          <CheckCheck className="h-3 w-3 text-blue-400 ml-1" />
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {isTyping && selectedChat.type === 'direct' && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm">{selectedChat.user.username} is typing...</span>
                  </div>
                )}
                
                {/* Invisible element for scrolling to bottom */}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            {/* Image upload dialog */}
            <Dialog open={showImageUpload} onOpenChange={setShowImageUpload}>
              <DialogContent className="bg-[#0f0f0f] text-white border border-[#2D221C]">
                <DialogHeader>
                  <DialogTitle>Upload Image</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <ImageUpload 
                    onImageUploaded={handleImageUploaded}
                    maxSize={2 * 1024 * 1024} // 2MB max
                  />
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Message input with improved UX */}
            <div className="p-4 border-t border-[#2D221C] flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowImageUpload(true)}
                className="text-gray-400 hover:text-white"
              >
                <ImageIcon className="h-5 w-5" />
              </Button>
              
              <form 
                className="flex-1 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <Input
                  ref={messageInputRef}
                  value={messageInput}
                  onChange={handleTyping}
                  placeholder="Type a message..."
                  className="flex-1 bg-[#2D221C] border-none"
                  maxLength={2000}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                
                <Button
                  type="submit"
                  className="bg-[#EC1146] hover:bg-[#EC1146]/90"
                  disabled={!messageInput.trim()}
                >
                  Send
                </Button>
              </form>
            </div>
          </>
        )}

        {selectedGroup && (
          // Group chat UI
          <GroupChat 
            group={selectedGroup} 
            currentUser={currentUser} 
            onClose={() => {
              setSelectedGroup(null);
              refetchGroups();
            }} 
          />
        )}
        
        {!selectedChat && !selectedGroup && (
          // Empty state when no chat is selected
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <MessageCircle className="h-16 w-16 text-gray-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Your Messages</h2>
            <p className="text-gray-400 max-w-md">
              Select a user or group from the list to start chatting or search for someone specific.
            </p>
          </div>
        )}
      </div>
      
      {/* Delete Message Dialog */}
      <Dialog open={showDeleteMessageDialog} onOpenChange={setShowDeleteMessageDialog}>
        <DialogContent className="bg-[#1D1D1D] border-[#2D221C] text-white">
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete this message? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setMessageToDelete(null);
                setShowDeleteMessageDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMessage}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete User Dialog */}
      <Dialog open={showDeleteUserDialog} onOpenChange={setShowDeleteUserDialog}>
        <DialogContent className="bg-[#1D1D1D] border-[#2D221C] text-white">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete {userToDelete?.username} from your chats? All your conversation history will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setUserToDelete(null);
                setShowDeleteUserDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}