const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const Jimp = require("jimp");
const jsQR = require("jsqr");
const fs = require("fs");
require("dotenv").config();

// ========================================
// 🆕 ใช้ @fortune-inc/tw-voucher แทน Proxy
// ========================================
let twvoucher;
const twPackage = require('@fortune-inc/tw-voucher');
if (typeof twPackage === 'function') {
    twvoucher = twPackage;
} else if (twPackage.voucher && typeof twPackage.voucher === 'function') {
    twvoucher = twPackage.voucher;
} else {
    twvoucher = twPackage.default || twPackage;
}

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let CONFIG = null;
let totalClaimed = 0;
let totalFailed = 0;
let totalAmount = 0;
let loginStep = "need-config";
let otpCode = "";
let passwordCode = "";
let client = null;
const recentSeen = new Set();

const html = (title, body) => `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}.box{background:#fff;border-radius:15px;padding:40px;max-width:500px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)}h1{color:#667eea;margin-bottom:20px;font-size:28px;text-align:center}h2{color:#374151;font-size:18px;margin:20px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:10px}input,button,textarea{width:100%;padding:15px;margin:10px 0;border-radius:8px;font-size:16px;border:2px solid #e5e7eb;transition:all 0.3s}input:focus,textarea:focus{outline:none;border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,0.1)}button{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;cursor:pointer;font-weight:600}button:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(102,126,234,0.3)}.info{background:#f0f9ff;padding:15px;border-radius:8px;margin:10px 0;font-size:14px;border-left:4px solid #3b82f6;color:#1e40af}.warning{background:#fef3c7;border-left-color:#f59e0b;color:#92400e}.success{background:#d1fae5;border-left-color:#10b981;color:#065f46}.stat{display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;margin:20px 0}.stat div{background:#f9fafb;padding:20px;border-radius:10px;text-align:center;border:2px solid #e5e7eb}.stat div span{display:block;font-size:32px;font-weight:bold;color:#667eea;margin-top:8px}.label{font-weight:600;color:#374151;margin:15px 0 5px;display:block}.note{font-size:12px;color:#6b7280;margin-top:5px}.code{background:#1f2937;color:#10b981;padding:8px 12px;border-radius:5px;font-family:monospace;font-size:14px;display:inline-block;margin:5px 0}.step{background:#f3f4f6;padding:15px;border-radius:8px;margin:15px 0;border-left:4px solid #667eea}a{color:#667eea;text-decoration:none;font-weight:600}</style>
</head><body><div class="box">${body}</div></body></html>`;

// --- ฟังก์ชันช่วยเหลือ ---

function isLikelyVoucher(s) {
  if (!s || s.length < 10 || s.length > 64) return false; // ขยายความยาวรองรับรหัส 35 ตัว
  return /^[a-zA-Z0-9]+$/.test(s);
}

function extractVoucher(text) {
  if (!text) return null;
  const results = [];
  // ✅ แก้ไข Regex ให้รองรับรหัสยาว 10-50 ตัว และดักได้ทุกรูปแบบลิงก์
  const urlRegex = /gift\.truemoney\.com\/campaign\/?\??(?:v=|v\/)([A-Za-z0-9]{10,50})/gi;
  const matches = [...text.matchAll(urlRegex)];
  for (const match of matches) {
    let voucher = match[1].trim().replace(/\s/g, '');
    if (isLikelyVoucher(voucher)) results.push(voucher);
  }
  return results.length > 0 ? results : null;
}

async function decodeQR(buffer) {
  try {
    const image = await Jimp.read(buffer);
    const data = {
      data: new Uint8ClampedArray(image.bitmap.data),
      width: image.bitmap.width,
      height: image.bitmap.height
    };
    const code = jsQR(data.data, data.width, data.height);
    return code?.data || null;
  } catch { return null; }
}

async function sendWebhookNotification(amount, voucher, speed) {
    if (!CONFIG.webhookUrl || !CONFIG.webhookUrl.startsWith('http')) return;
    try {
        await axios.post(CONFIG.webhookUrl, {
            embeds: [{
                title: "✅ รับซองสำเร็จ!",
                color: 5814783,
                fields: [
                    { name: "💵 จำนวนเงิน", value: `**${amount.toFixed(2)}** บาท`, inline: true },
                    { name: "⚡ ความเร็ว", value: `**${speed}** ms`, inline: true },
                    { name: "🔗 ลิงก์", value: `https://gift.truemoney.com/campaign/?v=${voucher}` }
                ],
                footer: { text: `Telegram Sniper • ${new Date().toLocaleTimeString('th-TH')}` }
            }]
        });
    } catch (err) { console.error("Webhook Error"); }
}

