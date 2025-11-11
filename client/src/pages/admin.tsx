import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Trash2, Plus, Settings, Users, BarChart3, AlertTriangle, LogOut, Upload } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Student, Settings as SchemaSettings, ViolationEvent } from "@shared/schema";
import { BulkAddStudentsDialog } from "@/components/BulkAddStudentsDialog";

// API Response Types - matching actual server responses
interface AdminAuthResponse {
  authenticated: boolean;
}

// Students API returns Student[] directly from schema
type AdminStudent = Student;

// Settings API returns Settings directly from schema
type AdminSettings = SchemaSettings;

// Usage API response structure from server/routes.ts lines 523-529
interface UsageStats {
  global: {
    daily: { totalTokens: number; totalCost: number };
    monthly: { totalTokens: number; totalCost: number };
  };
  students: Array<{
    email: string;
    name: string;
    daily: { totalTokens: number; totalCost: number };
    monthly: { totalTokens: number; totalCost: number };
  }>;
}

// Violation events API returns ViolationEvent[] directly from schema
type AdminViolationEvent = ViolationEvent;

const addStudentSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(1, "Name is required"),
  dailyTokenLimit: z.number().min(1, "Daily limit must be at least 1").max(10000, "Daily limit too high").nullable(),
  monthlyCostLimit: z.string().min(1, "Monthly cost limit is required"),
});

