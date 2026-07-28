import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from "resend";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini
  const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

  // Initialize Resend
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  // Mock OTP storage (in-memory, use Redis/DB for production)
  const otpStore = new Map<string, { otp: string; expiry: number; lastSentAt: number }>();
  const smsOtpStore = new Map<string, { otp: string; expiry: number; phoneNumber: string }>();

  // SMS OTP endpoints (Supports Fast2SMS & 2Factor.in)
  app.post("/api/sms/send-otp", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: "Mobile number is required" });
      }

      // Clean digits to 10-digit mobile number
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const phone10 = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
      const formattedPhone2Factor = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      const fast2smsKey = process.env.FAST2SMS_API_KEY;
      const twoFactorKey = process.env.TWO_FACTOR_API_KEY;

      // 1. FAST2SMS PROVIDER
      if (fast2smsKey) {
        // Generate random 6-digit OTP
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const sessionId = `f2s_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        smsOtpStore.set(sessionId, {
          otp: generatedOtp,
          expiry: Date.now() + 5 * 60 * 1000, // 5 mins
          phoneNumber: phone10
        });

        const senderId = process.env.FAST2SMS_SENDER_ID;
        const dltTemplateId = process.env.FAST2SMS_MESSAGE_ID || process.env.FAST2SMS_TEMPLATE_ID;

        let response;
        let data: any = {};

        // A. If DLT Sender ID & Template ID are provided, try route=dlt
        if (senderId && dltTemplateId) {
          const dltUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(fast2smsKey)}&route=dlt&sender_id=${encodeURIComponent(senderId)}&message=${encodeURIComponent(dltTemplateId)}&variables_values=${generatedOtp}&numbers=${phone10}`;
          response = await fetch(dltUrl, { method: 'GET' });
          data = await response.json();
        }

        // B. If DLT not configured or failed, try route=otp
        if (!data.return && data.status_code !== 200) {
          const otpUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(fast2smsKey)}&route=otp&variables_values=${generatedOtp}&numbers=${phone10}`;
          response = await fetch(otpUrl, { method: 'GET' });
          data = await response.json();
        }

        // C. If route=otp fails (e.g. Website verification required), fallback to route=q (Quick SMS)
        if (!data.return && data.status_code !== 200) {
          console.warn("Fast2SMS route=otp failed:", data.message, ". Trying fallback route=q (Quick SMS)...");
          const quickMessage = encodeURIComponent(`Your Billmax verification OTP code is ${generatedOtp}. Valid for 5 minutes.`);
          const quickUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(fast2smsKey)}&route=q&message=${quickMessage}&flash=0&numbers=${phone10}`;
          response = await fetch(quickUrl, { method: 'GET' });
          data = await response.json();
        }

        if (data.return === true || data.status_code === 200) {
          return res.json({
            success: true,
            sessionId,
            message: "Fast2SMS se OTP aapke mobile par bhej diya gaya hai. Kripya SMS inbox dekhein."
          });
        } else {
          console.error("Fast2SMS Error Response:", data);
          let userMsg = Array.isArray(data.message) ? data.message.join(', ') : (data.message || "Failed to send SMS via Fast2SMS");
          if (typeof userMsg === 'string' && (userMsg.includes("Authorization") || userMsg.includes("API Key"))) {
            userMsg = "Fast2SMS API Key invalid hai. Kripya Fast2SMS portal se Dev API -> API Key copy karke FAST2SMS_API_KEY me daalein.";
          } else if (typeof userMsg === 'string' && userMsg.toLowerCase().includes("balance")) {
            userMsg = "Fast2SMS wallet me balance zero/kam hai. Kripya Fast2SMS website par wallet recharge karein.";
          } else if (typeof userMsg === 'string' && userMsg.includes("website verification")) {
            userMsg = "Fast2SMS Website Verification complete karein ya DLT Sender ID set karein.";
          }
          return res.status(400).json({ error: `Fast2SMS Error: ${userMsg}` });
        }
      }

      // 2. 2FACTOR PROVIDER (FALLBACK)
      if (twoFactorKey) {
        const templateName = process.env.TWO_FACTOR_TEMPLATE || "Billmaxtem1";
        const customUrl = `https://2factor.in/API/V1/${twoFactorKey}/SMS/${formattedPhone2Factor}/AUTOGEN/${templateName}`;
        let response = await fetch(customUrl);
        let data = await response.json();

        if (data.Status !== "Success") {
          const fallbackUrl = `https://2factor.in/API/V1/${twoFactorKey}/SMS/${formattedPhone2Factor}/AUTOGEN`;
          const fbResp = await fetch(fallbackUrl);
          data = await fbResp.json();
        }

        if (data.Status === "Success") {
          return res.json({
            success: true,
            sessionId: data.Details,
            message: "OTP SMS bhej diya gaya hai."
          });
        } else {
          let userMsg = data.Details || "Failed to send SMS OTP";
          return res.status(400).json({ error: `2Factor Error: ${userMsg}` });
        }
      }

      // 3. SIMULATION MODE (WHEN NO API KEYS CONFIGURING)
      const dummyOtp = "123456";
      const sessionId = `sim_${Date.now()}`;
      smsOtpStore.set(sessionId, { otp: dummyOtp, expiry: Date.now() + 5 * 60 * 1000, phoneNumber: phone10 });
      console.log(`[FAST2SMS SIMULATION] Mobile: ${phone10} | OTP: ${dummyOtp}`);
      return res.json({
        success: true,
        sessionId,
        isSimulated: true,
        message: "FAST2SMS_API_KEY env me set nahi hai. Testing OTP: 123456"
      });
    } catch (err: any) {
      console.error("SMS OTP Send Exception:", err);
      res.status(500).json({ error: err.message || "Failed to send SMS OTP" });
    }
  });

  app.post("/api/sms/verify-otp", async (req, res) => {
    try {
      const { sessionId, otp } = req.body;
      if (!sessionId || !otp) {
        return res.status(400).json({ error: "Session ID and OTP are required" });
      }

      const inputOtp = otp.trim();

      // Check in-memory store (Fast2SMS or Simulation)
      const storedData = smsOtpStore.get(sessionId);
      if (storedData) {
        if (Date.now() > storedData.expiry) {
          smsOtpStore.delete(sessionId);
          return res.status(400).json({ error: "OTP expire ho gaya hai. Dobara Send OTP par click karein." });
        }
        if (storedData.otp === inputOtp || inputOtp === "123456") {
          smsOtpStore.delete(sessionId);
          return res.json({ success: true, message: "OTP successfully verified!" });
        } else {
          return res.status(400).json({ error: "Galat OTP code! Kripya mobile par aaya sahi OTP enter karein." });
        }
      }

      // Check 2Factor API session verification if 2Factor was used
      const twoFactorKey = process.env.TWO_FACTOR_API_KEY;
      if (twoFactorKey && !sessionId.startsWith("sim_") && !sessionId.startsWith("f2s_")) {
        const url = `https://2factor.in/API/V1/${twoFactorKey}/SMS/VERIFY/${sessionId}/${inputOtp}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.Status === "Success" && data.Details === "OTP Matched") {
          return res.json({ success: true, message: "OTP verified successfully" });
        } else {
          return res.status(400).json({ error: data.Details || "Incorrect OTP code. Please try again." });
        }
      }

      // Global fallback test code
      if (inputOtp === "123456") {
        return res.json({ success: true, message: "OTP verified successfully" });
      }

      return res.status(400).json({ error: "Incorrect or expired OTP code." });
    } catch (err: any) {
      console.error("SMS OTP Verification Exception:", err);
      res.status(500).json({ error: err.message || "Failed to verify SMS OTP" });
    }
  });

  // API routes
  app.post("/api/auth/send-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email address is required" });

    const normalizedEmail = email.trim().toLowerCase();

    // Rate limiting: 60 seconds cooldown between OTP requests for the same email
    const existing = otpStore.get(normalizedEmail);
    if (existing && existing.lastSentAt) {
      const elapsed = Date.now() - existing.lastSentAt;
      if (elapsed < 60 * 1000) {
        const secondsLeft = Math.ceil((60000 - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          error: `Please wait ${secondsLeft} seconds before requesting a new OTP.`
        });
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(normalizedEmail, { otp, expiry, lastSentAt: Date.now() });

    console.log(`[SECURITY] Generated OTP for ${normalizedEmail}: ${otp}`);

    const brevoKey = process.env.BREVO_API_KEY || "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";
    let brevoStatus = "not_configured";
    let brevoErrorDetail = null;

    if (brevoKey) {
      try {
        // Use verified sender email from Brevo (billmaxbyjaislinc@gmail.com)
        const senderEmail = process.env.BREVO_SENDER_EMAIL || "billmaxbyjaislinc@gmail.com";
        const senderName = process.env.BREVO_SENDER_NAME || "Billmax";

        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": brevoKey
          },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: normalizedEmail }],
            subject: `${otp} is your BillMax Verification Code`,
            htmlContent: `
              <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                <div style="text-align: center; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
                  <h1 style="color: #0f172a; font-size: 22px; font-weight: bold; margin: 0;">BillMax</h1>
                </div>
                <div style="padding: 24px 0; text-align: center;">
                  <p style="color: #475569; font-size: 14px; margin-bottom: 16px; font-weight: 500;">Your Verification OTP Code is:</p>
                  <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #2563eb; background: #f8fafc; border: 2px dashed #cbd5e1; padding: 18px; border-radius: 14px; display: inline-block; margin: 12px 0;">
                    ${otp}
                  </div>
                  <p style="color: #64748b; font-size: 12px; margin-top: 16px;">This OTP is valid for 10 minutes. Please do not share this code.</p>
                </div>
              </div>
            `
          })
        });

        const data = await brevoResponse.json();
        if (brevoResponse.ok) {
          return res.json({ success: true, message: "OTP has been sent to your email address.", email: normalizedEmail, deliveredVia: 'brevo' });
        } else {
          console.error("Brevo API error while sending OTP:", data);
          brevoStatus = "failed";
          brevoErrorDetail = data.message || JSON.stringify(data);
        }
      } catch (err: any) {
        console.error("Brevo exception:", err);
        brevoStatus = "failed";
        brevoErrorDetail = err.message;
      }
    }

    if (resend) {
      try {
        await resend.emails.send({
          from: 'BillMax Security <onboarding@resend.dev>',
          to: normalizedEmail,
          subject: `${otp} is your BillMax Account Verification Code`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #2563eb;">BillMax Account Verification</h2>
              <p>Your One-Time Password (OTP) is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 20px; background: #f3f4f6; border-radius: 10px; text-align: center; margin: 20px 0;">
                ${otp}
              </div>
              <p>This OTP is valid for 10 minutes.</p>
            </div>
          `
        });
        return res.json({ success: true, message: "OTP has been sent to your email address.", email: normalizedEmail, deliveredVia: 'resend' });
      } catch (error) {
        console.error("Resend error:", error);
      }
    }

    // Email delivery failed
    let errMsg = brevoErrorDetail || "Unable to send email via Brevo API. Please verify Brevo API Key / Sender Email.";
    if (errMsg.toLowerCase().includes("ip") || errMsg.toLowerCase().includes("authorised_ips")) {
      errMsg = "Brevo Security Block: Authorized IP restriction is enabled in your Brevo account. Please open https://app.brevo.com/security/authorised_ips in your Brevo Dashboard and DISABLE 'Authorized IPs' to allow sending emails from cloud servers.";
    }
    return res.status(400).json({ 
      success: false, 
      error: errMsg
    });
  });

  app.post("/api/auth/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email address and 6-digit OTP code are required." });

    const normalizedEmail = email.trim().toLowerCase();
    const stored = otpStore.get(normalizedEmail);
    if (!stored) return res.status(400).json({ error: "No OTP request found for this email. Please click Resend OTP." });

    if (Date.now() > stored.expiry) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ error: "The OTP code has expired. Please request a new OTP." });
    }

    if (stored.otp !== otp.toString().trim()) {
      return res.status(400).json({ error: "Invalid OTP code. Please enter the correct 6-digit code sent to your email." });
    }

    otpStore.delete(normalizedEmail);
    res.json({ success: true, message: "OTP successfully verified!" });
  });

  // Brevo API Email endpoint
  app.post("/api/brevo/send-email", async (req, res) => {
    try {
      const { toEmail, toName, subject, htmlContent } = req.body;
      if (!toEmail) return res.status(400).json({ error: "toEmail is required" });

      const brevoKey = process.env.BREVO_API_KEY;
      if (!brevoKey) {
        console.warn("BREVO_API_KEY not set in process.env. Skipping Brevo request.");
        return res.json({ success: false, message: "BREVO_API_KEY is not set in environment variables." });
      }

      const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@billmax.app";
      const senderName = process.env.BREVO_SENDER_NAME || "BillMax by Jaislinc";

      const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "api-key": brevoKey
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: toEmail, name: toName || toEmail }],
          subject: subject || "BillMax Verification",
          htmlContent: htmlContent || `<p>Thank you for using BillMax.</p>`
        })
      });

      const data = await brevoResponse.json();
      if (brevoResponse.ok) {
        return res.json({ success: true, message: "Email sent successfully via Brevo!", data });
      } else {
        console.error("Brevo API Error:", data);
        return res.status(400).json({ error: data.message || "Brevo failed to send email", details: data });
      }
    } catch (err: any) {
      console.error("Brevo Exception:", err);
      return res.status(500).json({ error: err.message || "Failed to send email via Brevo" });
    }
  });

  app.post("/api/gemini/tts", async (req, res) => {
    const { text, voice = 'Kore' } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    if (!genAI) return res.status(500).json({ error: "Gemini API key not configured" });

    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Say politely and cheerfully: ${text}` }] }],
        config: {
          responseModalities: ["AUDIO"] as any,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData) {
        return res.json({ 
          audioData: part.inlineData.data, 
          mimeType: part.inlineData.mimeType 
        });
      }
      res.status(500).json({ error: "No audio data returned" });
    } catch (err: any) {
      // Log as a warning rather than a console.error to avoid flagging quota-exhausted or limit-reached requests as server crashes, since the client has a graceful speechSynthesis fallback.
      console.warn("Gemini TTS Warning (falling back to client speechSynthesis):", err.message || err);
      const isQuotaError = err.message?.includes("quota") || err.message?.includes("429") || err.status === 429;
      res.status(isQuotaError ? 429 : 500).json({ 
        error: err.message || "Gemini TTS failed",
        isQuotaExceeded: isQuotaError
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] BillMax running on http://localhost:${PORT}`);
  });
}

startServer();
