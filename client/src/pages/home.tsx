import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertChatSessionSchema, type InsertChatSession } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Users, MessageCircle } from "lucide-react";
import { z } from "zod";
import { AuroraBackground } from "@/components/ui/aurora-background";

// Extend the schema to include validation for the form
const sessionFormSchema = insertChatSessionSchema.extend({
  characterName: z.string().min(1, "Character name is required"),
  situation: z.string().min(10, "Please describe the situation in more detail"),
  studentEmail: z.string().email("Valid email is required"),
  studentName: z.string().optional()
});

type SessionFormData = z.infer<typeof sessionFormSchema>;

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SessionFormData>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: {
      characterName: "",
      situation: "",
      studentEmail: "",
      studentName: ""
    }
  });

  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: InsertChatSession) => {
      const response = await apiRequest<any>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify(sessionData)
      });
      return response;
    },
    onSuccess: (session: any) => {
      toast({
        title: "Session Created",
        description: `Ready to question ${session.characterName} about ${session.situation.substring(0, 50)}...`
      });
      setLocation(`/chat/${session.id}`);
    },
    onError: (error) => {
      console.error('Session creation error:', error);
      toast({
        title: "Error",
        description: "Failed to create session. Please try again.",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: SessionFormData) => {
    createSessionMutation.mutate({
      characterName: data.characterName,
      situation: data.situation,
      studentEmail: data.studentEmail,
      studentName: data.studentName || null
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              The Princess Bride
            </h1>
            <p className="text-xl md:text-2xl mb-4 text-blue-100">
              Mock Trial Preparation Tool
            </p>
            <p className="text-lg mb-8 text-blue-100">
              Question any character from The Princess Bride to prepare for your mock trial. 
              Get authentic responses from Westley, Buttercup, Inigo, and more!
            </p>
          </div>
        </div>
      </div>

      {/* Features Section with Aurora Background */}
      <AuroraBackground className="h-auto min-h-0">
        <div className="container mx-auto px-4 py-12 relative z-10">
          <div className="grid md:grid-cols-3 gap-8 mb-12">
          <Card className="text-center">
            <CardHeader>
              <Users className="w-12 h-12 mx-auto text-blue-600 mb-4" />
              <CardTitle>Any Character</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Question major characters like Westley and Inigo, or minor ones like village guards and the Impressive Clergyman.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <BookOpen className="w-12 h-12 mx-auto text-purple-600 mb-4" />
              <CardTitle>Book & Movie</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Characters acknowledge both book and movie versions, explicitly noting differences when they exist.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <MessageCircle className="w-12 h-12 mx-auto text-green-600 mb-4" />
              <CardTitle>Professor Guidance</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Get help from Professor Chapman for reasoning skills, better questions, and critical thinking strategies.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Session Creation Form */}
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Start Your Investigation</CardTitle>
              <CardDescription>
                Choose which character you want to question and what situation you're investigating for your mock trial.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="studentEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Email</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="email"
                            placeholder="your.email@example.com"
                            data-testid="input-student-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="studentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Name (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Enter your name for usage tracking"
                            data-testid="input-student-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="characterName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Character to Question</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="e.g., Westley, Buttercup, Inigo Montoya, Fezzik, Prince Humperdinck..."
                            data-testid="input-character-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="situation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Situation to Investigate</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Describe the event or situation you want to investigate. Be specific about what happened, when, and who was involved. Example: 'The approach to the Cliffs of Insanity and what each person observed during the climb.'"
                            rows={4}
                            data-testid="textarea-situation"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={form.handleSubmit(onSubmit)}
                disabled={createSessionMutation.isPending}
                className="w-full"
                data-testid="button-start-session"
              >
                {createSessionMutation.isPending ? "Creating Session..." : "Begin Questioning"}
              </Button>
            </CardFooter>
          </Card>

          {/* Instructions */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>How to Use This Tool</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">1. Choose Your Character</h4>
                <p className="text-sm text-muted-foreground">
                  Type any character name from The Princess Bride. You can question major characters like Westley or "The Dread Pirate Roberts," 
                  or minor ones like "the guard at the gate" or "villager in Florin."
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">2. Describe Your Investigation</h4>
                <p className="text-sm text-muted-foreground">
                  Be specific about what event or situation you want to explore. The more detailed your setup, 
                  the more helpful the character's testimony will be for your mock trial.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">3. Ask Strategic Questions</h4>
                <p className="text-sm text-muted-foreground">
                  The character will stay in character and respond based on their knowledge and perspective. 
                  If they don't know something, they'll tell you and suggest who might know more.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">4. Get Professor Help</h4>
                <p className="text-sm text-muted-foreground">
                  Use the "Ask Professor Chapman" feature when you need help formulating better questions 
                  or understanding reasoning principles.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </AuroraBackground>
    </div>
  );
}