export default function AdminDashboard() {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginForm, setLoginForm] = useState({ password: "" });
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const { toast } = useToast();

  // Check authentication status
  const { data: authStatus } = useQuery<AdminAuthResponse | null>({
    queryKey: ['/api/admin/me'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    retry: false,
  });

  useEffect(() => {
    if (authStatus !== undefined) {
      setIsAuthenticated(authStatus?.authenticated || false);
      setAuthChecked(true);
    }
  }, [authStatus]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (password: string) => 
      apiRequest<AdminAuthResponse>('/api/admin/login', {
        method: 'POST',
        body: { password }
      }),
    onSuccess: () => {
      setIsAuthenticated(true);
      toast({ title: "Welcome Professor Chapman!", description: "Admin dashboard access granted." });
      queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
    },
    onError: () => {
      toast({ title: "Login Failed", description: "Invalid password. Please try again.", variant: "destructive" });
    }
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/logout', { method: 'POST' }),
    onSuccess: () => {
      setIsAuthenticated(false);
      toast({ title: "Logged Out", description: "Admin session ended." });
    }
  });

  // Data queries (only when authenticated)
  const { data: students = [] } = useQuery<AdminStudent[]>({
    queryKey: ['/api/admin/students'],
    enabled: isAuthenticated,
  });

  const { data: settings } = useQuery<AdminSettings>({
    queryKey: ['/api/admin/settings'],
    enabled: isAuthenticated,
  });

  const { data: usage } = useQuery<UsageStats>({
    queryKey: ['/api/admin/usage'],
    enabled: isAuthenticated,
  });

  const { data: violations = [] } = useQuery<AdminViolationEvent[]>({
    queryKey: ['/api/admin/violations'],
    enabled: isAuthenticated,
  });

  // Mutations
  const addStudentMutation = useMutation({
    mutationFn: (data: z.infer<typeof addStudentSchema>) =>
      apiRequest<AdminStudent>('/api/admin/students', {
        method: 'POST',
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/students'] });
      setAddStudentOpen(false);
      toast({ title: "Student Added", description: "Student has been added to the whitelist." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add student.", 
        variant: "destructive" 
      });
    }
  });

  const updateStudentMutation = useMutation({
    mutationFn: ({ email, data }: { email: string; data: Partial<AdminStudent> }) =>
      apiRequest<AdminStudent>(`/api/admin/students/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/students'] });
      toast({ title: "Student Updated", description: "Student settings have been updated." });
    }
  });

  const deleteStudentMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest<{ success: boolean; message: string }>(`/api/admin/students/${encodeURIComponent(email)}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/students'] });
      toast({ title: "Student Removed", description: "Student has been removed from the whitelist." });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<AdminSettings>) =>
      apiRequest<AdminSettings>('/api/admin/settings', {
        method: 'PATCH',
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({ title: "Settings Updated", description: "System settings have been updated." });
    }
  });

  const addStudentForm = useForm<z.infer<typeof addStudentSchema>>({
    resolver: zodResolver(addStudentSchema),
    defaultValues: {
      email: "",
      name: "",
      dailyTokenLimit: 1000,
      monthlyCostLimit: "10.00",
    },
  });

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Princess Bride Admin</CardTitle>
            <CardDescription>
              Professor Chapman's Administrative Dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate(loginForm.password);
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Admin Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ password: e.target.value })}
                  placeholder="Enter admin password"
                  data-testid="input-admin-password"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loginMutation.isPending}
                data-testid="button-admin-login"
              >
                {loginMutation.isPending ? "Signing In..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                ← Back to Princess Bride Chat
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Princess Bride Admin Dashboard</h1>
              <p className="text-muted-foreground">Professor Chapman's English Literature Tool</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" data-testid="link-back-chat">
                <Button variant="outline" size="sm">
                  Back to Chat
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => logoutMutation.mutate()}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="students" data-testid="tab-students">
              <Users className="h-4 w-4 mr-2" />
              Students
            </TabsTrigger>
            <TabsTrigger value="usage" data-testid="tab-usage">
              <BarChart3 className="h-4 w-4 mr-2" />
              Usage
            </TabsTrigger>
            <TabsTrigger value="violations" data-testid="tab-violations">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Violations
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-students">
                    {students.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {students.filter(s => s.isActive).length} active
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Requests</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-daily-requests">
                    {usage?.global.daily.totalTokens || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ${(usage?.global.daily.totalCost || 0).toFixed(2)} cost
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Requests</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-monthly-requests">
                    {usage?.global.monthly.totalTokens || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ${(usage?.global.monthly.totalCost || 0).toFixed(2)} cost
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Violations Today</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-violations-today">
                    {violations.filter(v => {
                      const today = new Date();
                      const violationDate = new Date(v.timestamp);
                      return violationDate.toDateString() === today.toDateString();
                    }).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Content filter blocks
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Current system configuration and limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Content Filter</span>
                  <Badge variant="default">
                    {settings?.contentFilterMode || "Normal"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Global Daily Token Limit</span>
                  <span className="text-muted-foreground">{settings?.globalDailyTokenLimit || "No limit"} tokens</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Global Monthly Cost Limit</span>
                  <span className="text-muted-foreground">${settings?.globalMonthlyCostLimit || "No limit"}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Student Management</h2>
                <p className="text-muted-foreground">Manage student access and usage limits</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setBulkAddOpen(true)}
                  data-testid="button-bulk-add-students"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Add
                </Button>
                <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-student">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Student
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Student</DialogTitle>
                    <DialogDescription>
                      Add a student to the whitelist with usage limits.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...addStudentForm}>
                    <form onSubmit={addStudentForm.handleSubmit((data) => addStudentMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={addStudentForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student Email</FormLabel>
                            <FormControl>
                              <Input placeholder="student@college.edu" {...field} data-testid="input-student-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addStudentForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Student Name" {...field} data-testid="input-student-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addStudentForm.control}
                        name="dailyTokenLimit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Daily Token Limit</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                data-testid="input-daily-token-limit"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addStudentForm.control}
                        name="monthlyCostLimit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Cost Limit ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="text" 
                                placeholder="10.00"
                                {...field} 
                                data-testid="input-monthly-cost-limit"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={addStudentMutation.isPending} data-testid="button-add-student-submit">
                          {addStudentMutation.isPending ? "Adding..." : "Add Student"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              </div>
            </div>

            {/* Bulk Add Students Dialog */}
            <BulkAddStudentsDialog 
              open={bulkAddOpen} 
              onOpenChange={setBulkAddOpen}
            />

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Daily Usage</TableHead>
                      <TableHead>Monthly Usage</TableHead>
                      <TableHead>Violations</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student: Student) => (
                      <TableRow key={student.email}>
                        <TableCell className="font-medium">{student.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={student.isActive}
                              onCheckedChange={(checked) => 
                                updateStudentMutation.mutate({ 
                                  email: student.email, 
                                  data: { isActive: checked } 
                                })
                              }
                              data-testid={`switch-student-active-${student.email}`}
                            />
                            <span className="text-sm text-muted-foreground">
                              {student.isActive ? "Active" : "Disabled"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span data-testid={`usage-daily-${student.email}`}>
                            Daily: {student.dailyTokenLimit || "No limit"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span data-testid={`usage-monthly-${student.email}`}>
                            Monthly: ${student.monthlyCostLimit || "No limit"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={violations.filter(v => v.studentEmail === student.email).length > 0 ? "destructive" : "outline"}>
                            {violations.filter(v => v.studentEmail === student.email).length}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteStudentMutation.mutate(student.email)}
                            disabled={deleteStudentMutation.isPending}
                            data-testid={`button-delete-student-${student.email}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {students.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No students added yet. Add students to the whitelist to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Usage Analytics</h2>
              <p className="text-muted-foreground">Monitor system usage and costs</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Usage</CardTitle>
                  <CardDescription>Today's request and cost breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Tokens</span>
                    <span className="font-medium">{usage?.global.daily.totalTokens || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Cost</span>
                    <span className="font-medium">${(usage?.global.daily.totalCost || 0).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Cost/Token</span>
                    <span className="font-medium">
                      ${usage?.global.daily.totalTokens ? (usage.global.daily.totalCost / usage.global.daily.totalTokens).toFixed(6) : "0.000000"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Usage</CardTitle>
                  <CardDescription>This month's cumulative usage</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Tokens</span>
                    <span className="font-medium">{usage?.global.monthly.totalTokens || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Cost</span>
                    <span className="font-medium">${(usage?.global.monthly.totalCost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Cost/Token</span>
                    <span className="font-medium">
                      ${usage?.global.monthly.totalTokens ? (usage.global.monthly.totalCost / usage.global.monthly.totalTokens).toFixed(6) : "0.000000"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Student Usage Breakdown</CardTitle>
                <CardDescription>Individual student usage statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Daily Usage</TableHead>
                      <TableHead>Monthly Usage</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students
                      .sort((a: Student, b: Student) => (a.email > b.email ? 1 : -1))
                      .map((student: Student) => {
                        const studentUsage = usage?.students.find(s => s.email === student.email);
                        return (
                          <TableRow key={student.email}>
                            <TableCell className="font-medium">{student.name || student.email}</TableCell>
                            <TableCell>Daily: ${(studentUsage?.daily.totalCost || 0).toFixed(4)}</TableCell>
                            <TableCell>Monthly: ${(studentUsage?.monthly.totalCost || 0).toFixed(2)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-muted rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full" 
                                    style={{ width: `${Math.min(50, 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {studentUsage ? `${studentUsage.monthly.totalTokens} tokens` : "No usage"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={student.isActive ? "default" : "secondary"}>
                                {student.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Violations Tab */}
          <TabsContent value="violations" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Content Violations</h2>
              <p className="text-muted-foreground">Monitor blocked questions and policy violations</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Violations</CardTitle>
                <CardDescription>Questions blocked by content filtering</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {violations.map((violation: ViolationEvent) => (
                      <TableRow key={violation.id}>
                        <TableCell className="font-medium">{violation.studentEmail}</TableCell>
                        <TableCell className="max-w-md truncate">{violation.detail}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{violation.category}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(violation.timestamp).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {violations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No violations recorded. Content filtering is working effectively.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">System Settings</h2>
              <p className="text-muted-foreground">Configure global system parameters</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Global Limits</CardTitle>
                <CardDescription>System-wide usage limits and controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Content Filter Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Switch between normal and strict content filtering
                    </p>
                  </div>
                  <Switch
                    checked={settings?.contentFilterMode === 'strict'}
                    onCheckedChange={(checked) => 
                      updateSettingsMutation.mutate({ contentFilterMode: checked ? 'strict' : 'normal' })
                    }
                    data-testid="switch-content-filter"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="globalDailyTokenLimit">Global Daily Token Limit</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="globalDailyTokenLimit"
                      type="number"
                      value={settings?.globalDailyTokenLimit || ''}
                      onChange={(e) => 
                        updateSettingsMutation.mutate({ 
                          globalDailyTokenLimit: e.target.value ? Number(e.target.value) : null 
                        })
                      }
                      className="w-32"
                      data-testid="input-global-daily-token-limit"
                    />
                    <span className="text-sm text-muted-foreground">tokens per day</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Maximum total requests allowed across all students per day
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="globalMonthlyCostLimit">Global Monthly Cost Limit</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="globalMonthlyCostLimit"
                      type="text"
                      placeholder="100.00"
                      value={settings?.globalMonthlyCostLimit || ''}
                      onChange={(e) => 
                        updateSettingsMutation.mutate({ 
                          globalMonthlyCostLimit: e.target.value 
                        })
                      }
                      className="w-32"
                      data-testid="input-global-monthly-cost-limit"
                    />
                    <span className="text-sm text-muted-foreground">dollars per month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Maximum total requests allowed across all students per month
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Filtering</CardTitle>
                <CardDescription>Automatic blocking of non-English literature content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Content Filter Status</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The system automatically blocks questions about math, science, and other non-English literature subjects.
                    Violations are logged for review.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Violations Today</span>
                    <span className="text-sm font-medium">{violations.filter(v => {
                      const today = new Date();
                      const violationDate = new Date(v.timestamp);
                      return violationDate.toDateString() === today.toDateString();
                    }).length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Authentication and access controls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Admin Authentication</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Rate Limiting</span>
                    <Badge variant="default">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Student Whitelist</span>
                    <Badge variant="default">Required</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    All security features are active. Only whitelisted students can access the system,
                    and admin access requires password authentication.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}