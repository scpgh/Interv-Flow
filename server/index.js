import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db, admin } from './config/db.js';
import { migrateDatabaseOnStartup, getGlobalSettings } from './helpers/dbHelpers.js';
import { rateLimiter, checkMaintenanceMode } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import interviewRouter from './routes/interview.js';
import communityRouter from './routes/community.js';
import adminRouter from './routes/admin.js';
import generalRouter from './routes/general.js';
import jobPortalRouter from './routes/jobPortal.js';
import billingRouter from './routes/billing.js';
import { initializeWebSocketServer } from './websocket/wsHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Public health/status endpoint — registered BEFORE middleware so it's always reachable
app.get('/api/status', async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    res.json({ maintenance: settings.maintenanceMode === true });
  } catch {
    res.json({ maintenance: false });
  }
});

// Global filters for maintenance mode and rate limiting
app.use('/api', checkMaintenanceMode);
app.use('/api', rateLimiter);

// Bind modular routes
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/interview', interviewRouter);
app.use('/api/community', communityRouter);
app.use('/api/admin', adminRouter);
app.use('/api', jobPortalRouter);
app.use('/api', generalRouter);
app.use('/api', billingRouter);

// Start Server
const server = app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  try {
    await migrateDatabaseOnStartup();
  } catch (err) {
    console.error("Startup database migration failed:", err);
  }
});

// Attach WebSockets
initializeWebSocketServer(server);
