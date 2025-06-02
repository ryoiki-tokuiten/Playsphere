import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';

// Define message types
interface DirectChatMessage {
  type: 'message';
  fromUserId: number;
  toUserId: number;
  content: string;
}

interface GroupChatMessage {
  type: 'groupMessage';
  fromUserId: number;
  groupId: number;
  content: string;
}

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

type WSMessage = DirectChatMessage | GroupChatMessage | TypingStatus | GroupTypingStatus;

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Map<number, WebSocket>();

  wss.on('connection', (ws) => {
    let userId: number | undefined;

    ws.on('message', async (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        
        // Store the user connection
        if (message.fromUserId) {
          userId = message.fromUserId;
          clients.set(message.fromUserId, ws);
        }

        // Handle direct message
        if (message.type === 'message') {
          const { fromUserId, toUserId, content } = message;

          // Create and store the message
          const newMessage = await storage.createMessage({
            fromUserId,
            toUserId,
            groupId: null,
            content,
            timestamp: new Date(),
            isRead: false,
            readAt: null,
            type: 'text'
          });

          // Send to recipient if online
          const recipientWs = clients.get(toUserId);
          if (recipientWs?.readyState === WebSocket.OPEN) {
            recipientWs.send(JSON.stringify(newMessage));
          }

          // Send confirmation back to sender
          ws.send(JSON.stringify(newMessage));
        } 
        // Handle group message
        else if (message.type === 'groupMessage') {
          const { fromUserId, groupId, content } = message;
          
          // Verify user is a member of the group
          const isMember = await storage.isGroupMember(groupId, fromUserId);
          if (!isMember) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'You are not a member of this group' 
            }));
            return;
          }
          
          // Create and store the message
          const newMessage = await storage.createMessage({
            fromUserId,
            toUserId: null,
            groupId,
            content,
            timestamp: new Date(),
            isRead: false,
            readAt: null,
            type: 'text'
          });
          
          // Get all group members
          const groupMembers = await storage.getGroupMembers(groupId);
          
          // Send to all online group members except the sender
          for (const member of groupMembers) {
            if (member.id !== fromUserId) {
              const memberWs = clients.get(member.id);
              if (memberWs?.readyState === WebSocket.OPEN) {
                memberWs.send(JSON.stringify({
                  ...newMessage,
                  type: 'groupMessage'
                }));
              }
            }
          }
          
          // Send confirmation back to sender
          ws.send(JSON.stringify({
            ...newMessage,
            type: 'groupMessage'
          }));
        }
        // Handle direct typing status
        else if (message.type === 'typing') {
          const { fromUserId, toUserId, isTyping } = message;
          
          // Forward typing status to recipient if online
          const recipientWs = clients.get(toUserId);
          if (recipientWs?.readyState === WebSocket.OPEN) {
            recipientWs.send(JSON.stringify({
              type: 'typing',
              fromUserId,
              toUserId,
              isTyping
            }));
          }
        }
        // Handle group typing status
        else if (message.type === 'groupTyping') {
          const { fromUserId, groupId, isTyping } = message;
          
          // Verify user is a member of the group
          const isMember = await storage.isGroupMember(groupId, fromUserId);
          if (!isMember) return;
          
          // Get all group members
          const groupMembers = await storage.getGroupMembers(groupId);
          
          // Forward typing status to all online group members except the sender
          for (const member of groupMembers) {
            if (member.id !== fromUserId) {
              const memberWs = clients.get(member.id);
              if (memberWs?.readyState === WebSocket.OPEN) {
                memberWs.send(JSON.stringify({
                  type: 'groupTyping',
                  fromUserId,
                  groupId,
                  isTyping
                }));
              }
            }
          }
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
      }
    });
  });
}
