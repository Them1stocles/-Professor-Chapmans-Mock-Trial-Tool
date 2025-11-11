import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle2, XCircle, Upload, Loader2 } from "lucide-react";

interface ParsedStudent {
  name: string;
  email: string;
  selected: boolean;
}

interface BulkAddStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkAddStudentsDialog({ open, onOpenChange }: BulkAddStudentsDialogProps) {
  const { toast } = useToast();
  const [rawInput, setRawInput] = useState("");
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [duplicatesInPaste, setDuplicatesInPaste] = useState<string[]>([]);
  const [defaultDailyTokenLimit, setDefaultDailyTokenLimit] = useState<string>("1000");
  const [defaultMonthlyCostLimit, setDefaultMonthlyCostLimit] = useState<string>("10.00");
  const [isParsed, setIsParsed] = useState(false);

  // Parse the input text
  const handleParse = () => {
    if (!rawInput.trim()) {
      toast({
        title: "Empty Input",
        description: "Please paste student data first.",
        variant: "destructive"
      });
      return;
    }

    const normalized = rawInput
      .replace(/\s+/g, ' ')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .trim();

    // Pattern to match: Name (email)
    const pattern = /([^(,;\n\t]+?)\s*\(([^)]+)\)/g;
    const students: ParsedStudent[] = [];
    const errors: string[] = [];
    const seenEmails = new Set<string>();
    const dupes: string[] = [];

    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      let name = match[1].trim().replace(/[,;]+$/, '').trim();
      const email = match[2].trim().toLowerCase();

      // Validate email
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(email)) {
        errors.push(`Invalid email: ${email}`);
        continue;
      }

      // Check for duplicates in paste
      if (seenEmails.has(email)) {
        dupes.push(email);
        continue;
      }

      seenEmails.add(email);
      students.push({ name, email, selected: true });
    }

    if (students.length === 0 && errors.length === 0) {
      toast({
        title: "No Students Found",
        description: "Could not parse any students. Please check the format.",
        variant: "destructive"
      });
      return;
    }

    setParsedStudents(students);
    setParseErrors(errors);
    setDuplicatesInPaste(dupes);
    setIsParsed(true);

    toast({
      title: "Parsing Complete",
      description: `Found ${students.length} student${students.length !== 1 ? 's' : ''}`,
    });
  };

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: (data: { students: Array<{ name: string; email: string }>; defaultDailyTokenLimit?: number; defaultMonthlyCostLimit?: string }) =>
      apiRequest('/api/admin/students/bulk', {
        method: 'POST',
        body: data
      }),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/students'] });
      
      const { summary, results } = response;
      
      toast({
        title: "Bulk Import Complete",
        description: (
          <div className="space-y-1">
            <div>✓ Added: {summary.added}</div>
            {summary.skipped > 0 && <div>⚠ Skipped: {summary.skipped} (already exist)</div>}
            {summary.failed > 0 && <div>✗ Failed: {summary.failed}</div>}
          </div>
        ),
      });

      // Reset state
      setRawInput("");
      setParsedStudents([]);
      setParseErrors([]);
      setDuplicatesInPaste([]);
      setIsParsed(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import students",
        variant: "destructive"
      });
    }
  });

  const handleImport = () => {
    const selectedStudents = parsedStudents
      .filter(s => s.selected)
      .map(({ name, email }) => ({ name, email }));

    if (selectedStudents.length === 0) {
      toast({
        title: "No Students Selected",
        description: "Please select at least one student to import.",
        variant: "destructive"
      });
      return;
    }

    bulkImportMutation.mutate({
      students: selectedStudents,
      defaultDailyTokenLimit: defaultDailyTokenLimit ? parseInt(defaultDailyTokenLimit) : undefined,
      defaultMonthlyCostLimit: defaultMonthlyCostLimit || undefined
    });
  };

  const toggleStudent = (index: number) => {
    setParsedStudents(prev => 
      prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s)
    );
  };

  const toggleAll = () => {
    const allSelected = parsedStudents.every(s => s.selected);
    setParsedStudents(prev => 
      prev.map(s => ({ ...s, selected: !allSelected }))
    );
  };

  const selectedCount = parsedStudents.filter(s => s.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Add Students</DialogTitle>
          <DialogDescription>
            Paste your student list in the format: Name (email), Name (email), ...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isParsed ? (
            <>
              {/* Input Section */}
              <div className="space-y-2">
                <Label htmlFor="student-list">Student List</Label>
                <Textarea
                  id="student-list"
                  placeholder="Example: John Doe (john@example.com), Jane Smith (jane@example.com), ..."
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Supports comma, semicolon, or newline separated entries
                </p>
              </div>

              {/* Default Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="daily-limit">Default Daily Token Limit</Label>
                  <Input
                    id="daily-limit"
                    type="number"
                    value={defaultDailyTokenLimit}
                    onChange={(e) => setDefaultDailyTokenLimit(e.target.value)}
                    placeholder="1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly-limit">Default Monthly Cost Limit ($)</Label>
                  <Input
                    id="monthly-limit"
                    type="text"
                    value={defaultMonthlyCostLimit}
                    onChange={(e) => setDefaultMonthlyCostLimit(e.target.value)}
                    placeholder="10.00"
                  />
                </div>
              </div>

              <Button onClick={handleParse} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Parse Student List
              </Button>
            </>
          ) : (
            <>
              {/* Preview Section */}
              <div className="space-y-4">
                {/* Summary */}
                <div className="flex items-center gap-4">
                  <Badge variant="default" className="text-sm">
                    {parsedStudents.length} students found
                  </Badge>
                  {parseErrors.length > 0 && (
                    <Badge variant="destructive" className="text-sm">
                      {parseErrors.length} errors
                    </Badge>
                  )}
                  {duplicatesInPaste.length > 0 && (
                    <Badge variant="secondary" className="text-sm">
                      {duplicatesInPaste.length} duplicates in paste
                    </Badge>
                  )}
                </div>

                {/* Errors */}
                {parseErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-1">Parsing Errors:</div>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {parseErrors.slice(0, 5).map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                        {parseErrors.length > 5 && (
                          <li>... and {parseErrors.length - 5} more</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Duplicates in Paste */}
                {duplicatesInPaste.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold mb-1">Duplicate emails in paste (removed):</div>
                      <div className="text-sm">{duplicatesInPaste.join(', ')}</div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Student Table */}
                {parsedStudents.length > 0 && (
                  <div className="border rounded-lg">
                    <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={parsedStudents.every(s => s.selected)}
                          onCheckedChange={toggleAll}
                        />
                        <span className="text-sm font-medium">
                          Select All ({selectedCount} of {parsedStudents.length} selected)
                        </span>
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedStudents.map((student, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Checkbox
                                  checked={student.selected}
                                  onCheckedChange={() => toggleStudent(index)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{student.name}</TableCell>
                              <TableCell className="text-muted-foreground">{student.email}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsParsed(false);
                    setParsedStudents([]);
                    setParseErrors([]);
                    setDuplicatesInPaste([]);
                  }}
                  className="flex-1"
                >
                  Back to Edit
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedCount === 0 || bulkImportMutation.isPending}
                  className="flex-1"
                >
                  {bulkImportMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Import {selectedCount} Student{selectedCount !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
