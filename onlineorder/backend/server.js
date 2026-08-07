const http = require("http");
const https = require("https");
const tls = require("tls");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const OTP_DELIVERY_TIMEOUT_MS = Number(process.env.OTP_DELIVERY_TIMEOUT_MS || 30000);
const otpStore = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function createOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function otpKey(method, contact, purpose = "signup") {
  return `${method}:${purpose}:${contact.toLowerCase()}`;
}

function cleanEnv(value = "") {
  return String(value || "").trim();
}

function cleanPassword(value = "") {
  return cleanEnv(value).replace(/\s+/g, "");
}

function isPlaceholder(value = "") {
  return /^(your|example|paste|change-me)/i.test(cleanEnv(value));
}

function getEmailConfig() {
  const gmailUser = cleanEnv(process.env.GMAIL_USER);
  const smtpUser = cleanEnv(process.env.SMTP_USER);
  const gmailPassword = cleanPassword(process.env.GMAIL_APP_PASSWORD);
  const smtpPassword = cleanPassword(process.env.SMTP_PASS);
  const user = gmailUser && !isPlaceholder(gmailUser) ? gmailUser : smtpUser;
  const pass = gmailPassword && !isPlaceholder(gmailPassword) ? gmailPassword : smtpPassword;

  return {
    user,
    pass,
    host: cleanEnv(process.env.SMTP_HOST) || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
  };
}

async function sendSmsOtp(to, otp) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    return false;
  }

  const payload = new URLSearchParams({
    To: to,
    From: from,
    Body: `Your service booking OTP is ${otp}`,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.twilio.com",
        path: `/2010-04-01/Accounts/${sid}/Messages.json`,
        method: "POST",
        auth: `${sid}:${token}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
            return;
          }
          reject(new Error(body || `Twilio failed with ${res.statusCode}`));
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function sendEmailOtp(to, otp, purpose = "signup") {
  const emailConfig = getEmailConfig();

  if (!emailConfig.user || !emailConfig.pass || isPlaceholder(emailConfig.user) || isPlaceholder(emailConfig.pass)) {
    throw new Error("Gmail sender is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD in onlineorder/backend/.env, then restart the server.");
  }

  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    connectionTimeout: OTP_DELIVERY_TIMEOUT_MS,
    greetingTimeout: OTP_DELIVERY_TIMEOUT_MS,
    socketTimeout: OTP_DELIVERY_TIMEOUT_MS,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
  });

  const isPasswordReset = purpose === "reset-password";
  const subject = isPasswordReset ? "Your reset password OTP" : "Your LocalConnect verification code";
  const text = isPasswordReset
    ? `Your reset password OTP is ${otp}. It expires in 10 minutes.`
    : `Your LocalConnect OTP is ${otp}. It expires in 10 minutes.`;

  await transporter.sendMail({
    from: `LocalConnect <${emailConfig.user}>`,
    to,
    subject,
    text,
  });
  return true;
}

async function handleSendOtp(req, res) {
  const { method, contact, purpose } = await readBody(req);
  const cleanContact = String(contact || "").trim();
  const cleanMethod = String(method || "").trim();
  const cleanPurpose = String(purpose || "signup").trim();
  const isMobile = cleanMethod === "mobile";
  const isEmail = cleanMethod === "email";
  const validMobile = /^\+[1-9]\d{7,14}$/.test(cleanContact);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanContact);

  if ((!isMobile && !isEmail) || (isMobile && !validMobile) || (isEmail && !validEmail)) {
    sendJson(res, 400, {
      message: isMobile ? "Use mobile number with country code, example +919876543210." : "Enter a valid email address.",
    });
    return;
  }

  const otp = createOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  otpStore.set(otpKey(cleanMethod, cleanContact, cleanPurpose), { otp, expiresAt });

  let delivered = false;
  let deliveryError = "";

  try {
    delivered = await Promise.race([
      isMobile ? sendSmsOtp(cleanContact, otp) : sendEmailOtp(cleanContact, otp, cleanPurpose),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("OTP delivery timed out")), OTP_DELIVERY_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    deliveryError = error.message || "Delivery failed";
    console.error("[OTP-SEND:ERROR]", deliveryError);
  }

  if (!delivered) {
    const allowDevelopmentOtp = process.env.SHOW_DEV_OTP === "true";
    sendJson(res, cleanMethod === "email" && !allowDevelopmentOtp ? 500 : 200, {
      development: allowDevelopmentOtp,
      otp: allowDevelopmentOtp ? otp : undefined,
      message: `${cleanMethod === "email" ? "Email OTP" : "Mobile OTP"} could not be delivered.${allowDevelopmentOtp ? ` Development mode OTP: ${otp}` : ""}`,
      deliveryError: deliveryError || "Email sender is not configured.",
    });
    return;
  }

  sendJson(res, 200, {
    message: cleanPurpose === "reset-password" ? "Reset password OTP sent to your email." : `OTP sent to your ${cleanMethod}.`,
  });
}

async function handleVerifyOtp(req, res) {
  const { method, contact, otp, purpose } = await readBody(req);
  const key = otpKey(String(method || ""), String(contact || "").trim(), String(purpose || "signup").trim());
  const record = otpStore.get(key);

  if (!record || record.expiresAt < Date.now()) {
    sendJson(res, 400, { message: "OTP expired. Please send a new OTP." });
    return;
  }

  if (record.otp !== String(otp || "").trim()) {
    sendJson(res, 400, { message: "Incorrect OTP. Please try again." });
    return;
  }

  otpStore.delete(key);
  sendJson(res, 200, {
    message: purpose === "reset-password" ? "OTP verified. Set your new password." : "OTP verified. You can complete signup now.",
  });
}

function serveStatic(req, res) {
  const requestedPath = req.url === "/" ? "/signup-choice.html" : req.url.split("?")[0];
  const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(FRONTEND_DIR, safePath);

  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 200, {});
      return;
    }

    if (req.method === "POST" && req.url === "/api/send-otp") {
      await handleSendOtp(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/verify-otp") {
      await handleVerifyOtp(req, res);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { message: error.message || "Something went wrong." });
  }
});

server.listen(PORT, () => {
  console.log(`Service booking app running at http://localhost:${PORT}`);
  const emailConfig = getEmailConfig();
  console.log(`[EMAIL] Sender ${emailConfig.user ? `configured as ${emailConfig.user}` : "not configured"}`);
});
