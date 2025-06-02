import { useState, useEffect, useRef } from 'react';
import { User, Group, Message } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ImageUpload } from '@/components/image-upload';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';
import { 
  MessageCircle, 
  Image as ImageIcon, 
  Users, 
  MoreVertical, 
  UserPlus, 
  LogOut, 
  Trash2, 
  UserCheck,
  Send
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Define interface for group message with the required type field
interface GroupMessage extends Omit<Message, 'toUserId'> {
  type: 'groupMessage';
  groupId: number;
}

interface GroupChatProps {
  group: Group;
  currentUser: User;
  onClose: () => void;
}

export function GroupChat({ group, currentUser, onClose }: GroupChatProps) {
  const [messages, setMessages] = useState<(Message | GroupMessage)[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [members, setMembers] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [isTransferOwnershipDialogOpen, setIsTransferOwnershipDialogOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<number, boolean>>({});
  const [isViewMembersDialogOpen, setIsViewMembersDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | GroupMessage | null>(null);
  const [showDeleteMessageDialog, setShowDeleteMessageDialog] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if the current user is the owner of the group
  useEffect(() => {
    setIsOwner(group.ownerId === currentUser.id);
  }, [group, currentUser]);

  // Fetch group messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/groups/${group.id}/messages?userId=${currentUser.id}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
          
          // Scroll to bottom immediately after messages load
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          }, 100);
        } else {
          toast({
            title: "Error",
            description: "Failed to load messages",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error fetching group messages:", error);
      }
    };

    fetchMessages();
  }, [group.id, currentUser.id, toast]);

  // Fetch group members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch(`/api/groups/${group.id}/members`);
        if (response.ok) {
          const data = await response.json();
          setMembers(data);
        } else {
          toast({
            title: "Error",
            description: "Failed to load group members",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error fetching group members:", error);
      }
    };

    fetchMembers();
  }, [group.id, toast]);

  // Fetch available users for adding to the group
  useEffect(() => {
    const fetchAvailableUsers = async () => {
      try {
        const response = await fetch('/api/users');
        if (response.ok) {
          const allUsers: User[] = await response.json();
          // Filter out users who are already members
          const memberIds = members.map(member => member.id);
          const availableUsers = allUsers.filter(user => 
            !memberIds.includes(user.id) && user.id !== currentUser.id
          );
          setAvailableUsers(availableUsers);
        }
      } catch (error) {
        console.error("Error fetching available users:", error);
      }
    };

    if (isAddMemberDialogOpen) {
      fetchAvailableUsers();
    }
  }, [isAddMemberDialogOpen, members, currentUser.id]);

  // Scroll to the bottom when new messages arrive - more aggressive approach
  useEffect(() => {
    if (messages.length > 0) {
      // First immediate scroll without animation
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      
      // Then a delayed smooth scroll to ensure it works
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  // WebSocket setup for group chat
  const onGroupMessage = (msg: GroupMessage) => {
    console.log('Group message received:', msg);
    
    // Only process messages for this group
    if (msg.groupId !== group.id) return;
    
    setMessages(prev => {
      // Only add the message if it's not already in the array
      const exists = prev.some(m => 
        (m.id === msg.id) || 
        (m.fromUserId === msg.fromUserId && 
         m.content === msg.content && 
         Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 1000)
      );
      
      if (exists) return prev;
      
      // Add new message and ensure re-render
      const updatedMessages = [...prev, msg];
      
      // Scroll to bottom after update
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 0);
      
      return updatedMessages;
    });
  };

  const onGroupTypingStatus = (userId: number, groupId: number, isTyping: boolean) => {
    console.log('Group typing status received:', userId, groupId, isTyping);
    
    // Only process typing events for this group
    if (groupId === group.id && userId !== currentUser.id) {
      console.log('Setting typing status for user', userId, 'to', isTyping);
      
      setTypingUsers(prev => ({
        ...prev,
        [userId]: isTyping
      }));
    }
  };

  // Use all WebSocket methods
  const { sendGroupMessage, sendGroupTypingStatus } = useWebSocket(
    currentUser.id,
    () => {}, // We don't need direct messages for group chat
    onGroupMessage,
    () => {}, // We don't need direct typing indicators
    onGroupTypingStatus
  );

  // Handle typing notification with debounce
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    sendGroupTypingStatus(group.id, true);
    
    // Clear typing status after 2 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      sendGroupTypingStatus(group.id, false);
    }, 2000);
  };

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Format message timestamp
  const formatMessageTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  };

  // Send a message
  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    // Create a temporary message to display immediately
    const tempMessage: GroupMessage = {
      id: Date.now(), // Temporary ID
      fromUserId: currentUser.id,
      groupId: group.id,
      content: messageInput,
      timestamp: new Date(),
      isRead: false,
      readAt: null,
      type: 'groupMessage'
    };
    
    // Add the message to the UI immediately
    setMessages(prev => [...prev, tempMessage]);
    
    // Then send via WebSocket
    sendGroupMessage(group.id, messageInput);
    setMessageInput('');
  };

  // Handle image upload
  const handleImageUploaded = (imageUrl: string) => {
    // Create a temporary message to display immediately
    const tempMessage: GroupMessage = {
      id: Date.now(), // Temporary ID
      fromUserId: currentUser.id,
      groupId: group.id,
      content: `![image](${imageUrl})`,
      timestamp: new Date(),
      isRead: false,
      readAt: null,
      type: 'groupMessage'
    };
    
    // Add the message to the UI immediately
    setMessages(prev => [...prev, tempMessage]);
    
    // Then send via WebSocket
    sendGroupMessage(group.id, `![image](${imageUrl})`);
    setShowImageUpload(false);
  };

  // Add a member to the group
  const handleAddMember = async (user: User) => {
    try {
      const response = await fetch(`/api/groups/${group.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          currentUserId: currentUser.id
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `${user.username} has been added to the group`,
        });
        
        // Update the members list
        setMembers(prev => [...prev, user]);
        setIsAddMemberDialogOpen(false);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to add member",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error adding member:", error);
      toast({
        title: "Error",
        description: "Failed to add member",
        variant: "destructive"
      });
    }
  };

  // Remove a member from the group
  const handleRemoveMember = async (memberId: number) => {
    try {
      const response = await fetch(`/api/groups/${group.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentUserId: currentUser.id
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Member has been removed from the group",
        });
        
        // Update the members list
        setMembers(prev => prev.filter(member => member.id !== memberId));
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to remove member",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive"
      });
    }
  };

  // Transfer group ownership
  const handleTransferOwnership = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/groups/${group.id}/transfer-ownership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentOwnerId: currentUser.id,
          newOwnerId: selectedUser.id
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Ownership transferred to ${selectedUser.username}`,
        });
        
        setIsOwner(false);
        setIsTransferOwnershipDialogOpen(false);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to transfer ownership",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error transferring ownership:", error);
      toast({
        title: "Error",
        description: "Failed to transfer ownership",
        variant: "destructive"
      });
    }
  };

  // Leave the group
  const handleLeaveGroup = async () => {
    try {
      const response = await fetch(`/api/groups/${group.id}/members/${currentUser.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentUserId: currentUser.id
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "You have left the group",
        });
        
        onClose();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to leave group",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error leaving group:", error);
      toast({
        title: "Error",
        description: "Failed to leave group",
        variant: "destructive"
      });
    }
  };

  // Delete the group
  const handleDeleteGroup = async () => {
    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.id
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Group has been deleted",
        });
        
        onClose();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to delete group",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      toast({
        title: "Error",
        description: "Failed to delete group",
        variant: "destructive"
      });
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

  const getUsernameById = (userId: number) => {
    const user = members.find(member => member.id === userId);
    return user ? user.username : "Unknown User";
  };

  // Function to delete a message
  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;
    
    try {
      // Different endpoint for group messages
      const response = await fetch(`/api/groups/${group.id}/messages/${messageToDelete.id}`, {
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
        setMessages(prev => prev.filter(msg => msg.id !== messageToDelete.id));
        
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

  // Return the UI
  return (
    <Card className="flex flex-col h-full border-none bg-[#151515] shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between py-3 border-b border-[#2D221C]">
        <div className="flex items-center gap-2">
          <Avatar className="bg-[#2D221C]">
            <AvatarFallback className="text-white">
              <Users size={20} />
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-lg font-bold text-white">{group.name}</h2>
            <button 
              onClick={() => setIsViewMembersDialogOpen(true)}
              className="text-sm text-gray-400 hover:text-white hover:underline focus:outline-none"
            >
              {members.length} members
            </button>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreVertical className="h-5 w-5 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#151515] border-[#2D221C] text-white">
            <DropdownMenuLabel>Group Options</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#2D221C]" />
            
            {isOwner && (
              <DropdownMenuItem 
                onClick={() => setIsAddMemberDialogOpen(true)}
                className="cursor-pointer flex items-center gap-2"
              >
                <UserPlus size={16} />
                Add Member
              </DropdownMenuItem>
            )}
            
            {isOwner && (
              <DropdownMenuItem 
                onClick={() => setIsTransferOwnershipDialogOpen(true)}
                className="cursor-pointer flex items-center gap-2"
              >
                <UserCheck size={16} />
                Transfer Ownership
              </DropdownMenuItem>
            )}
            
            <DropdownMenuItem 
              onClick={handleLeaveGroup}
              className="cursor-pointer flex items-center gap-2 text-amber-500"
            >
              <LogOut size={16} />
              Leave Group
            </DropdownMenuItem>
            
            {isOwner && (
              <DropdownMenuItem 
                onClick={handleDeleteGroup}
                className="cursor-pointer flex items-center gap-2 text-red-500"
              >
                <Trash2 size={16} />
                Delete Group
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-4">
          {messages.map((message, index) => {
            const isFromCurrentUser = message.fromUserId === currentUser.id;
            return (
              <div
                key={message.id || index}
                className={`flex mb-3 ${
                  isFromCurrentUser ? "justify-end" : "justify-start"
                }`}
              >
                {!isFromCurrentUser && (
                  <Avatar className="mr-2 h-8 w-8 bg-[#2D221C]">
                    <AvatarFallback className="text-white">
                      {getUsernameById(message.fromUserId).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div
                  className={`flex flex-col max-w-[70%] ${
                    isFromCurrentUser ? "items-end" : "items-start"
                  }`}
                >
                  {!isFromCurrentUser && (
                    <span className="text-xs text-gray-400 mb-1">
                      {getUsernameById(message.fromUserId)}
                    </span>
                  )}
                  
                  <div className="flex items-start group">
                    <div
                      className={`p-3 rounded-lg ${
                        isFromCurrentUser
                          ? "bg-[#4d1c55] text-white"
                          : "bg-[#2D221C] text-white"
                      }`}
                    >
                      {renderMessageContent(message.content)}
                    </div>
                    
                    {/* Message options dropdown - only for messages sent by current user */}
                    {isFromCurrentUser && (
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
                          {/* Add timestamp to the dropdown menu */}
                          <div className="px-2 py-1 text-xs text-gray-400">
                            {formatMessageTime(new Date(message.timestamp))}
                          </div>
                          <DropdownMenuSeparator className="bg-[#2D221C]" />
                          <DropdownMenuItem 
                            className="text-red-500 cursor-pointer flex items-center gap-2"
                            onClick={() => {
                              setMessageToDelete(message);
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
                </div>
              </div>
            );
          })}
          
          {/* Show typing indicators */}
          {Object.entries(typingUsers)
            .filter(([_, isTyping]) => isTyping)
            .map(([userId]) => (
              <div 
                key={`typing-${userId}`} 
                className="flex items-center gap-2 text-gray-400 text-sm mb-4"
              >
                <Avatar className="mr-2 h-6 w-6 bg-[#2D221C]">
                  <AvatarFallback className="text-white text-xs">
                    {getUsernameById(parseInt(userId)).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-sm">{getUsernameById(parseInt(userId))}</span>
                  <div className="flex space-x-1 mt-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            ))}
          
          <div ref={messagesEndRef} />
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="border-t border-[#2D221C] p-4">
        <div className="flex items-center w-full gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowImageUpload(true)}
            className="text-gray-400 hover:text-white"
          >
            <ImageIcon size={20} />
          </Button>
          
          <Input
            placeholder="Type a message..."
            value={messageInput}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 bg-[#1D1D1D] border-[#2D221C] text-white"
          />
          
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            className="bg-[#4d1c55] hover:bg-[#6d2775] text-white"
          >
            <Send size={20} />
          </Button>
        </div>
      </CardFooter>
      
      {/* Image Upload Dialog */}
      <Dialog open={showImageUpload} onOpenChange={setShowImageUpload}>
        <DialogContent className="sm:max-w-md bg-[#151515] border-[#2D221C] text-white">
          <DialogHeader>
            <DialogTitle>Upload Image</DialogTitle>
          </DialogHeader>
          <ImageUpload onImageUploaded={handleImageUploaded} />
        </DialogContent>
      </Dialog>
      
      {/* Add Member Dialog */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent className="bg-[#151515] border-[#2D221C] text-white">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {availableUsers.length === 0 ? (
              <p className="text-gray-400">No users available to add</p>
            ) : (
              availableUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 hover:bg-[#1D1D1D] rounded cursor-pointer"
                  onClick={() => handleAddMember(user)}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 bg-[#2D221C]">
                      <AvatarFallback className="text-white">
                        {user.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{user.username}</span>
                  </div>
                  <UserPlus size={16} className="text-gray-400" />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Transfer Ownership Dialog */}
      <Dialog open={isTransferOwnershipDialogOpen} onOpenChange={setIsTransferOwnershipDialogOpen}>
        <DialogContent className="bg-[#151515] border-[#2D221C] text-white">
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {members.filter(member => member.id !== currentUser.id).length === 0 ? (
              <p className="text-gray-400">No members available to transfer ownership to</p>
            ) : (
              members
                .filter(member => member.id !== currentUser.id)
                .map(member => (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-2 hover:bg-[#1D1D1D] rounded cursor-pointer ${
                      selectedUser?.id === member.id ? 'bg-[#4d1c55]/25' : ''
                    }`}
                    onClick={() => setSelectedUser(member)}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 bg-[#2D221C]">
                        <AvatarFallback className="text-white">
                          {member.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.username}</span>
                    </div>
                    {selectedUser?.id === member.id && (
                      <UserCheck size={16} className="text-green-500" />
                    )}
                  </div>
                ))
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleTransferOwnership}
              disabled={!selectedUser}
              className="bg-[#4d1c55] hover:bg-[#6d2775] text-white"
            >
              Transfer Ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* View Members Dialog */}
      <Dialog open={isViewMembersDialogOpen} onOpenChange={setIsViewMembersDialogOpen}>
        <DialogContent className="bg-[#151515] border-[#2D221C] text-white">
          <DialogHeader>
            <DialogTitle>Group Members</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto py-2">
            {members.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 hover:bg-[#1D1D1D] rounded"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 bg-[#2D221C]">
                    <AvatarFallback className="text-white">
                      {member.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-white">{member.username}</span>
                    {member.id === group.ownerId && (
                      <span className="ml-2 text-xs bg-[#4d1c55] text-white px-2 py-0.5 rounded">Owner</span>
                    )}
                    {member.id === currentUser.id && member.id !== group.ownerId && (
                      <span className="ml-2 text-xs bg-[#2D221C] text-white px-2 py-0.5 rounded">You</span>
                    )}
                  </div>
                </div>
                
                {(isOwner && member.id !== currentUser.id && member.id !== group.ownerId) && (
                  <Button
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-red-400 hover:text-red-500 hover:bg-transparent"
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete Message Dialog */}
      <Dialog open={showDeleteMessageDialog} onOpenChange={setShowDeleteMessageDialog}>
        <DialogContent className="sm:max-w-md bg-[#151515] border-[#2D221C] text-white">
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
    </Card>
  );
} 