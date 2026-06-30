import { admin } from '../config/db.js';
import fs from 'fs';
import { getGlobalSettings, findUserByEmail } from '../helpers/dbHelpers.js';

// Rate Limiter cache
const ipRequestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 requests per minute

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  
  if (!ipRequestCounts.has(ip)) {
    ipRequestCounts.set(ip, []);
  }
  
  const timestamps = ipRequestCounts.get(ip);
  const activeTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (activeTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    console.warn(`Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({ error: "Too many requests. Please try again after a minute." });
  }
  
  activeTimestamps.push(now);
  ipRequestCounts.set(ip, activeTimestamps);
  next();
};

// Stateless Admin Verification Middleware (JWT Custom Claims + DB Fallback)
const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized. No token provided." });
    }
    const token = authHeader.split(' ')[1];

    let email;
    let role;

    const adminEmails = ["test@example.com", "admin@intervflow.com", "human@intervflow.com"];

    if (admin.apps.length > 0) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        email = decodedToken.email;
        role = decodedToken.role; // Read custom claims role
      } catch (err) {
        console.error("JWT custom claim validation failed in middleware:", err.message);
        return res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
      }
    } else {
      // Local fallback bypass check: the token is the user's email
      email = token.toLowerCase().trim();
      role = adminEmails.includes(email) ? 'ADMIN' : 'USER';
    }

    // Dynamic database and admin list fallback check if role custom claim is not set
    if (role !== 'ADMIN' && email) {
      const sanitizedEmail = email.toLowerCase().trim();
      if (adminEmails.includes(sanitizedEmail)) {
        role = 'ADMIN';
      } else {
        const dbUser = await findUserByEmail(sanitizedEmail);
        if (dbUser && dbUser.role === 'ADMIN') {
          role = 'ADMIN';
        }
      }
    }

    console.log(`[verifyAdmin] email="${email}" role="${role}" → ${role === 'ADMIN' ? 'ALLOWED' : 'DENIED 403'}`);

    if (role !== 'ADMIN') {
      return res.status(403).json({ error: "Forbidden. Admin access required." });
    }

    req.adminEmail = email;
    next();
  } catch (err) {
    console.error("verifyAdmin middleware error:", err);
    res.status(500).json({ error: "Server error during admin verification." });
  }
};

// Global Maintenance Mode Guard Middleware
const checkMaintenanceMode = async (req, res, next) => {
  // Allow authentication endpoints, admin endpoints, and public status to bypass maintenance mode
  if (req.path.startsWith('/auth') || req.path.startsWith('/admin') || req.path === '/status') {
    return next();
  }

  try {
    const settings = await getGlobalSettings();
    if (settings.maintenanceMode) {
      // Admin bypass: check if they have a valid token with ADMIN role
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        let role = 'USER';
        let email = '';

        const adminEmails = ["test@example.com", "admin@intervflow.com", "human@intervflow.com"];

        if (admin.apps.length > 0) {
          try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            role = decodedToken.role || 'USER';
            email = decodedToken.email;
          } catch (e) {}
        } else {
          email = token.toLowerCase().trim();
          role = adminEmails.includes(email) ? 'ADMIN' : 'USER';
        }

        if (role !== 'ADMIN' && email) {
          const sanitizedEmail = email.toLowerCase().trim();
          if (adminEmails.includes(sanitizedEmail)) {
            role = 'ADMIN';
          } else {
            const dbUser = await findUserByEmail(sanitizedEmail);
            if (dbUser && dbUser.role === 'ADMIN') {
              role = 'ADMIN';
            }
          }
        }

        if (role === 'ADMIN') {
          return next();
        }
      }

      return res.status(503).json({
        error: "The system is currently undergoing scheduled maintenance. Please check back later.",
        maintenance: true
      });
    }
  } catch (err) {
    console.error("Maintenance mode check failed:", err);
  }
  next();
};

const verifyUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized. No token provided." });
    }
    const token = authHeader.split(' ')[1];

    let email;
    let role = 'USER';

    if (admin.apps.length > 0) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        email = decodedToken.email;
        role = decodedToken.role || 'USER';
      } catch (err) {
        console.error("JWT token verification failed in verifyUser:", err.message);
        return res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
      }
    } else {
      email = token.toLowerCase().trim();
      const adminEmails = ["test@example.com", "admin@intervflow.com", "human@intervflow.com"];
      role = adminEmails.includes(email) ? 'ADMIN' : 'USER';
    }

    // Lookup user in DB to ensure fresh role info
    if (email) {
      const sanitizedEmail = email.toLowerCase().trim();
      const dbUser = await findUserByEmail(sanitizedEmail);
      if (dbUser) {
        role = dbUser.role || role;
        req.user = dbUser;
      }
    }

    req.userEmail = email;
    req.userRole = role;
    next();
  } catch (err) {
    console.error("verifyUser middleware error:", err);
    res.status(500).json({ error: "Server error during user verification." });
  }
};

const verifyModerator = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized. No token provided." });
    }
    const token = authHeader.split(' ')[1];

    let email;
    let role = 'USER';

    const adminEmails = ["test@example.com", "admin@intervflow.com", "human@intervflow.com"];

    if (admin.apps.length > 0) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        email = decodedToken.email;
        role = decodedToken.role || 'USER';
      } catch (err) {
        console.error("JWT custom claim validation failed in verifyModerator:", err.message);
        return res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
      }
    } else {
      email = token.toLowerCase().trim();
      role = adminEmails.includes(email) ? 'ADMIN' : 'USER';
    }

    if (role !== 'ADMIN' && role !== 'MODERATOR' && email) {
      const sanitizedEmail = email.toLowerCase().trim();
      if (adminEmails.includes(sanitizedEmail)) {
        role = 'ADMIN';
      } else {
        const dbUser = await findUserByEmail(sanitizedEmail);
        if (dbUser) {
          role = dbUser.role || role;
        }
      }
    }

    console.log(`[verifyModerator] email="${email}" role="${role}" → ${['ADMIN', 'MODERATOR'].includes(role) ? 'ALLOWED' : 'DENIED 403'}`);

    if (role !== 'ADMIN' && role !== 'MODERATOR') {
      return res.status(403).json({ error: "Forbidden. Moderator or Admin access required." });
    }

    req.adminEmail = email;
    req.userEmail = email;
    req.userRole = role;
    next();
  } catch (err) {
    console.error("verifyModerator middleware error:", err);
    res.status(500).json({ error: "Server error during moderator verification." });
  }
};

export { rateLimiter, verifyAdmin, checkMaintenanceMode, verifyUser, verifyModerator };
