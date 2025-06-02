import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { GamingCard } from '@/components/gaming-card';
import { User } from '@shared/schema';

export default function SharePage() {
  const { username } = useParams();
  
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const sharedUser = users.find(user => user.username === username);

  if (!sharedUser) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Gaming Card Not Found</h1>
          <p className="text-gray-400">This gaming card doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] p-4 flex items-center justify-center">
      <GamingCard user={sharedUser} />
    </div>
  );
}
