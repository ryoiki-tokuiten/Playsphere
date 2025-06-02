import { useEffect, useRef, useState, useCallback } from 'react';
import { Message } from '@shared/schema';

// Add interface for group message
interface GroupMessage extends Omit<Message, 'toUserId'> {
  type: 'groupMessage';
  groupId: number;
}

// Add typing status interfaces
interface TypingStatus {
  type: 'typing';
  fromUserId: number;
  toUserId: number;
  isTyping: boolean;
}

interface GroupTypingStatus {
  type: 'groupTyping';
  fromUserId: number;
  groupId: number;
  isTyping: boolean;
}

// Message types
type WSMessage = Message | GroupMessage | TypingStatus | GroupTypingStatus;

export function useWebSocket(
  userId: number, 
  onMessage: (msg: Message) => void, 
  onGroupMessage?: (msg: GroupMessage) => void,
  onTypingStatus?: (userId: number, isTyping: boolean) => void,
  onGroupTypingStatus?: (userId: number, groupId: number, isTyping: boolean) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<any[]>([]);

  // Function to establish WebSocket connection
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const wsUrl = `${protocol}//${host}:5000/ws`;
    
    try {
      console.log('Connecting to WebSocket server:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          // Handle different message types
          if (message.type === 'typing' && onTypingStatus) {
            onTypingStatus(message.fromUserId, message.isTyping);
          } 
          else if (message.type === 'groupTyping' && onGroupTypingStatus) {
            onGroupTypingStatus(message.fromUserId, message.groupId, message.isTyping);
          }
          else if (message.type === 'groupMessage' && onGroupMessage) {
            onGroupMessage(message as GroupMessage);
          }
          else if (message.type !== 'error') {
            onMessage(message as Message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed, attempting to reconnect...');
        setIsConnected(false);
        
        // Attempt to reconnect after 2 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 2000);
      };

      ws.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        
        // Process any queued messages
        if (messageQueueRef.current.length > 0) {
          console.log('Processing queued messages:', messageQueueRef.current.length);
          messageQueueRef.current.forEach(msg => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(msg));
            }
          });
          messageQueueRef.current = [];
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      
      // Attempt to reconnect after 2 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 2000);
    }
  }, [userId, onMessage, onGroupMessage, onTypingStatus, onGroupTypingStatus]);

  // Set up WebSocket connection and handle cleanup
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  // Helper function to send or queue a message
  const sendOrQueueMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.log('WebSocket not connected, queueing message', message);
      messageQueueRef.current.push(message);
      return false;
    }
  };

  const sendMessage = (toUserId: number, content: string) => {
    const message = {
      type: 'message',
      fromUserId: userId,
      toUserId,
      content
    };
    
    return sendOrQueueMessage(message);
  };

  const sendGroupMessage = (groupId: number, content: string) => {
    const message = {
      type: 'groupMessage',
      fromUserId: userId,
      groupId,
      content
    };
    
    return sendOrQueueMessage(message);
  };

  const sendTypingStatus = (toUserId: number, isTyping: boolean) => {
    const message = {
      type: 'typing',
      fromUserId: userId,
      toUserId,
      isTyping
    };
    
    return sendOrQueueMessage(message);
  };

  const sendGroupTypingStatus = (groupId: number, isTyping: boolean) => {
    const message = {
      type: 'groupTyping',
      fromUserId: userId,
      groupId,
      isTyping
    };
    
    return sendOrQueueMessage(message);
  };

  return { 
    sendMessage, 
    sendGroupMessage, 
    sendTypingStatus, 
    sendGroupTypingStatus,
    isConnected 
  };
}
