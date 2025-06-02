import { useLocation } from 'wouter';
import { useToast } from "@/components/ui/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";

const CreateCard: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: '',
      profilePicture: '',
      language: '',
      region: '',
      gamesPlayed: [],
      currentGame: '',
      currentGameId: '',
    },
  });

  const onSubmit = async (data: InsertUser) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      const result = await response.json();
      
      if (result.id) {
        localStorage.setItem('user', JSON.stringify(result));
        
        toast({
          title: "Profile Created!",
          description: "Your gaming profile has been created successfully.",
        });

        setLocation('/');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: "Failed to create profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Your existing form fields here */}
    </form>
  );
};

export default CreateCard; 