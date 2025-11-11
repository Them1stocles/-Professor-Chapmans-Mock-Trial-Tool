import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { randomUUID } from 'crypto';

// Admin password - use environment variable or fallback for development
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'ChapmanEnglish2024!').trim();

if (!process.env.ADMIN_PASSWORD) {
  console.warn('WARNING: Using default admin password. Set ADMIN_PASSWORD environment variable for production.');
} else {
  console.log('✓ Admin password loaded from environment (length:', ADMIN_PASSWORD.length, 'chars)');
}

// Simple rate limiting for admin login (classroom use)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  
  if (!attempts) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Reset if lockout period has passed
  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Check if too many attempts
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    return false;
  }
  
  // Increment attempts
  attempts.count++;
  attempts.lastAttempt = now;
  return true;
}

// Admin login
export async function adminLogin(req: Request, res: Response) {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Check rate limiting
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({ 
        error: 'Too many login attempts',
        message: 'Too many failed login attempts. Please try again in 15 minutes.'
      });
    }
    
    const { password } = req.body;
    const trimmedPassword = password?.trim();
    
    console.log('Admin login attempt - Password length received:', password?.length, 'Expected length:', ADMIN_PASSWORD.length);
    
    if (!trimmedPassword || trimmedPassword !== ADMIN_PASSWORD) {
      console.log('Admin login failed - Password mismatch');
      return res.status(401).json({ 
        error: 'Invalid password',
        message: 'Incorrect admin password'
      });
    }
    
    console.log('Admin login successful');
    
    // Clear rate limiting on successful login
    loginAttempts.delete(clientIP);
    
    // Create admin token (24 hour expiry)
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await storage.createAdminToken({ token, expiresAt });
    
    // Set HttpOnly cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from 'strict' to 'lax' for Render compatibility
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
    
    res.json({ 
      success: true,
      message: 'Admin login successful'
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: 'Internal server error during login'
    });
  }
}

// Admin logout
export async function adminLogout(req: Request, res: Response) {
  try {
    const token = req.cookies.admin_token;
    
    if (token) {
      await storage.deleteAdminToken(token);
    }
    
    res.clearCookie('admin_token');
    res.json({ 
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({ 
      error: 'Logout failed',
      message: 'Internal server error during logout'
    });
  }
}

// Check admin status
export async function adminMe(req: Request, res: Response) {
  try {
    const token = req.cookies.admin_token;
    
    if (!token) {
      return res.status(401).json({ 
        authenticated: false,
        message: 'No admin token'
      });
    }
    
    const adminToken = await storage.getAdminToken(token);
    
    if (!adminToken) {
      res.clearCookie('admin_token');
      return res.status(401).json({ 
        authenticated: false,
        message: 'Invalid or expired token'
      });
    }
    
    res.json({ 
      authenticated: true,
      message: 'Admin authenticated'
    });
  } catch (error) {
    console.error('Admin status check error:', error);
    res.status(500).json({ 
      authenticated: false,
      message: 'Internal server error'
    });
  }
}

// Middleware to require admin authentication
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies.admin_token;
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Admin access required',
        message: 'No admin token provided'
      });
    }
    
    const adminToken = await storage.getAdminToken(token);
    
    if (!adminToken) {
      res.clearCookie('admin_token');
      return res.status(401).json({ 
        error: 'Admin access required',
        message: 'Invalid or expired admin token'
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
}

// Cleanup expired tokens (run periodically)
export async function cleanupExpiredTokens() {
  try {
    await storage.cleanupExpiredTokens();
  } catch (error) {
    console.error('Token cleanup error:', error);
  }
}