async function processVoucher(voucher) {
    if (recentSeen.has(voucher)) return;
    recentSeen.add(voucher);
    setTimeout(() => recentSeen.delete(voucher), 60000);
    
    const startTime = Date.now();
    const phone = CONFIG.walletNumber.replace(/\D/g, '');
    const voucherUrl = `https://gift.truemoney.com/campaign/?v=${voucher}`;
    
    try {
        const result = await twvoucher(phone, voucherUrl);
        const speed = Date.now() - startTime;
        if (result && result.amount) {
            const amount = parseFloat(result.amount);
            totalClaimed++;
            totalAmount += amount;
            console.log(`✅ [${speed}ms] +${amount}฿ | ${voucher}`);
            await sendWebhookNotification(amount, voucher, speed);
        } else {
            totalFailed++;
            console.log(`❌ [${speed}ms] ${result?.message || 'ซองมีปัญหา'} | ${voucher}`);
        }
    } catch (err) {
        totalFailed++;
        console.log(`❌ Error: ${err.message}`);
    }
}

// --- ส่วนของ Server และ Telegram ---

async function startBot() {
  if (!CONFIG) return;
  const SESSION_FILE = "session.txt";
  let sessionString = fs.existsSync(SESSION_FILE) ? fs.readFileSync(SESSION_FILE, "utf8").trim() : "";
  
  client = new TelegramClient(new StringSession(sessionString), CONFIG.apiId, CONFIG.apiHash, {
    connectionRetries: 5, autoReconnect: true
  });
  
  try {
    await client.start({
      phoneNumber: async () => CONFIG.phoneNumber,
      password: async () => {
        loginStep = "need-password";
        while (!passwordCode) await new Promise(r => setTimeout(r, 500));
        return passwordCode;
      },
      phoneCode: async () => {
        loginStep = "need-otp";
        while (!otpCode) await new Promise(r => setTimeout(r, 500));
        return otpCode;
      },
      onError: (err) => console.log(err.message)
    });

    fs.writeFileSync(SESSION_FILE, client.session.save(), "utf8");
    loginStep = "logged-in";
    console.log("✅ บอทออนไลน์แล้ว!");

    client.addEventHandler(async (event) => {
      const msg = event.message;
      if (!msg) return;

      // 🖼️ ตรวจสอบรูปภาพ (QR Code)
      if (msg.media?.className === "MessageMediaPhoto") {
        const buffer = await client.downloadMedia(msg.media);
        const qrData = await decodeQR(buffer);
        const vouchers = extractVoucher(qrData);
        if (vouchers) vouchers.forEach(v => processVoucher(v));
      }
      
      // 💬 ตรวจสอบข้อความ
      const vouchers = extractVoucher(msg.message);
      if (vouchers) vouchers.forEach(v => processVoucher(v));
    }, new NewMessage({ incoming: true }));

  } catch (err) { console.error("Login Failed", err.message); }
}

// --- Express Routes ---

app.get('/', (req, res) => {
    if (!CONFIG) {
        res.send(html("ตั้งค่า", `<h1>🚀 Setup</h1><form action="/save-config" method="POST">
            <label>API ID</label><input name="apiId" required>
            <label>API Hash</label><input name="apiHash" required>
            <label>เบอร์ Telegram (+66...)</label><input name="phoneNumber" required>
            <label>เบอร์วอลเล็ทรับเงิน</label><input name="walletNumber" required>
            <label>Webhook URL (ไม่บังคับ)</label><input name="webhookUrl">
            <button type="submit">เริ่มใช้งาน</button></form>`));
    } else if (loginStep === "logged-in") {
        res.send(html("Dashboard", `<h1>🚀 Dashboard</h1>
            <div class="stat">
                <div>สำเร็จ<span>${totalClaimed}</span></div>
                <div>ล้มเหลว<span>${totalFailed}</span></div>
                <div>รวม<span>${totalAmount}฿</span></div>
            </div>
            <button onclick="location.href='/reset'">ล้างข้อมูล</button>
            <script>setTimeout(()=>location.reload(),15000)</script>`));
    } else if (loginStep === "need-otp") {
        res.send(html("OTP", `<h1>🔑 ใส่รหัส OTP</h1><form action="/verify-otp" method="POST"><input name="otp" required><button type="submit">ยืนยัน</button></form>`));
    } else if (loginStep === "need-password") {
        res.send(html("2FA", `<h1>🔒 ใส่รหัส 2FA</h1><form action="/verify-2fa" method="POST"><input name="password" type="password"><button type="submit">ยืนยัน</button></form>`));
    } else {
        res.send(html("Wait", `<h1>⌛ กำลังโหลด...</h1><script>setTimeout(()=>location.reload(),2000)</script>`));
    }
});

app.post('/save-config', (req, res) => {
    CONFIG = { ...req.body, apiId: parseInt(req.body.apiId) };
    loginStep = "connecting";
    res.redirect('/');
    startBot();
});

app.post('/verify-otp', (req, res) => { otpCode = req.body.otp; res.redirect('/'); });
app.post('/verify-2fa', (req, res) => { passwordCode = req.body.password; res.redirect('/'); });
app.get('/reset', (req, res) => { CONFIG = null; fs.unlinkSync('session.txt'); res.redirect('/'); });

app.listen(10000, () => console.log("Server on port 10000"));
