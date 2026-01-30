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

// --- Setup Tw-Voucher ---
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
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}.box{background:#fff;border-radius:15px;padding:40px;max-width:500px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)}h1{color:#667eea;margin-bottom:20px;font-size:24px;text-align:center}input,button{width:100%;padding:15px;margin:10px 0;border-radius:8px;font-size:16px;border:2px solid #e5e7eb}button{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;cursor:pointer;font-weight:600}.info{background:#f0f9ff;padding:15px;border-radius:8px;margin:10px 0;font-size:14px;border-left:4px solid #3b82f6;color:#1e40af}.stat{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:20px 0}.stat div{background:#f9fafb;padding:15px;border-radius:10px;text-align:center;border:1px solid #e5e7eb}span{display:block;font-size:20px;font-weight:bold;color:#667eea}</style>
</head><body><div class="box">${body}</div></body></html>`;

// --- Utility Functions ---
function isLikelyVoucher(s) {
    if (!s || s.length < 10 || s.length > 50) return false;
    return /^[a-zA-Z0-9]+$/.test(s);
}

function extractVoucher(text) {
    if (!text) return null;
    const results = [];
    const urlRegex = /v=([A-Za-z0-9]{10,50})/gi; // แก้ไขให้รับ 10-50 ตัวตามต้องการ
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
        const data = { data: new Uint8ClampedArray(image.bitmap.data), width: image.bitmap.width, height: image.bitmap.height };
        const code = jsQR(data.data, data.width, data.height);
        return code?.data || null;
    } catch { return null; }
}

async function processVoucher(voucher) {
    if (recentSeen.has(voucher)) return;
    recentSeen.add(voucher);
    setTimeout(() => recentSeen.delete(voucher), 60000);
    
    console.log(`📩 พบซอง: ${voucher}`);
    const phone = CONFIG.walletNumber.replace(/\D/g, '');
    const voucherUrl = `https://gift.truemoney.com/campaign/?v=${voucher}`;
    
    try {
        const result = await twvoucher(phone, voucherUrl);
        if (result && result.amount) {
            totalClaimed++;
            totalAmount += parseFloat(result.amount);
            console.log(`✅ รับสำเร็จ: +${result.amount}฿`);
        } else {
            totalFailed++;
            console.log(`❌ ล้มเหลว: ${result?.message || 'ซองหมด/ผิดเงื่อนไข'}`);
        }
    } catch (err) {
        totalFailed++;
        console.log(`❌ Error: ${err.message}`);
    }
}

// --- Telegram Core ---
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
                while (!passwordCode) await new Promise(r => setTimeout(r, 1000));
                return passwordCode;
            },
            phoneCode: async () => {
                loginStep = "need-otp";
                while (!otpCode) await new Promise(r => setTimeout(r, 1000));
                return otpCode;
            },
            onError: (err) => console.log("Telegram Error:", err.message)
        });

        fs.writeFileSync(SESSION_FILE, client.session.save(), "utf8");
        loginStep = "logged-in";
        console.log("✅ บอทเชื่อมต่อ Telegram สำเร็จ!");

        client.addEventHandler(async (event) => {
            const msg = event.message;
            if (!msg) return;
            if (msg.media?.className === "MessageMediaPhoto") {
                const buffer = await client.downloadMedia(msg.media);
                const qrData = await decodeQR(buffer);
                if (qrData) {
                    const vs = extractVoucher(qrData);
                    if (vs) vs.forEach(v => processVoucher(v));
                }
            }
            const vs = extractVoucher(msg.message);
            if (vs) vs.forEach(v => processVoucher(v));
        }, new NewMessage({ incoming: true }));

    } catch (err) { console.error("Login Failed:", err.message); }
}

// --- Routes ---
app.get('/', (req, res) => {
    if (!CONFIG) {
        res.send(html("Setup", `<h1>🚀 Setup Bot</h1><form action="/save-config" method="POST">
            <input name="apiId" placeholder="API ID" required>
            <input name="apiHash" placeholder="API Hash" required>
            <input name="phoneNumber" placeholder="เบอร์ Telegram (+66...)" required>
            <input name="walletNumber" placeholder="เบอร์ Wallet รับเงิน" required>
            <button type="submit">บันทึกข้อมูล</button></form>`));
    } else if (loginStep === "logged-in") {
        res.send(html("Dashboard", `<h1>✅ บอททำงานอยู่</h1>
            <div class="stat"><div>สำเร็จ<span>${totalClaimed}</span></div><div>ล้มเหลว<span>${totalFailed}</span></div><div>รวม<span>${totalAmount}฿</span></div></div>
            <button onclick="location.href='/reset'" style="background:#ef4444">Reset</button>
            <script>setTimeout(()=>location.reload(),20000)</script>`));
    } else if (loginStep === "need-otp") {
        res.send(html("OTP", `<h1>🔑 ใส่รหัส OTP</h1><form action="/verify-otp" method="POST"><input name="otp" required><button type="submit">ยืนยัน</button></form>`));
    } else if (loginStep === "need-password") {
        res.send(html("2FA", `<h1>🔒 ใส่รหัส 2FA</h1><form action="/verify-2fa" method="POST"><input name="password" type="password"><button type="submit">ยืนยัน</button></form>`));
    } else {
        res.send(html("Wait", `<h1>⌛ กำลังประมวลผล...</h1><script>setTimeout(()=>location.href='/',3000)</script>`));
    }
});

app.post('/save-config', (req, res) => {
    CONFIG = { ...req.body, apiId: parseInt(req.body.apiId) };
    res.redirect('/');
    startBot();
});
app.post('/verify-otp', (req, res) => { otpCode = req.body.otp; res.redirect('/'); });
app.post('/verify-2fa', (req, res) => { passwordCode = req.body.password; res.redirect('/'); });
app.get('/reset', (req, res) => { if(fs.existsSync('session.txt')) fs.unlinkSync('session.txt'); CONFIG=null; res.redirect('/'); });

app.listen(10000, () => console.log("🌐 Server running on port 10000"));

// --- Auto Start if .env exists ---
if (fs.existsSync('.env')) {
    const env = require('dotenv').config().parsed;
    if (env.API_ID) {
        CONFIG = { apiId: parseInt(env.API_ID), apiHash: env.API_HASH, phoneNumber: env.PHONE_NUMBER, walletNumber: env.WALLET_NUMBER };
        startBot();
    }
}
