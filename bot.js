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
// 🆕 TrueMoney Voucher Package
// ========================================
let twvoucher;
const twPackage = require('@fortune-inc/tw-voucher');
twvoucher = typeof twPackage === 'function' ? twPackage : (twPackage.voucher || twPackage.default || twPackage);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let CONFIG = null, totalClaimed = 0, totalFailed = 0, totalAmount = 0;
let loginStep = "need-config", otpCode = "", client = null;

// ========================================
// 🌑 Hacker Dark UI Template
// ========================================
const html = (title, body) => `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | root@system</title>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        :root { --bg: #050505; --card-bg: #0d0d0d; --accent: #00ff41; --text: #ffffff; --border: #1a1a1a; --dim: #555; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'JetBrains Mono', monospace; }
        body { background-color: var(--bg); color: var(--text); min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 20px; overflow-x: hidden; }
        
        /* Hacker Background Effect */
        body::before {
            content: "01010101"; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            color: rgba(0, 255, 65, 0.03); font-size: 10px; line-height: 1; z-index: -1; pointer-events: none;
            word-break: break-all; opacity: 0.5;
        }

        .container { 
            background: var(--card-bg); border: 1px solid var(--border); border-radius: 4px; 
            padding: 30px; width: 100%; max-width: 460px; position: relative;
            box-shadow: 0 0 30px rgba(0, 255, 65, 0.05);
        }
        .container::after {
            content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: var(--accent);
        }

        h1 { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 25px; color: var(--accent); text-shadow: 0 0 10px rgba(0, 255, 65, 0.5); }
        
        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .stat-card { border: 1px solid var(--border); padding: 15px; background: #000; position: relative; }
        .stat-card small { color: var(--dim); font-size: 10px; text-transform: uppercase; display: block; }
        .stat-card span { display: block; font-size: 18px; color: var(--text); margin-top: 5px; }
        
        .info-row { border-bottom: 1px dotted var(--border); padding: 10px 0; font-size: 12px; display: flex; justify-content: space-between; color: #ccc; }
        .status-badge { font-size: 10px; color: var(--accent); margin-bottom: 20px; display: block; }

        input { 
            width: 100%; background: #000; border: 1px solid var(--border); padding: 12px; border-radius: 2px; 
            color: var(--accent); margin-bottom: 12px; outline: none; font-size: 13px; transition: 0.3s;
        }
        input:focus { border-color: var(--accent); box-shadow: 0 0 10px rgba(0, 255, 65, 0.2); }
        input::placeholder { color: #333; }

        button { 
            width: 100%; padding: 14px; border: 1px solid var(--accent); font-weight: 700; 
            cursor: pointer; background: var(--accent); color: #000; transition: 0.3s; text-transform: uppercase;
        }
        button:hover { background: transparent; color: var(--accent); }
        
        .btn-reset { background: transparent; color: #555; border-color: #222; margin-top: 20px; font-size: 11px; }
        .btn-reset:hover { border-color: #ff0000; color: #ff0000; }

        .terminal-header { display: flex; gap: 5px; margin-bottom: 15px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .dot.red { background: #ff5f56; } .dot.yellow { background: #ffbd2e; } .dot.green { background: #27c93f; }
    </style>
</head>
<body>
    <div class="container">
        <div class="terminal-header"><div class="dot red"></div><div class="dot yellow"></div><div class="dot green"></div></div>
        ${body}
    </div>
</body>
</html>`;

app.get('/', (req, res) => {
    if (!CONFIG) {
        res.send(html("SETUP", `
            <h1>> INITIALIZE_SYSTEM</h1>
            <p style="font-size: 11px; color: var(--dim); margin-bottom: 20px;">กรุณาระบุข้อมูลพื้นฐานและ Webhook เพื่อเริ่มต้น</p>
            <form action="/save-config" method="POST">
                <input type="text" name="apiId" placeholder="TELEGRAM_API_ID" required>
                <input type="text" name="apiHash" placeholder="TELEGRAM_API_HASH" required>
                <input type="text" name="phoneNumber" placeholder="PHONE_NUMBER (+66...)" required>
                <input type="text" name="walletNumber" placeholder="WALLET_NUMBER" required>
                <input type="text" name="webhookUrl" placeholder="WEBHOOK_URL (Discord/Optional)">
                <button type="submit">EXECUTE STARTUP</button>
            </form>
        `));
    } else if (loginStep === "logged-in") {
        res.send(html("DASHBOARD", `
            <span class="status-badge">[SYSTEM STATUS: ONLINE]</span>
            <h1>> COMMAND_CENTER</h1>
            <div class="stat-grid">
                <div class="stat-card"><small>Success</small><span>${totalClaimed}</span></div>
                <div class="stat-card"><small>Failed</small><span>${totalFailed}</span></div>
                <div class="stat-card" style="grid-column: span 2;"><small>Revenue_Total</small><span style="color:var(--accent); font-size: 24px;">฿ ${totalAmount.toFixed(2)}</span></div>
            </div>
            <div class="info-row"><span>WALLET_ID</span><span>${CONFIG.walletNumber}</span></div>
            <div class="info-row"><span>ACCESS_PHONE</span><span>${CONFIG.phoneNumber}</span></div>
            <div class="info-row"><span>WEBHOOK</span><span style="font-size: 10px; color: var(--dim);">${CONFIG.webhookUrl ? 'ENABLED' : 'DISABLED'}</span></div>
            <button onclick="if(confirm('TERMINATE SYSTEM?')) location.href='/reset'" class="btn-reset">TERMINATE & RESET</button>
            <script>setTimeout(()=>location.reload(), 10000)</script>
        `));
    } else if (loginStep === "need-otp") {
        res.send(html("AUTH", `
            <h1>> AUTH_REQUIRED</h1>
            <p style="font-size: 11px; color: var(--dim); margin-bottom: 15px;">กรุณากรอกรหัสผ่านจาก TELEGRAM</p>
            <form action="/verify-otp" method="POST">
                <input type="text" name="otp" placeholder="_ENTER_CODE" maxlength="5" required autofocus>
                <button type="submit">VERIFY_IDENTITY</button>
            </form>
        `));
    } else {
        res.send(html("WAIT", `<h1>> LOADING...</h1><script>setTimeout(()=>location.href='/', 3000)</script>`));
    }
});

