import { useState, useEffect, useRef } from 'react';
import { Message, Group, User } from '@shared/schema';
import { useWebSocket } from './use-websocket';
import { useToast } from './use-toast';

// Define the interface for group message
interface GroupMessage extends Omit<Message, 'toUserId'> {
  type: 'groupMessage';
  groupId: number;
}

interface UseGroupChatProps {
  currentUser: User;
  group: Group;
}

interface UseGroupChatReturn {
  messages: GroupMessage[];
  members: User[];
  typingUsers: Record<number, boolean>;
  isLoading: boolean;
  isError: boolean;
  sendMessage: (content: string) => void;
  sendTypingStatus: (isTyping: boolean) => void;
  refreshMembers: () => Promise<void>;
}

export function useGroupChat({ currentUser, group }: UseGroupChatProps): UseGroupChatReturn {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const { toast } = useToast();
  
  // Handle group message
  const onGroupMessage = (msg: GroupMessage) => {
    if (msg.groupId !== group.id) return;
    
    setMessages(prev => {
      // Only add the message if it's not already in the array
      const exists = prev.some(m => 
        'id' in m && 'id' in msg && m.id === msg.id
      );
      
      if (exists) return prev;
      return [...prev, msg];
    });
  };
  
  // Handle group typing status
  const onGroupTypingStatus = (userId: number, groupId: number, isTyping: boolean) => {
    if (groupId !== group.id || userId === currentUser.id) return;
    
    setTypingUsers(prev => ({
      ...prev,
      [userId]: isTyping
    }));
  };
  
  // Initialize WebSocket connection
  const { sendGroupMessage, sendGroupTypingStatus } = useWebSocket(
    currentUser.id,
    () => {}, // We don't need direct messages for group chat
    onGroupMessage,
    () => {}, // We don't need direct typing indicators
    onGroupTypingStatus
  );
  
  // Fetch group messages
  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/groups/${group.id}/messages?userId=${currentUser.id}`);
        if (response.ok) {
          const data = await response.json();
          // Add the type field to each message
          const formattedMessages = data.map((msg: Message) => ({
            ...msg,
            type: 'groupMessage',
            groupId: group.id
          }));
          setMessages(formattedMessages);
        } else {
          throw new Error('Failed to fetch messages');
        }
      } catch (error) {
        console.error('Error fetching group messages:', error);
        toast({
          title: 'Error',
          description: 'Failed to load group messages',
          variant: 'destructive'
        });
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [group.id, currentUser.id, toast]);

  // Fetch group members
  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/groups/${group.id}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      } else {
        throw new Error('Failed to fetch members');
      }
    } catch (error) {
      console.error('Error fetching group members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load group members',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [group.id, toast]);

  // Send a message to the group
  const sendMessage = (content: string) => {
    if (!content.trim()) return;
    sendGroupMessage(group.id, content);
  };

  // Send typing status to the group
  const sendTypingStatus = (isTyping: boolean) => {
    sendGroupTypingStatus(group.id, isTyping);
  };

  return {
    messages,
    members,
    typingUsers,
    isLoading,
    isError,
    sendMessage,
    sendTypingStatus,
    refreshMembers: fetchMembers
  };
} 