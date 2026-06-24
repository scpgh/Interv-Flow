import express from 'express';
import { admin } from '../config/db.js';
import { findUserByEmail, saveUser } from '../helpers/dbHelpers.js';

const router = express.Router();

// Helper: Sync user claims and database role
const syncUserClaims = async (email) => {
  const sanitizedEmail = email.toLowerCase().trim();
  const user = await findUserByEmail(sanitizedEmail);
  
  const adminEmails = ["test@example.com", "admin@intervflow.com"];
  const isDevAdmin = adminEmails.includes(sanitizedEmail);
  const expectedRole = (user && user.role === 'ADMIN') || isDevAdmin ? 'ADMIN' : 'USER';

  let claimsUpdated = false;

  if (admin.apps.length > 0) {
    try {
      const userRecord = await admin.auth().getUserByEmail(sanitizedEmail);
      const currentClaims = userRecord.customClaims || {};
      if (currentClaims.role !== expectedRole) {
        await admin.auth().setCustomUserClaims(userRecord.uid, { role: expectedRole });
        console.log(`[AUTH Sync] Set Firebase Custom Claim {role: "${expectedRole}"} for user ${sanitizedEmail}`);
        claimsUpdated = true;
      }
    } catch (e) {
      console.warn(`[AUTH Sync] Failed to update claims for ${sanitizedEmail}:`, e.message);
    }
  }

  return { role: expectedRole, claimsUpdated };
};

// POST: Verify Google SSO
router.post('/google', async (req, res) => {
  try {
    const { idToken, domain } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "ID token is required." });
    }

    let email, name;
    if (admin.apps.length > 0) {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      email = decodedToken.email;
      name = decodedToken.name || decodedToken.email.split('@')[0];
    } else {
      email = "google.user@example.com";
      name = "Alex Rivera";
    }

    let user = await findUserByEmail(email);
    const syncResult = await syncUserClaims(email);

    if (!user) {
      user = {
        name,
        email,
        domain: domain || 'swe',
        role: syncResult.role,
        isActive: true,
        onboardingCompleted: false
      };
      await saveUser(user);
    } else {
      if (user.role !== syncResult.role) {
        user.role = syncResult.role;
        await saveUser(user);
      }
    }

    res.json({
      success: true,
      claimsUpdated: syncResult.claimsUpdated,
      user: {
        name: user.name,
        email: user.email,
        domain: user.domain,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted || false,
        experienceYears: user.experienceYears || '',
        highestEducation: user.highestEducation || '',
        dreamCompany: user.dreamCompany || '',
        linkedinUrl: user.linkedinUrl || '',
        githubUrl: user.githubUrl || ''
      }
    });
  } catch (err) {
    console.error("Google authentication route error:", err);
    res.status(401).json({ error: "Invalid ID token." });
  }
});

// POST: Sign Up new credentials profile
router.post('/signup', async (req, res) => {
  try {
    const { idToken, name, domain } = req.body;
    if (!idToken || !name) {
      return res.status(400).json({ error: "ID token and name are required." });
    }

    let email;
    if (admin.apps.length > 0) {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      email = decodedToken.email;
    } else {
      email = "local.user@example.com";
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const adminEmails = ["test@example.com", "admin@intervflow.com"];
    const sanitizedEmail = email.toLowerCase().trim();
    const isDevAdmin = adminEmails.includes(sanitizedEmail);
    const expectedRole = isDevAdmin ? 'ADMIN' : 'USER';

    const newUser = {
      name,
      email: sanitizedEmail,
      domain: domain || 'swe',
      role: expectedRole,
      isActive: true,
      onboardingCompleted: false
    };

    await saveUser(newUser);

    const syncResult = await syncUserClaims(sanitizedEmail);

    res.json({
      success: true,
      claimsUpdated: syncResult.claimsUpdated,
      user: {
        name: newUser.name,
        email: newUser.email,
        domain: newUser.domain,
        role: newUser.role,
        onboardingCompleted: false
      }
    });
  } catch (err) {
    console.error("Signup endpoint error:", err);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// POST: Standard credentials login
router.post('/login', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "ID token is required." });
    }

    let email;
    if (admin.apps.length > 0) {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      email = decodedToken.email;
    } else {
      email = "local.user@example.com";
    }

    let user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    const syncResult = await syncUserClaims(email);
    if (user.role !== syncResult.role) {
      user.role = syncResult.role;
      await saveUser(user);
    }

    res.json({
      success: true,
      claimsUpdated: syncResult.claimsUpdated,
      user: {
        name: user.name,
        email: user.email,
        domain: user.domain,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted || false,
        experienceYears: user.experienceYears || '',
        highestEducation: user.highestEducation || '',
        dreamCompany: user.dreamCompany || '',
        linkedinUrl: user.linkedinUrl || '',
        githubUrl: user.githubUrl || ''
      }
    });
  } catch (err) {
    console.error("Login endpoint error:", err);
    res.status(401).json({ error: "Invalid ID token." });
  }
});

// POST: Save onboarding configuration fields
router.post('/onboarding', async (req, res) => {
  try {
    const { email, experienceYears, highestEducation, dreamCompany, linkedinUrl, githubUrl } = req.body;
    if (!email) {
      return res.status(400).json({ error: "User email is required." });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    const updatedFields = {
      ...user,
      experienceYears: experienceYears || '',
      highestEducation: highestEducation || '',
      dreamCompany: dreamCompany || '',
      linkedinUrl: linkedinUrl || '',
      githubUrl: githubUrl || '',
      onboardingCompleted: true
    };

    await saveUser(updatedFields);

    res.json({
      success: true,
      user: {
        name: updatedFields.name,
        email: updatedFields.email,
        domain: updatedFields.domain,
        role: updatedFields.role,
        onboardingCompleted: true,
        experienceYears: updatedFields.experienceYears,
        highestEducation: updatedFields.highestEducation,
        dreamCompany: updatedFields.dreamCompany,
        linkedinUrl: updatedFields.linkedinUrl,
        githubUrl: updatedFields.githubUrl
      }
    });
  } catch (err) {
    console.error("Onboarding endpoint error:", err);
    res.status(500).json({ error: "Server error during onboarding." });
  }
});

export default router;
