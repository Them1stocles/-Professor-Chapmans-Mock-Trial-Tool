import { 
  type User, 
  type InsertUser,
  type ChatSession,
  type InsertChatSession,
  type ChatMessage,
  type InsertChatMessage,
  type UsageStats,
  type InsertUsageStats,
  type Student,
  type InsertStudent,
  type Settings,
  type InsertSettings,
  type ViolationEvent,
  type InsertViolationEvent,
  type AdminToken,
  type InsertAdminToken,
  users,
  chatSessions,
  chatMessages,
  usageStats,
  students,
  settings,
  violationEvents,
  adminTokens
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Chat session methods
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(id: string): Promise<ChatSession | undefined>;
  
  // Chat message methods
  addChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  
  // Usage tracking methods
  addUsageStats(usage: InsertUsageStats): Promise<UsageStats>;
  getUsageStats(sessionId?: string, studentName?: string): Promise<UsageStats[]>;
  getUsageByStudent(studentEmail: string, window: 'day' | 'month'): Promise<{ totalTokens: number; totalCost: number }>;
  getGlobalUsage(window: 'day' | 'month'): Promise<{ totalTokens: number; totalCost: number }>;
  
  // Student management methods
  createStudent(student: InsertStudent): Promise<Student>;
  getStudent(email: string): Promise<Student | undefined>;
  getStudents(): Promise<Student[]>;
  updateStudent(email: string, updates: Partial<InsertStudent>): Promise<Student | undefined>;
  deleteStudent(email: string): Promise<boolean>;
  
  // Settings methods
  getSettings(): Promise<Settings | undefined>;
  updateSettings(settings: InsertSettings): Promise<Settings>;
  
  // Violation events methods
  createViolationEvent(event: InsertViolationEvent): Promise<ViolationEvent>;
  getViolationEvents(studentEmail?: string, category?: string): Promise<ViolationEvent[]>;
  
  // Admin token methods
  createAdminToken(token: InsertAdminToken): Promise<AdminToken>;
  getAdminToken(token: string): Promise<AdminToken | undefined>;
  deleteAdminToken(token: string): Promise<boolean>;
  cleanupExpiredTokens(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Chat session methods
  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const [session] = await db.insert(chatSessions).values(insertSession).returning();
    return session;
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
    return session || undefined;
  }

  // Chat message methods
  async addChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(insertMessage).returning();
    return message;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.timestamp);
  }

  // Usage tracking methods
  async addUsageStats(insertUsage: InsertUsageStats): Promise<UsageStats> {
    const [usage] = await db.insert(usageStats).values(insertUsage).returning();
    return usage;
  }

  async getUsageStats(sessionId?: string, studentName?: string): Promise<UsageStats[]> {
    if (sessionId && studentName) {
      return await db.select()
        .from(usageStats)
        .where(and(
          eq(usageStats.sessionId, sessionId),
          eq(usageStats.studentName, studentName)
        ))
        .orderBy(desc(usageStats.timestamp));
    } else if (sessionId) {
      return await db.select()
        .from(usageStats)
        .where(eq(usageStats.sessionId, sessionId))
        .orderBy(desc(usageStats.timestamp));
    } else if (studentName) {
      return await db.select()
        .from(usageStats)
        .where(eq(usageStats.studentName, studentName))
        .orderBy(desc(usageStats.timestamp));
    }
    
    return await db.select()
      .from(usageStats)
      .orderBy(desc(usageStats.timestamp));
  }

  async getUsageByStudent(studentEmail: string, window: 'day' | 'month'): Promise<{ totalTokens: number; totalCost: number }> {
    const now = new Date();
    let startDate: Date;
    
    if (window === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    const [result] = await db.select({
      totalTokens: sql<number>`COALESCE(SUM(${usageStats.tokensUsed}), 0)`,
      totalCost: sql<number>`COALESCE(SUM(CAST(${usageStats.cost} AS DECIMAL)), 0)`,
    })
    .from(usageStats)
    .where(and(
      eq(usageStats.studentEmail, studentEmail),
      gte(usageStats.timestamp, startDate)
    ));
    
    return {
      totalTokens: Number(result.totalTokens) || 0,
      totalCost: Number(result.totalCost) || 0,
    };
  }

  async getGlobalUsage(window: 'day' | 'month'): Promise<{ totalTokens: number; totalCost: number }> {
    const now = new Date();
    let startDate: Date;
    
    if (window === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    const [result] = await db.select({
      totalTokens: sql<number>`COALESCE(SUM(${usageStats.tokensUsed}), 0)`,
      totalCost: sql<number>`COALESCE(SUM(CAST(${usageStats.cost} AS DECIMAL)), 0)`,
    })
    .from(usageStats)
    .where(gte(usageStats.timestamp, startDate));
    
    return {
      totalTokens: Number(result.totalTokens) || 0,
      totalCost: Number(result.totalCost) || 0,
    };
  }

  // Student management methods
  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const [student] = await db.insert(students).values(insertStudent).returning();
    return student;
  }

  async getStudent(email: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.email, email));
    return student || undefined;
  }

  async getStudents(): Promise<Student[]> {
    return await db.select().from(students).orderBy(students.createdAt);
  }

  async updateStudent(email: string, updates: Partial<InsertStudent>): Promise<Student | undefined> {
    const [student] = await db.update(students)
      .set(updates)
      .where(eq(students.email, email))
      .returning();
    return student || undefined;
  }

  async deleteStudent(email: string): Promise<boolean> {
    const result = await db.delete(students).where(eq(students.email, email));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Settings methods
  async getSettings(): Promise<Settings | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.id, "global"));
    return setting || undefined;
  }

  async updateSettings(insertSettings: InsertSettings): Promise<Settings> {
    const existing = await this.getSettings();
    
    if (existing) {
      const [updated] = await db.update(settings)
        .set({ ...insertSettings, updatedAt: new Date() })
        .where(eq(settings.id, "global"))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(settings)
        .values({ id: "global", ...insertSettings })
        .returning();
      return created;
    }
  }

  // Violation events methods
  async createViolationEvent(insertEvent: InsertViolationEvent): Promise<ViolationEvent> {
    const [event] = await db.insert(violationEvents).values(insertEvent).returning();
    return event;
  }

  async getViolationEvents(studentEmail?: string, category?: string): Promise<ViolationEvent[]> {
    if (studentEmail && category) {
      return await db.select()
        .from(violationEvents)
        .where(and(
          eq(violationEvents.studentEmail, studentEmail),
          eq(violationEvents.category, category)
        ))
        .orderBy(desc(violationEvents.timestamp));
    } else if (studentEmail) {
      return await db.select()
        .from(violationEvents)
        .where(eq(violationEvents.studentEmail, studentEmail))
        .orderBy(desc(violationEvents.timestamp));
    } else if (category) {
      return await db.select()
        .from(violationEvents)
        .where(eq(violationEvents.category, category))
        .orderBy(desc(violationEvents.timestamp));
    }
    
    return await db.select()
      .from(violationEvents)
      .orderBy(desc(violationEvents.timestamp));
  }

  // Admin token methods
  async createAdminToken(insertToken: InsertAdminToken): Promise<AdminToken> {
    const [token] = await db.insert(adminTokens).values(insertToken).returning();
    return token;
  }

  async getAdminToken(token: string): Promise<AdminToken | undefined> {
    const [adminToken] = await db.select()
      .from(adminTokens)
      .where(and(
        eq(adminTokens.token, token),
        gte(adminTokens.expiresAt, new Date())
      ));
    return adminToken || undefined;
  }

  async deleteAdminToken(token: string): Promise<boolean> {
    const result = await db.delete(adminTokens).where(eq(adminTokens.token, token));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async cleanupExpiredTokens(): Promise<void> {
    await db.delete(adminTokens).where(lte(adminTokens.expiresAt, new Date()));
  }
}

export const storage = new DatabaseStorage();
