import express from 'express';
import { findUserByEmail, saveUser, getGlobalSettings } from '../helpers/dbHelpers.js';

// Dynamically import Razorpay to allow smooth startup even if package installation is delayed
let Razorpay;
try {
  const module = await import('razorpay');
  Razorpay = module.default;
} catch (e) {
  console.warn("[BILLING] Razorpay SDK is not fully installed. Falling back to dynamic mock billing mode.");
}

const router = express.Router();

// GET: Expose active plan prices and credit limits
router.get('/billing/plans', async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    res.json({
      success: true,
      plans: {
        Basic: { price: 0, jobApplicationsLimit: 3, aiMocksLimit: 3 },
        Pro: settings.planPro || { price: 299, jobApplicationsLimit: 15, aiMocksLimit: 15 },
        ProPlus: settings.planProPlus || { price: 999, jobApplicationsLimit: 99999, aiMocksLimit: 99999 }
      }
    });
  } catch (err) {
    console.error("GET /billing/plans error:", err);
    res.status(500).json({ error: "Failed to fetch plans configuration." });
  }
});

// POST: Create Razorpay Order
router.post('/billing/create-order', async (req, res) => {
  try {
    const { planName } = req.body;
    if (!planName || !['Pro', 'Pro Plus'].includes(planName)) {
      return res.status(400).json({ error: "Invalid plan selection." });
    }

    const settings = await getGlobalSettings();
    const price = planName === 'Pro' 
      ? settings.planPro?.price || 299 
      : settings.planProPlus?.price || 999;

    const amountPaise = price * 100;
    let orderId = `mock_order_${Date.now()}`;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keySecret && Razorpay) {
      try {
        const instance = new Razorpay({
          key_id: keyId,
          key_secret: keySecret
        });
        const options = {
          amount: amountPaise,
          currency: "INR",
          receipt: `receipt_${Date.now()}`
        };
        const order = await instance.orders.create(options);
        orderId = order.id;
      } catch (rpErr) {
        console.warn("Razorpay API order creation failed, falling back to mock:", rpErr.message);
      }
    } else {
      console.log("[BILLING] Running in mock sandbox mode. Generated mock order ID:", orderId);
    }

    res.json({
      success: true,
      orderId,
      amount: amountPaise,
      currency: "INR",
      keyId: keyId || "rzp_test_mock_keys"
    });
  } catch (err) {
    console.error("POST /billing/create-order error:", err);
    res.status(500).json({ error: "Server error creating payment order." });
  }
});

// POST: Verify payment signature and grant plan upgrades
router.post('/billing/verify-payment', async (req, res) => {
  try {
    const { email, planName, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!email || !planName || !razorpayOrderId || !razorpayPaymentId) {
      return res.status(400).json({ error: "Verification payload parameters missing." });
    }

    const sanitizedEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(sanitizedEmail);
    if (!user) {
      return res.status(404).json({ error: "Candidate profile not found." });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Cryptographic signature check if credentials are set
    if (keyId && keySecret) {
      if (!razorpaySignature) {
        return res.status(400).json({ error: "Cryptographic signature is required when keys are configured." });
      }
      const crypto = await import('crypto');
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        return res.status(400).json({ error: "Invalid cryptographic payment signature." });
      }
    }

    const settings = await getGlobalSettings();

    // Grant subscription plan
    user.subscription = {
      plan: planName,
      status: 'active',
      razorpayOrderId,
      razorpayPaymentId,
      updatedAt: new Date().toISOString()
    };

    // Calculate dynamic limits from configuration settings
    const limits = {
      jobApplicationsLimit: 3,
      aiMocksLimit: 3
    };

    if (planName === 'Pro') {
      limits.jobApplicationsLimit = settings.planPro?.jobApplicationsLimit || 15;
      limits.aiMocksLimit = settings.planPro?.aiMocksLimit || 15;
    } else if (planName === 'Pro Plus') {
      limits.jobApplicationsLimit = settings.planProPlus?.jobApplicationsLimit || 99999;
      limits.aiMocksLimit = settings.planProPlus?.aiMocksLimit || 99999;
    }

    user.credits = {
      jobApplicationsUsed: 0,
      jobApplicationsLimit: limits.jobApplicationsLimit,
      aiMocksUsed: 0,
      aiMocksLimit: limits.aiMocksLimit
    };

    await saveUser(user);
    console.log(`[BILLING] Upgraded ${sanitizedEmail} to ${planName} successfully.`);

    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        domain: user.domain,
        role: user.role,
        subscription: user.subscription,
        credits: user.credits
      }
    });
  } catch (err) {
    console.error("POST /billing/verify-payment error:", err);
    res.status(500).json({ error: "Server error verifying transaction status." });
  }
});

export default router;
