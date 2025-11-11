import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createCharacterResponse, calculateCost } from "./openai-service";
import { adminLogin, adminLogout, adminMe, requireAdmin } from "./admin-auth";
import { shouldBlockContent, logContentViolation } from "./content-filter";
import { 
  insertChatSessionSchema, 
  insertChatMessageSchema,
  insertStudentSchema,
  insertSettingsSchema,
  type ChatMessage,
  type Student 
} from "@shared/schema";
import { z } from "zod";

// Helper function to check usage limits
async function checkUsageLimits(studentEmail: string): Promise<{
  canProceed: boolean;
  reason?: string;
  limitsInfo: {
    dailyTokens: number;
    monthlyTokens: number;
    dailyCost: number;
    monthlyCost: number;
  };
}> {
  try {
    // Get student limits
    const student = await storage.getStudent(studentEmail);
    if (!student || !student.isActive) {
      return {
        canProceed: false,
        reason: "Student not found or inactive",
        limitsInfo: { dailyTokens: 0, monthlyTokens: 0, dailyCost: 0, monthlyCost: 0 }
      };
    }

    // Get global settings
    const settings = await storage.getSettings();

    // Get usage for this student
    const dailyUsage = await storage.getUsageByStudent(studentEmail, 'day');
    const monthlyUsage = await storage.getUsageByStudent(studentEmail, 'month');

    // Get global usage
    const globalDailyUsage = await storage.getGlobalUsage('day');
    const globalMonthlyUsage = await storage.getGlobalUsage('month');

    // Check individual limits
    if (student.dailyTokenLimit && dailyUsage.totalTokens >= student.dailyTokenLimit) {
      return {
        canProceed: false,
        reason: `Daily token limit reached (${student.dailyTokenLimit} tokens). Resets at midnight.`,
        limitsInfo: { 
          dailyTokens: dailyUsage.totalTokens, 
          monthlyTokens: monthlyUsage.totalTokens,
          dailyCost: dailyUsage.totalCost,
          monthlyCost: monthlyUsage.totalCost
        }
      };
    }

    if (student.monthlyCostLimit && monthlyUsage.totalCost >= parseFloat(student.monthlyCostLimit)) {
      return {
        canProceed: false,
        reason: `Monthly cost limit reached ($${student.monthlyCostLimit}). Resets on the 1st of next month.`,
        limitsInfo: { 
          dailyTokens: dailyUsage.totalTokens, 
          monthlyTokens: monthlyUsage.totalTokens,
          dailyCost: dailyUsage.totalCost,
          monthlyCost: monthlyUsage.totalCost
        }
      };
    }

    // Check global limits
    if (settings?.globalDailyTokenLimit && globalDailyUsage.totalTokens >= settings.globalDailyTokenLimit) {
      return {
        canProceed: false,
        reason: `Global daily token limit reached (${settings.globalDailyTokenLimit} tokens). Resets at midnight.`,
        limitsInfo: { 
          dailyTokens: dailyUsage.totalTokens, 
          monthlyTokens: monthlyUsage.totalTokens,
          dailyCost: dailyUsage.totalCost,
          monthlyCost: monthlyUsage.totalCost
        }
      };
    }

    if (settings?.globalMonthlyCostLimit && globalMonthlyUsage.totalCost >= parseFloat(settings.globalMonthlyCostLimit)) {
      return {
        canProceed: false,
        reason: `Global monthly cost limit reached ($${settings.globalMonthlyCostLimit}). Resets on the 1st of next month.`,
        limitsInfo: { 
          dailyTokens: dailyUsage.totalTokens, 
          monthlyTokens: monthlyUsage.totalTokens,
          dailyCost: dailyUsage.totalCost,
          monthlyCost: monthlyUsage.totalCost
        }
      };
    }

    return {
      canProceed: true,
      limitsInfo: { 
        dailyTokens: dailyUsage.totalTokens, 
        monthlyTokens: monthlyUsage.totalTokens,
        dailyCost: dailyUsage.totalCost,
        monthlyCost: monthlyUsage.totalCost
      }
    };
  } catch (error) {
    console.error('Error checking usage limits:', error);
    // Fail closed for production safety - deny access if we can't verify limits
    return {
      canProceed: false,
      reason: 'Unable to verify usage limits. Please try again.',
      limitsInfo: { dailyTokens: 0, monthlyTokens: 0, dailyCost: 0, monthlyCost: 0 }
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      // Check database connection
      await storage.getSettings();
      res.json({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        database: "connected"
      });
    } catch (error) {
      res.status(503).json({ 
        status: "unhealthy", 
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Debug endpoint to test admin password (REMOVE IN PRODUCTION)
  app.post("/api/debug/test-password", async (req, res) => {
    const { password } = req.body;
    const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'ChapmanEnglish2024!').trim();
    
    res.json({
      received: password,
      receivedLength: password?.length,
      receivedTrimmed: password?.trim(),
      receivedTrimmedLength: password?.trim().length,
      expectedLength: ADMIN_PASSWORD.length,
      match: password?.trim() === ADMIN_PASSWORD,
      firstCharMatch: password?.trim().charCodeAt(0) === ADMIN_PASSWORD.charCodeAt(0),
      lastCharMatch: password?.trim().charCodeAt(password?.trim().length - 1) === ADMIN_PASSWORD.charCodeAt(ADMIN_PASSWORD.length - 1),
    });
  });

  // Admin Authentication Routes
  app.post("/api/admin/login", adminLogin);
  app.post("/api/admin/logout", adminLogout);
  app.get("/api/admin/me", adminMe);

  // Create a new chat session (with student email validation)
  app.post("/api/sessions", async (req, res) => {
    try {
      const sessionData = insertChatSessionSchema.parse(req.body);
      
      // Validate student is in whitelist and active
      const student = await storage.getStudent(sessionData.studentEmail);
      if (!student) {
        return res.status(403).json({ 
          error: "Student not authorized",
          message: "Your email is not in the class whitelist. Please contact Professor Chapman."
        });
      }
      
      if (!student.isActive) {
        return res.status(403).json({ 
          error: "Account deactivated",
          message: "Your account has been temporarily deactivated. Please contact Professor Chapman."
        });
      }
      
      const session = await storage.createChatSession(sessionData);
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid session data",
          details: error.errors
        });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get session details
  app.get("/api/sessions/:sessionId", async (req, res) => {
    try {
      const session = await storage.getChatSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get chat messages for a session
  app.get("/api/sessions/:sessionId/messages", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.sessionId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send a message and get character response (with content filtering and throttling)
  app.post("/api/sessions/:sessionId/messages", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { content, isProfessorMode = false } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Message content is required" });
      }

      // Get session details
      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Check usage limits before processing
      const usageCheck = await checkUsageLimits(session.studentEmail);
      if (!usageCheck.canProceed) {
        // Log rate limit violation
        await storage.createViolationEvent({
          studentEmail: session.studentEmail,
          sessionId,
          category: 'rate-limit',
          detail: usageCheck.reason || 'Usage limit exceeded'
        });

        return res.status(429).json({ 
          error: "Usage limit exceeded",
          message: usageCheck.reason,
          usage: usageCheck.limitsInfo
        });
      }

      // Content filtering check
      const contentCheck = await shouldBlockContent(content);
      if (contentCheck.shouldBlock) {
        // Log content violation
        await logContentViolation(session.studentEmail, sessionId, content, contentCheck.filterResult);

        return res.status(403).json({ 
          error: "Content not allowed",
          message: contentCheck.reason,
          suggestion: "Please ask questions about The Princess Bride characters, plot, themes, or literary analysis techniques."
        });
      }

      // Save user message
      const userMessage = await storage.addChatMessage({
        sessionId,
        role: "user",
        content
      });

      // Get previous messages for context
      const previousMessages = await storage.getChatMessages(sessionId);
      const conversationHistory = previousMessages
        .filter(msg => msg.id !== userMessage.id) // Exclude the message we just added
        .map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));

      // Generate character response with automatic persona detection
      const characterResponse = await createCharacterResponse(
        session.characterName,
        session.situation,
        [...conversationHistory, { role: 'user', content }],
        false // Auto-detection will handle this
      );

      // Save assistant message with appropriate labeling
      const responseContent = characterResponse.respondingCharacter === 'professor' 
        ? `[Professor Chapman]: ${characterResponse.content}`
        : characterResponse.content;

      const assistantMessage = await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: responseContent
      });

      // Track usage
      const cost = calculateCost(characterResponse.usage);
      await storage.addUsageStats({
        sessionId,
        studentEmail: session.studentEmail,
        studentName: session.studentName,
        tokensUsed: characterResponse.usage.total_tokens,
        cost
      });

      res.json({
        userMessage,
        assistantMessage,
        usage: characterResponse.usage,
        cost,
        respondingCharacter: characterResponse.respondingCharacter
      });

    } catch (error) {
      console.error("Error processing message:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  // Get usage statistics
  app.get("/api/usage", async (req, res) => {
    try {
      const { sessionId, studentName } = req.query;
      const usage = await storage.getUsageStats(
        sessionId as string | undefined,
        studentName as string | undefined
      );
      
      // Calculate totals
      const totalTokens = usage.reduce((sum, stat) => sum + stat.tokensUsed, 0);
      const totalCost = usage.reduce((sum, stat) => sum + parseFloat(stat.cost || '0'), 0);
      
      res.json({
        usage,
        totals: {
          tokens: totalTokens,
          cost: totalCost.toFixed(4)
        }
      });
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Switch to Professor Chapman mode (with throttling)
  app.post("/api/sessions/:sessionId/professor-mode", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { question } = req.body;

      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: "Question is required" });
      }

      // Get session details
      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Check usage limits before processing
      const usageCheck = await checkUsageLimits(session.studentEmail);
      if (!usageCheck.canProceed) {
        // Log rate limit violation
        await storage.createViolationEvent({
          studentEmail: session.studentEmail,
          sessionId,
          category: 'rate-limit',
          detail: usageCheck.reason || 'Usage limit exceeded in professor mode'
        });

        return res.status(429).json({ 
          error: "Usage limit exceeded",
          message: usageCheck.reason,
          usage: usageCheck.limitsInfo
        });
      }

      // Generate Professor Chapman response
      const professorResponse = await createCharacterResponse(
        session.characterName,
        session.situation,
        [{ role: 'user', content: question }],
        true // Professor mode
      );

      // Save the exchange
      const userMessage = await storage.addChatMessage({
        sessionId,
        role: "user",
        content: `[Asked Professor Chapman]: ${question}`
      });

      const assistantMessage = await storage.addChatMessage({
        sessionId,
        role: "assistant", 
        content: `[Professor Chapman]: ${professorResponse.content}`
      });

      // Track usage
      const cost = calculateCost(professorResponse.usage);
      await storage.addUsageStats({
        sessionId,
        studentEmail: session.studentEmail,
        studentName: session.studentName,
        tokensUsed: professorResponse.usage.total_tokens,
        cost
      });

      res.json({
        userMessage,
        assistantMessage,
        usage: professorResponse.usage,
        cost
      });

    } catch (error) {
      console.error("Error in professor mode:", error);
      res.status(500).json({ error: "Failed to get professor response" });
    }
  });

  // Admin Routes - Student Management
  app.get("/api/admin/students", requireAdmin, async (req, res) => {
    try {
      const students = await storage.getStudents();
      res.json(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  app.post("/api/admin/students", requireAdmin, async (req, res) => {
    try {
      const studentData = insertStudentSchema.parse(req.body);
      const student = await storage.createStudent(studentData);
      res.json(student);
    } catch (error) {
      console.error("Error creating student:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid student data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create student" });
    }
  });

  app.patch("/api/admin/students/:email", requireAdmin, async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      const updates = insertStudentSchema.partial().parse(req.body);
      const student = await storage.updateStudent(email, updates);
      
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      
      res.json(student);
    } catch (error) {
      console.error("Error updating student:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update student" });
    }
  });

  app.delete("/api/admin/students/:email", requireAdmin, async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      const deleted = await storage.deleteStudent(email);
      
      if (!deleted) {
        return res.status(404).json({ error: "Student not found" });
      }
      
      res.json({ success: true, message: "Student deleted successfully" });
    } catch (error) {
      console.error("Error deleting student:", error);
      res.status(500).json({ error: "Failed to delete student" });
    }
  });

  // Admin Routes - Settings Management
  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings || {
        id: "global",
        globalDailyTokenLimit: null,
        globalMonthlyCostLimit: null,
        contentFilterMode: "normal",
        alertEmail: null,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settingsData = insertSettingsSchema.parse(req.body);
      const settings = await storage.updateSettings(settingsData);
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Admin Routes - Usage Monitoring
  app.get("/api/admin/usage", requireAdmin, async (req, res) => {
    try {
      const { studentEmail, window = 'day' } = req.query;
      
      if (studentEmail && typeof studentEmail === 'string') {
        // Get usage for specific student
        const dailyUsage = await storage.getUsageByStudent(studentEmail, 'day');
        const monthlyUsage = await storage.getUsageByStudent(studentEmail, 'month');
        
        res.json({
          studentEmail,
          daily: dailyUsage,
          monthly: monthlyUsage
        });
      } else {
        // Get global usage statistics
        const dailyUsage = await storage.getGlobalUsage('day');
        const monthlyUsage = await storage.getGlobalUsage('month');
        
        // Get all students for per-student breakdown
        const students = await storage.getStudents();
        const studentUsage = await Promise.all(
          students.map(async (student) => {
            const daily = await storage.getUsageByStudent(student.email, 'day');
            const monthly = await storage.getUsageByStudent(student.email, 'month');
            return {
              email: student.email,
              name: student.name,
              daily,
              monthly
            };
          })
        );
        
        res.json({
          global: {
            daily: dailyUsage,
            monthly: monthlyUsage
          },
          students: studentUsage
        });
      }
    } catch (error) {
      console.error("Error fetching usage data:", error);
      res.status(500).json({ error: "Failed to fetch usage data" });
    }
  });

  // Admin Routes - Violation Monitoring
  app.get("/api/admin/violations", requireAdmin, async (req, res) => {
    try {
      const { studentEmail, category } = req.query;
      const violations = await storage.getViolationEvents(
        studentEmail as string | undefined,
        category as string | undefined
      );
      res.json(violations);
    } catch (error) {
      console.error("Error fetching violations:", error);
      res.status(500).json({ error: "Failed to fetch violations" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
