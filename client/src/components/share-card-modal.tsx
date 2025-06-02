import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Updated props interface to support both older and newer usage patterns
interface ShareCardModalProps {
  // For the new implementation
  username?: string;
  onClose?: () => void;
  
  // For backward compatibility
  user?: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ShareCardModal(props: ShareCardModalProps) {
  const { toast } = useToast();
  
  // Support both usage patterns
  const username = props.username || props.user?.username;
  const isOpen = props.open !== undefined ? props.open : true;
  const handleOpenChange = props.onOpenChange || props.onClose;
  
  // Generate a shareable URL for the gaming card
  const cardUrl = `${window.location.origin}/share/${username}`;

  const handleClose = () => {
    if (props.onClose) {
      props.onClose();
    } else if (props.onOpenChange) {
      props.onOpenChange(false);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={props.onOpenChange ? props.onOpenChange : () => handleClose()}
    >
      <DialogContent className="bg-[#0f0f0f] text-white border-[#2D221C]">
        <DialogHeader>
          <DialogTitle>Share Gaming Card</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 p-4">
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG
              value={cardUrl}
              size={200}
              level="H"
              includeMargin
            />
          </div>
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(cardUrl);
              toast({
                title: "Link Copied!",
                description: "Profile link has been copied to clipboard",
              });
            }}
            className="w-full bg-[#EC1146] hover:bg-[#EC1146]/90"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Profile Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
