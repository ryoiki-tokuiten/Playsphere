import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

// Categories based on existing games
const CATEGORIES = [
  'Action',
  'RPG',
  'Adventure',
  'Strategy',
  'Simulation',
  'Shooter',
  'Puzzle',
  'Survival',
  'Platformer',
  'Fighting',
  'Racing',
  'Sports'
];

// Updated platforms based on user requirements
const PLATFORMS = [
  'PC',
  'Games',
  'Console'
];

export function AddGameForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    downloads: 0
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: "Missing Information",
        description: "Game name is required.",
        variant: "destructive"
      });
      return;
    }

    if (selectedCategories.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select at least one category.",
        variant: "destructive"
      });
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select at least one platform.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.contact) {
      toast({
        title: "Missing Information",
        description: "Contact information is required.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.downloads) {
      toast({
        title: "Missing Information",
        description: "Total downloads is required.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id, // For admin verification
          game: {
            name: formData.name,
            categories: selectedCategories,
            platforms: selectedPlatforms,
            contact: formData.contact || null,
            downloads: parseInt(formData.downloads.toString()) || 0
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add game');
      }

      const newGame = await response.json();

      toast({
        title: "Success!",
        description: `Game "${newGame.name}" has been added to the system.`,
        variant: "default"
      });

      // Reset form
      setFormData({
        name: '',
        contact: '',
        downloads: 0
      });
      setSelectedCategories([]);
      setSelectedPlatforms([]);
    } catch (error) {
      console.error('Error adding game:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add game",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="name">Game Name</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="Enter game name"
          className="bg-[#1A1A1A] border-[#3A3A3A] text-white"
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-3">
        <Label>Categories</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-[#1A1A1A] p-4 rounded-md border border-[#3A3A3A]">
          {CATEGORIES.map(category => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox 
                id={`category-${category}`} 
                checked={selectedCategories.includes(category)}
                onCheckedChange={() => toggleCategory(category)}
                disabled={isSubmitting}
                className="data-[state=checked]:bg-[#EC1146] data-[state=checked]:border-[#EC1146]"
              />
              <Label 
                htmlFor={`category-${category}`}
                className="text-sm font-normal cursor-pointer text-white"
              >
                {category}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Platforms</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-[#1A1A1A] p-4 rounded-md border border-[#3A3A3A]">
          {PLATFORMS.map(platform => (
            <div key={platform} className="flex items-center space-x-2">
              <Checkbox 
                id={`platform-${platform}`} 
                checked={selectedPlatforms.includes(platform)}
                onCheckedChange={() => togglePlatform(platform)}
                disabled={isSubmitting}
                className="data-[state=checked]:bg-[#EC1146] data-[state=checked]:border-[#EC1146]"
              />
              <Label 
                htmlFor={`platform-${platform}`}
                className="text-sm font-normal cursor-pointer text-white"
              >
                {platform}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="contact">Contact Information</Label>
        <Textarea
          id="contact"
          name="contact"
          value={formData.contact}
          onChange={handleInputChange}
          placeholder="Website, email, or other contact information"
          className="bg-[#1A1A1A] border-[#3A3A3A] min-h-[100px] text-white"
          disabled={isSubmitting}
          required
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor="downloads">Total Downloads</Label>
        <Input
          id="downloads"
          name="downloads"
          type="number"
          value={formData.downloads.toString()}
          onChange={handleInputChange}
          placeholder="Number of downloads"
          className="bg-[#1A1A1A] border-[#3A3A3A] text-white"
          disabled={isSubmitting}
          required
        />
      </div>

      <Button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full bg-[#EC1146] hover:bg-[#EC1146]/90 text-white relative"
      >
        {isSubmitting && (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        )}
        {isSubmitting ? 'Adding Game...' : 'Add Game'}
      </Button>
    </form>
  );
} 