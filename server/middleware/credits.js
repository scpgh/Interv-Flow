import { findUserByEmail, getGlobalSettings, saveUser } from '../helpers/dbHelpers.js';

export const checkUsageCredits = (creditType) => {
  return async (req, res, next) => {
    try {
      const email = req.userEmail || req.body.email || req.query.email;
      if (!email) {
        return res.status(401).json({ error: "Unauthorized. Email context is missing." });
      }

      const sanitizedEmail = email.toLowerCase().trim();
      const user = await findUserByEmail(sanitizedEmail);
      if (!user) {
        return res.status(404).json({ error: "User account not found." });
      }

      const settings = await getGlobalSettings();
      const planName = (user.subscription && user.subscription.plan) || 'Basic';

      // Load user credits, initialize defaults if missing
      let credits = user.credits;
      if (!credits) {
        const defaultLimits = {
          atsAnalysesLimit: 3,
          jobApplicationsLimit: 3,
          aiMocksLimit: 3
        };

        if (planName === 'Pro') {
          defaultLimits.atsAnalysesLimit = 10;
          defaultLimits.jobApplicationsLimit = settings.planPro?.jobApplicationsLimit || 15;
          defaultLimits.aiMocksLimit = settings.planPro?.aiMocksLimit || 15;
        } else if (planName === 'Pro Plus') {
          defaultLimits.atsAnalysesLimit = 99999;
          defaultLimits.jobApplicationsLimit = settings.planProPlus?.jobApplicationsLimit || 99999;
          defaultLimits.aiMocksLimit = settings.planProPlus?.aiMocksLimit || 99999;
        }

        credits = {
          atsAnalysesUsed: 0,
          atsAnalysesLimit: defaultLimits.atsAnalysesLimit,
          jobApplicationsUsed: 0,
          jobApplicationsLimit: defaultLimits.jobApplicationsLimit,
          aiMocksUsed: 0,
          aiMocksLimit: defaultLimits.aiMocksLimit
        };

        user.credits = credits;
        await saveUser(user);
      }

      // Feature specific checks
      if (creditType === 'ats') {
        const limit = credits.atsAnalysesLimit || 3;
        if (credits.atsAnalysesUsed >= limit) {
          return res.status(403).json({
            error: "ATS Resume Analysis limit reached. Please upgrade your plan."
          });
        }
      } else if (creditType === 'chat') {
        // AI Doubt Tutor is exclusive to Pro Plus (999) plan
        if (planName !== 'Pro Plus') {
          return res.status(403).json({
            error: "24/7 AI Doubt Tutor is exclusive to Pro Plus plan. Please upgrade to access this feature."
          });
        }
      }

      req.currentUserRecord = user;
      next();
    } catch (err) {
      console.error("checkUsageCredits middleware error:", err);
      res.status(500).json({ error: "Error checking usage credits limits." });
    }
  };
};