app.post('/save-config', async (req, res) => {
    CONFIG = { 
        apiId: parseInt(req.body.apiId), 
        apiHash: req.body.apiHash, 
        phoneNumber: req.body.phoneNumber, 
        walletNumber: req.body.walletNumber,
        webhookUrl: req.body.webhookUrl 
    };
    fs.writeFileSync('.env', `API_ID=${CONFIG.apiId}\nAPI_HASH=${CONFIG.apiHash}\nPHONE_NUMBER=${CONFIG.phoneNumber}\nWALLET_NUMBER=${CONFIG.walletNumber}\nWEBHOOK_URL=${CONFIG.webhookUrl}`);
    res.redirect('/');
    setTimeout(() => startBot(), 2000);
});

app.post('/verify-otp', (req, res) => { otpCode = req.body.otp; res.redirect('/'); });

app.get('/reset', (req, res) => {
    CONFIG = null;
    if (fs.existsSync('.env')) fs.unlinkSync('.env');
    if (fs.existsSync('session.txt')) fs.unlinkSync('session.txt');
    res.redirect('/');
});

async function sendWebhook(msg) {
    if (!CONFIG?.webhookUrl) return;
    try {
        await axios.post(CONFIG.webhookUrl, { content: "```\n" + msg + "\n```" });
    } catch (e) { console.log("Webhook Error"); }
}

const recentSeen = new Set();
async function processVoucher(voucher, source = "TG") {
    if (recentSeen.has(voucher)) return;
    recentSeen.add(voucher);
    const startTime = Date.now();
    setTimeout(() => recentSeen.delete(voucher), 30000);
    
    try {
        const result = await twvoucher(CONFIG.walletNumber, `https://gift.truemoney.com/campaign/?v=${voucher}`);
        const duration = Date.now() - startTime;
        if (result && result.amount) {
            const amount = parseFloat(result.amount);
            totalClaimed++; totalAmount += amount;
            const logMsg = `[CLAIMED] +${amount} THB | Total: ${totalAmount} | Ping: ${duration}ms | Src: ${source}`;
            if (client) await client.sendMessage("me", { message: logMsg });
            await sendWebhook(logMsg);
        } else { totalFailed++; }
    } catch (e) { totalFailed++; }
}

async function startBot() {
    if (!CONFIG) return;
    const session = new StringSession(fs.existsSync("session.txt") ? fs.readFileSync("session.txt", "utf8") : "");
    client = new TelegramClient(session, CONFIG.apiId, CONFIG.apiHash, { connectionRetries: 5, autoReconnect: true });
    
    try {
        await client.start({
            phoneNumber: async () => CONFIG.phoneNumber,
            phoneCode: async () => { 
                loginStep = "need-otp"; 
                while(!otpCode) await new Promise(r => setTimeout(r, 1000)); 
                const c = otpCode; otpCode = ""; return c; 
            },
            onError: e => console.log(e.message)
        });
        fs.writeFileSync("session.txt", client.session.save());
        loginStep = "logged-in";
        client.addEventHandler(async (event) => {
            const msg = event.message;
            if (msg?.message) {
                const urlRegex = /v=([a-zA-Z0-9]+)/gi;
                const matches = [...msg.message.matchAll(urlRegex)];
                if (matches.length > 0) {
                    for (const m of matches) await processVoucher(m[1], "Telegram");
                }
            }
        }, new NewMessage({ incoming: true }));
    } catch (err) { console.error(err); }
}

if (fs.existsSync('.env')) {
    CONFIG = { 
        apiId: parseInt(process.env.API_ID), 
        apiHash: process.env.API_HASH, 
        phoneNumber: process.env.PHONE_NUMBER, 
        walletNumber: process.env.WALLET_NUMBER,
        webhookUrl: process.env.WEBHOOK_URL 
    };
    startBot();
}

app.listen(10000, () => console.log("System Executed on Port 10000"));
