import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWebSocket } from '@/hooks/use-websocket';
import { Message, User } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { X, Image as ImageIcon, CheckCheck, Minimize2 } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { ImageUpload } from './image-upload';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ChatWindowProps {
  currentUser: User;
  otherUser: User;
  onClose: () => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
}

// Enhanced animation variants for smoother transitions
const chatWindowVariants = {
  minimized: {
    opacity: 0,
    y: 50,
    height: 0,
    transition: {
      duration: 0.2,
      ease: 'easeInOut'
    }
  },
  maximized: {
    opacity: 1,
    y: 0,
    height: 'auto',
    transition: {
      duration: 0.2,
      ease: 'easeInOut'
    }
  }
};

const messageVariants = {
  initial: {
    opacity: 0,
    y: 10
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut'
    }
  }
};

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

export function ChatWindow({ currentUser, otherUser, onClose, isMinimized: externalMinimized, onMinimize }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [internalMinimized, setInternalMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingSent = useRef<boolean>(false);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingMessageRef = useRef<string | null>(null);

  // Use external minimized state if provided, otherwise use internal state
  const isMinimized = externalMinimized !== undefined ? externalMinimized : internalMinimized;

  // Enhanced scroll behavior with debounce
  const scrollToBottom = useCallback(() => {
    if (!messagesEndRef.current) return;
    
    const scroll = () => {
      messagesEndRef.current?.scrollIntoView({
        behavior: isMinimized ? 'auto' : 'smooth',
        block: 'end'
      });
    };

    // Immediate scroll
    scroll();
    
    // Debounced scroll for smoother experience
    const timeouts = [
      setTimeout(scroll, 50),
      setTimeout(scroll, 150)
    ];

    return () => timeouts.forEach(clearTimeout);
  }, [isMinimized]);

  // Fetch historical messages
  const { data: historicalMessages } = useQuery<Message[]>({
    queryKey: [`/api/messages/${currentUser.id}/${otherUser.id}`],
  });

  // Sync historical messages
  useEffect(() => {
    if (historicalMessages) {
      setMessages(historicalMessages);
      
      // Scroll to bottom after messages load
      setTimeout(scrollToBottom, 100);
    }
  }, [historicalMessages, scrollToBottom]);

  // Auto scroll to bottom when new messages arrive or when chat is opened
  useEffect(() => {
    // Immediate scroll attempt
    scrollToBottom();
    
    // Delayed scroll attempts to ensure it works after rendering
    const scrollTimers = [
      setTimeout(scrollToBottom, 50),
      setTimeout(scrollToBottom, 100),
      setTimeout(scrollToBottom, 300)
    ];
    
    return () => {
      // Clean up timers
      scrollTimers.forEach(timer => clearTimeout(timer));
    };
  }, [messages, isMinimized, scrollToBottom]);

  // Optimized message handling with better deduplication
  const onMessage = useCallback((msg: Message) => {
    if (
      (msg.fromUserId === otherUser.id && msg.toUserId === currentUser.id) ||
      (msg.fromUserId === currentUser.id && msg.toUserId === otherUser.id)
    ) {
      setMessages(prev => {
        // For messages from the current user, check against pendingMessage
        if (msg.fromUserId === currentUser.id && msg.content === pendingMessageRef.current) {
          // Clear the pending message as we've received confirmation
          pendingMessageRef.current = null;
          // Don't add it again if it matches our optimistic update
          if (prev.some(m => m.content === msg.content && 
              m.fromUserId === msg.fromUserId && 
              m.toUserId === msg.toUserId &&
              Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 5000)) {
            return prev;
          }
        }

        // For other messages, just check for exact duplicates
        if (prev.some(m => m.id === msg.id || 
            (m.content === msg.content && 
             m.fromUserId === msg.fromUserId && 
             m.toUserId === msg.toUserId &&
             Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 5000))) {
          return prev;
        }
        
        // Add the new message
        const newMessages = [...prev, msg];
        requestAnimationFrame(() => scrollToBottom());
        return newMessages;
      });

      // Reset typing indicator for messages from other user
      if (msg.fromUserId === otherUser.id) {
        setIsTyping(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    }
  }, [currentUser.id, otherUser.id, scrollToBottom]);

  // Handle typing status updates
  const onTypingStatus = useCallback((userId: number, isTyping: boolean) => {
    if (userId === otherUser.id) {
      setIsTyping(isTyping);
    }
  }, [otherUser.id]);

  // WebSocket connection
  const { sendMessage, sendTypingStatus } = useWebSocket(
    currentUser.id,
    onMessage,
    undefined, // No group message handler needed
    onTypingStatus
  );

  // Optimized typing handler with debounce
  const handleTyping = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = e.target.value;
    setInput(newInputValue);
    
    if (newInputValue.trim()) {
      if (!isTypingSent.current) {
        sendTypingStatus(otherUser.id, true);
        isTypingSent.current = true;
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(otherUser.id, false);
        isTypingSent.current = false;
      }, 1000);
    }
  }, [otherUser.id, sendTypingStatus]);

  // Cleanup typing status on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        sendTypingStatus(otherUser.id, false);
      }
    };
  }, [otherUser.id, sendTypingStatus]);

  // Enhanced send handler with pending message tracking
  const handleSend = () => {
    if (!input.trim()) return;
    
    const trimmedMessage = input.trim();
    
    // Store the pending message content
    pendingMessageRef.current = trimmedMessage;
    
    // Create temporary message for optimistic update
    const tempMessage = {
      id: Date.now(), // Use timestamp as temporary ID
      fromUserId: currentUser.id,
      toUserId: otherUser.id,
      content: trimmedMessage,
      timestamp: new Date(),
      isRead: false,
      type: "text" 
    } as Message;
    
    // Add message to local state immediately
    setMessages(prev => [...prev, tempMessage]);
    
    // Clear input for better UX
    setInput('');
    
    // Send message
    sendMessage(otherUser.id, trimmedMessage);
    
    // Focus input field
    messageInputRef.current?.focus();
    
    // Scroll to bottom after sending
    setTimeout(scrollToBottom, 100);
  };

  // Handle image upload
  const handleImageUploaded = (imageUrl: string) => {
    const imageContent = `![image](${imageUrl})`;
    
    // Send the message
    sendMessage(otherUser.id, imageContent);
    
    // Close the upload dialog
    setShowImageUpload(false);
  };

  // Improved formatter for message timestamps
  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();
                    
    const isYesterday = date.getDate() === yesterday.getDate() && 
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

  // Effect to auto-focus input when opening chat
  useEffect(() => {
    if (!isMinimized) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 100);
    }
  }, [isMinimized]);

  // Handle minimize button click
  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize();
    } else {
      setInternalMinimized(true);
    }
  };

  // Handle maximize (from minimized state)
  const handleMaximize = () => {
    if (onMinimize) {
      onMinimize();
    } else {
      setInternalMinimized(false);
    }
  };

  // Return the component UI with improved animations
  return (
    <AnimatePresence mode="wait">
      {isMinimized ? (
        <motion.div
          variants={chatWindowVariants}
          initial="minimized"
          animate="maximized"
          exit="minimized"
          className="fixed bottom-4 right-4 z-50"
          layout
        >
          <Card className="bg-[#0f0f0f] border-[#2D221C] overflow-hidden w-80">
            <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 border-b border-[#2D221C] cursor-pointer" onClick={handleMaximize}>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={otherUser.profilePicture || undefined} alt={otherUser.username} />
                  <AvatarFallback>
                    {otherUser.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-medium text-white text-sm">{otherUser.username}</h4>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${new Date(otherUser.lastActive) > new Date(Date.now() - 5 * 60 * 1000) ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span>{formatLastActive(otherUser.lastActive)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                  e.stopPropagation(); // Prevent the card click handler from firing
                  onClose();
                }}>
                  <X className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          variants={chatWindowVariants}
          initial="minimized"
          animate="maximized"
          exit="minimized"
          className="fixed bottom-4 right-4 w-80 max-w-[95%] z-50"
          layout
        >
          <Card className="bg-[#0f0f0f] border-[#2D221C] overflow-hidden flex flex-col h-96">
            <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 border-b border-[#2D221C]">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={otherUser.profilePicture || undefined} alt={otherUser.username} />
                  <AvatarFallback>
                    {otherUser.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-medium text-white text-sm">{otherUser.username}</h4>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${new Date(otherUser.lastActive) > new Date(Date.now() - 5 * 60 * 1000) ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span>{formatLastActive(otherUser.lastActive)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleMinimize}>
                  <Minimize2 className="h-4 w-4 text-gray-400" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                  <X className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea 
                className="h-full p-3" 
                ref={scrollAreaRef}
                onScroll={(e) => {
                  // Prevent auto-scroll when user is manually scrolling up
                  const target = e.currentTarget;
                  const isAtBottom = target.scrollHeight - target.scrollTop === target.clientHeight;
                  if (isAtBottom) {
                    scrollToBottom();
                  }
                }}
              >
                <div className="space-y-3">
                  {messages.map((msg, i) => {
                    const isSender = msg.fromUserId === currentUser.id;
                    const showReadStatus = isSender && i === messages.length - 1;
                    
                    return (
                      <motion.div 
                        key={msg.id} 
                        variants={messageVariants}
                        initial="initial"
                        animate="animate"
                        className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}
                      >
                        <div 
                          className={cn(
                            "p-2 rounded-lg max-w-[90%]",
                            isSender 
                              ? "bg-[#EC1146] rounded-br-none text-white" 
                              : "bg-[#2D221C] rounded-bl-none text-white"
                          )}
                        >
                          {renderMessageContent(msg.content)}
                        </div>
                        <div className={`flex items-center text-xs text-gray-400 mt-1 ${isSender ? 'justify-end' : 'justify-start'}`}>
                          <span>{formatTime(msg.timestamp)}</span>
                          {showReadStatus && (
                            <CheckCheck className="h-3 w-3 text-blue-400 ml-1" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                  
                  {isTyping && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 text-gray-400"
                    >
                      <div className="flex space-x-1">
                        <motion.div 
                          className="w-2 h-2 rounded-full bg-gray-400"
                          animate={{ y: [0, -5, 0] }}
                          transition={{ 
                            duration: 0.6,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 0
                          }}
                        />
                        <motion.div 
                          className="w-2 h-2 rounded-full bg-gray-400"
                          animate={{ y: [0, -5, 0] }}
                          transition={{ 
                            duration: 0.6,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 0.2
                          }}
                        />
                        <motion.div 
                          className="w-2 h-2 rounded-full bg-gray-400"
                          animate={{ y: [0, -5, 0] }}
                          transition={{ 
                            duration: 0.6,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 0.4
                          }}
                        />
                      </div>
                      <span className="text-sm">{otherUser.username} is typing...</span>
                    </motion.div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
            
            <CardFooter className="p-2 border-t border-[#2D221C] bg-[#0f0f0f]">
              <div className="flex items-center gap-2 w-full">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-white"
                  onClick={() => setShowImageUpload(true)}
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                
                <form 
                  className="flex-1 flex"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                >
                  <Input
                    ref={messageInputRef}
                    value={input}
                    onChange={handleTyping}
                    placeholder="Type a message..."
                    className="flex-1 h-8 bg-[#2D221C] border-none text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                </form>
              </div>
            </CardFooter>
          </Card>
          
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
