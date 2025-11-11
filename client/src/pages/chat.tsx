import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  Send, 
  User, 
  Bot, 
  GraduationCap, 
  DollarSign, 
  Coins,
  ArrowLeft,
  HelpCircle
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { ChatSession, ChatMessage } from "@shared/schema";
import { ContentWarningDialog } from "@/components/ContentWarningDialog";

interface ChatPageProps {}

export default function ChatPage({}: ChatPageProps) {
  const [, params] = useRoute("/chat/:sessionId");
  const sessionId = params?.sessionId;
  const [message, setMessage] = useState("");
  const [isProfessorMode, setIsProfessorMode] = useState(false);
  const [pendingWarning, setPendingWarning] = useState<{
    content: string;
    violationId: string;
    category: string;
    message: string;
    details: string;
    confidence: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch session details
  const { data: session, isLoading: sessionLoading } = useQuery<ChatSession>({
    queryKey: ['/api/sessions', sessionId],
    enabled: !!sessionId,
  });

  // Fetch messages
  const { data: messages, isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ['/api/sessions', sessionId, 'messages'],
    enabled: !!sessionId,
  });

  // Fetch usage stats
  const { data: usageData } = useQuery({
    queryKey: ['/api/usage'],
    queryFn: () => apiRequest(`/api/usage?sessionId=${sessionId}`),
    enabled: !!sessionId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Send message mutation with automatic detection + manual override
  const sendMessageMutation = useMutation({
    mutationFn: async ({ 
      content, 
      isProfessorMode, 
      bypassWarning = false, 
      violationId 
    }: { 
      content: string; 
      isProfessorMode: boolean;
      bypassWarning?: boolean;
      violationId?: string;
    }) => {
      const endpoint = isProfessorMode 
        ? `/api/sessions/${sessionId}/professor-mode`
        : `/api/sessions/${sessionId}/messages`;
      
      const body = isProfessorMode 
        ? JSON.stringify({ question: content })
        : JSON.stringify({ content, bypassWarning, violationId });

      return apiRequest(endpoint, {
        method: 'POST',
        body
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/usage'] });
      setMessage("");
      setIsProfessorMode(false);
      setPendingWarning(null);
    },
    onError: (error: any) => {
      console.error('Send message error:', error);
      
      // Check if it's a content warning (409 status)
      if (error.status === 409 && error.warning) {
        setPendingWarning({
          content: message,
          violationId: error.violationId,
          category: error.category,
          message: error.message,
          details: error.details,
          confidence: error.confidence
        });
      } else {
        // Real error
        toast({
          title: "Error",
          description: error.message || "Failed to send message. Please try again.",
          variant: "destructive"
        });
      }
    }
  });

  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    sendMessageMutation.mutate({ 
      content: message, 
      isProfessorMode 
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (sessionLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-64 mb-4" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-16 flex-1" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Session Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The chat session you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-character-name">
                  Questioning: {session.characterName}
                </h1>
                <p className="text-sm text-muted-foreground" data-testid="text-situation">
                  About: {session.situation}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {usageData && (
                <div className="flex items-center gap-2 text-sm">
                  <Coins className="w-4 h-4" />
                  <span data-testid="text-token-count">{usageData.totals.tokens} tokens</span>
                  <DollarSign className="w-4 h-4" />
                  <span data-testid="text-cost">${usageData.totals.cost}</span>
                </div>
              )}
              {session.studentName && (
                <Badge variant="secondary" data-testid="badge-student-name">
                  {session.studentName}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Chat Area */}
            <div className="lg:col-span-3">
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Witness Questioning
                  </CardTitle>
                  <CardDescription>
                    Ask {session.characterName} about {session.situation.substring(0, 60)}...
                  </CardDescription>
                </CardHeader>
                
                <Separator />
                
                {/* Messages */}
                <ScrollArea className="flex-1 px-6 py-4">
                  <div className="space-y-4">
                    {messagesLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex gap-3">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-16 flex-1" />
                          </div>
                        ))}
                      </div>
                    ) : messages && messages.length > 0 ? (
                      messages.map((msg: ChatMessage) => (
                        <div key={msg.id} className="flex gap-3">
                          <div className="flex-shrink-0">
                            {msg.role === 'user' ? (
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                              </div>
                            ) : msg.content.includes('[Professor Chapman]') ? (
                              <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                <GraduationCap className="w-4 h-4 text-green-600 dark:text-green-300" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                                <Bot className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="bg-muted rounded-lg p-3">
                              <div className="text-sm whitespace-pre-wrap" data-testid={`message-${msg.id}`}>
                                {msg.content}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          No messages yet. Start by asking {session.characterName} a question!
                        </p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <Separator />

                {/* Message Input */}
                <div className="p-4">
                  <div className="flex gap-2">
                    <Button
                      variant={isProfessorMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsProfessorMode(!isProfessorMode)}
                      data-testid="button-professor-mode"
                    >
                      <GraduationCap className="w-4 h-4 mr-2" />
                      {isProfessorMode ? "Asking Professor" : "Ask Professor"}
                    </Button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={
                        isProfessorMode 
                          ? "Ask Professor Chapman for guidance..." 
                          : `Ask ${session.characterName} a question...`
                      }
                      disabled={sendMessageMutation.isPending}
                      className="flex-1"
                      data-testid="input-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!message.trim() || sendMessageMutation.isPending}
                      data-testid="button-send-message"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  {isProfessorMode ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      Professor Chapman mode: Get help with reasoning, better questions, and critical thinking strategies.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 The system automatically detects when you need Professor Chapman's guidance vs. character testimony
                    </p>
                  )}
                </div>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Usage Stats */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Usage Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {usageData ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Tokens Used:</span>
                        <span className="font-mono" data-testid="sidebar-tokens">
                          {usageData.totals.tokens}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Estimated Cost:</span>
                        <span className="font-mono" data-testid="sidebar-cost">
                          ${usageData.totals.cost}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Messages:</span>
                        <span className="font-mono">
                          {messages ? Math.ceil(messages.length / 2) : 0}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Help Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    How It Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div>
                    <p className="font-semibold">Automatic Detection</p>
                    <p className="text-muted-foreground">
                      By default, the system chooses between character testimony and Professor Chapman's guidance automatically.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Manual Override</p>
                    <p className="text-muted-foreground">
                      Use "Ask Professor" button to directly ask Professor Chapman mid-examination.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Both Modes Available</p>
                    <p className="text-muted-foreground">
                      Smart auto-detection plus manual control for flexible questioning strategies.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Content Warning Dialog */}
      <ContentWarningDialog
        open={!!pendingWarning}
        onOpenChange={(open) => !open && setPendingWarning(null)}
        warning={pendingWarning}
        onProceed={() => {
          if (pendingWarning) {
            sendMessageMutation.mutate({
              content: pendingWarning.content,
              isProfessorMode: false,
              bypassWarning: true,
              violationId: pendingWarning.violationId
            });
          }
        }}
        onCancel={() => setPendingWarning(null)}
      />
    </div>
  );
}