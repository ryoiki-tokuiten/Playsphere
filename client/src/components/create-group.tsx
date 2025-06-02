import { useState, useEffect } from 'react';
import { User, Group } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Users, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateGroupProps {
  currentUser: User;
  onGroupCreated: (group: Group) => void;
}

export function CreateGroup({ currentUser, onGroupCreated }: CreateGroupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch available users when the dialog is opened
  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const users: User[] = await response.json();
        // Filter out the current user
        setAvailableUsers(users.filter(user => user.id !== currentUser.id));
      } else {
        toast({
          title: "Error",
          description: "Failed to load users",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    }
  };

  const handleUserToggle = (user: User) => {
    if (selectedUsers.some(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast({
        title: "Error",
        description: "Group name is required",
        variant: "destructive"
      });
      return;
    }

    if (selectedUsers.length === 0) {
      toast({
        title: "Error",
        description: "Select at least one member",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // First create the group
      const createGroupResponse = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: groupName,
          ownerId: currentUser.id
        })
      });

      if (createGroupResponse.ok) {
        const group = await createGroupResponse.json();
        
        // Then add each selected user as a member
        const memberPromises = selectedUsers.map(user => 
          fetch(`/api/groups/${group.id}/members`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: user.id,
              currentUserId: currentUser.id
            })
          })
        );

        await Promise.all(memberPromises);
        
        toast({
          title: "Success",
          description: `Group "${groupName}" created successfully`,
        });

        // Reset form and close dialog
        setGroupName('');
        setSelectedUsers([]);
        setIsOpen(false);
        
        // Notify parent component
        onGroupCreated(group);
      } else {
        const error = await createGroupResponse.json();
        throw new Error(error.message || "Failed to create group");
      }
    } catch (error) {
      console.error("Error creating group:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create group",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="rounded-full h-10 w-10 p-0 bg-[#4d1c55]">
          <Users className="h-5 w-5 text-white" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#151515] border-[#2D221C] text-white">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-[#1D1D1D] border-[#2D221C] text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Select Members</Label>
            <div className="max-h-60 overflow-y-auto space-y-2 bg-[#1D1D1D] rounded-md p-2">
              {availableUsers.length === 0 ? (
                <p className="text-gray-400 text-center p-4">No users available</p>
              ) : (
                availableUsers.map(user => (
                  <div 
                    key={user.id}
                    className="flex items-center justify-between p-2 hover:bg-[#2D221C] rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 bg-[#2D221C]">
                        <AvatarFallback className="text-white">
                          {user.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.username}</span>
                    </div>
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={selectedUsers.some(u => u.id === user.id)}
                      onCheckedChange={() => handleUserToggle(user)}
                      className="border-[#4d1c55] data-[state=checked]:bg-[#4d1c55] data-[state=checked]:text-white"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
          
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <Label>Selected ({selectedUsers.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(user => (
                  <div 
                    key={user.id}
                    className="flex items-center gap-1 bg-[#4d1c55] rounded-full px-3 py-1"
                  >
                    <span className="text-sm">{user.username}</span>
                    <X 
                      size={16} 
                      className="cursor-pointer" 
                      onClick={() => handleUserToggle(user)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            className="border-[#2D221C] text-white hover:bg-[#2D221C] hover:text-white"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedUsers.length === 0 || isLoading}
            className="bg-[#4d1c55] hover:bg-[#6d2775] text-white"
          >
            {isLoading ? "Creating..." : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 