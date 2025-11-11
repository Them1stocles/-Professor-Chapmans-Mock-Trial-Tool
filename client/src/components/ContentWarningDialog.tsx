import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface ContentWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warning: {
    content: string;
    violationId: string;
    category: string;
    message: string;
    details: string;
    confidence: number;
  } | null;
  onProceed: () => void;
  onCancel: () => void;
}

export function ContentWarningDialog({
  open,
  onOpenChange,
  warning,
  onProceed,
  onCancel
}: ContentWarningDialogProps) {
  if (!warning) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Content Warning
          </DialogTitle>
          <DialogDescription>
            This question may not be related to The Princess Bride
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Detected Category:</span>
            <Badge variant="secondary" className="uppercase">
              {warning.category}
            </Badge>
            <span className="text-sm text-muted-foreground">
              ({(warning.confidence * 100).toFixed(0)}% confidence)
            </span>
          </div>

          {/* Warning Alert */}
          <Alert variant="default" className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              {warning.message}
            </AlertDescription>
          </Alert>

          {/* User's Question */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Your question:</p>
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm italic">"{warning.content}"</p>
            </div>
          </div>

          {/* Filter Analysis */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Filter Analysis:</p>
            <p className="text-sm text-muted-foreground">{warning.details}</p>
          </div>

          {/* Explanation */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>If your question relates to The Princess Bride</strong> (characters, plot, themes, 
              literary analysis, or reasoning techniques), you may proceed.
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-2">
              This tool is designed for English literature coursework. Questions about other subjects 
              may waste your usage credits.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onProceed} className="bg-yellow-600 hover:bg-yellow-700">
            Yes, This Relates to The Princess Bride
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
