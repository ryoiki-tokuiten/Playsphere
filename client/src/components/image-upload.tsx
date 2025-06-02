import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  currentImage?: string;
  onImageSelected?: (url: string) => void;
  onImageUploaded?: (url: string) => void;
  maxSize?: number;
}

export function ImageUpload({ 
  currentImage, 
  onImageSelected, 
  onImageUploaded,
  maxSize = 5 * 1024 * 1024 // Default to 5MB
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size
    if (maxSize && file.size > maxSize) {
      toast({
        title: 'Error',
        description: `File size exceeds maximum allowed (${(maxSize / (1024 * 1024)).toFixed(1)}MB)`,
        variant: 'destructive',
      });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { url } = await response.json();
      
      // Call the appropriate callback
      if (onImageSelected) {
        onImageSelected(url);
      }
      
      if (onImageUploaded) {
        onImageUploaded(url);
      }
      
      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {(currentImage || previewUrl) && (
        <img
          src={previewUrl || currentImage}
          alt="Image preview"
          className="max-w-full max-h-64 rounded-lg object-contain"
        />
      )}
      <div className="relative">
        <Input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="image-upload"
        />
        <Button
          type="button"
          variant="outline"
          className="relative"
          disabled={isUploading}
          onClick={() => document.getElementById('image-upload')?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {isUploading ? 'Uploading...' : 'Select Image'}
        </Button>
      </div>
    </div>
  );
} 