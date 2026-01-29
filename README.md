# Telegarm-Bot

สิ่งที่ต้องมีล่วงหน้า

บัญชี Telegram

เบอร์โทรที่ใช้กับ Telegram

เบอร์กระเป๋า TrueMoney Wallet



---

ขั้นตอนที่ 1: สมัคร Render (สำหรับรันบอท 24/7)

1. ไปที่ https://render.com


2. กด Get Started / Sign Up


3. เลือก Sign up with Google

> แนะนำ: ใช้ Startedกติ สมัครง่าย ไม่ต้องตั้งค่าอะไรเพิ่ม




4. Login ด้วยบัญชี Google ของคุณ




---

ขั้นตอนที่ 2: สร้าง Web Service

1. ที่หน้า Dashboard ของ Render กด New +


2. เลือก Web Service


3. เลือก Public Repository:



4. ใส่ลิ้ง https://github.com/wexcea/Telegram-Bot/tree/main

5.กด Connect




---

ขั้นตอนที่ 3: ตั้งค่า Web Service

ตั้งค่าตามนี้ทุกบรรทัด

Name

truemoney-bot

Environment

Node

Build Command

npm install

Start Command

npm start

Instance Type

Free


จากนั้นกด Create Web Service


---

ขั้นตอนที่ 4: รอ Deploy

ใช้เวลาประมาณ 2–3 นาที

รอจนสถานะขึ้น Live สีเขียว 🟢


เมื่อเสร็จแล้ว ให้คัดลอก URL เช่น:

https://truemoney-bot-xxxx.onrender.com


---

ขั้นตอนที่ 5: สมัคร Telegram API

1. ไปที่ https://my.telegram.org/apps


2. Login ด้วยเบอร์ Telegram


3. ใส่ OTP ที่ได้รับใน Telegram


4. กด API development tools



กรอกข้อมูล:

App title: TrueMoney Bot

Short name: tmbot

Platform: Desktop

Description: เว้นว่างได้


กด Create application

เก็บข้อมูลนี้ไว้:

api_id

api_hash



---

ขั้นตอนที่ 6: ตั้งค่าบอท (หน้าเว็บ)

1. เปิด URL จาก Render


2. จะเจอหน้า ตั้งค่าบอท



กรอกข้อมูล:

🔑 API ID
(ตัวเลขจาก my.telegram.org)

🔐 API Hash
(รหัสยาวจาก my.telegram.org)

📱 เบอร์ Telegram

+668xxxxxxxx

> ต้องขึ้นต้นด้วย +66



💰 เบอร์ TrueMoney Wallet

0xxxxxxxxx

📝 ชื่อกระเป๋า (ไม่บังคับ)

กระเป๋าหลัก


กด ✅ บันทึกและเริ่มใช้งาน


---

ขั้นตอนที่ 7: Login Telegram

1. กด 📨 ส่ง OTP


2. เปิด Telegram เพื่อดูรหัส OTP


3. กลับมาใส่ OTP บนหน้าเว็บ


4. กด ✅ ยืนยัน



กรณีมี 2FA

ใส่รหัส 2FA

กด ✅ ยืนยัน


กรณีไม่มี 2FA

กด ⏭️ ข้าม



---

ขั้นตอนที่ 8: เริ่มใช้งาน

เมื่อสำเร็จ จะเห็นหน้าจอ:

🚀 TrueMoney Bot
✅ บอทกำลังทำงาน

┌─────────┬─────────┬─────────┐
│รับสำเร็จ │ล้มเหลว  │ยอดรวม   │
│   0     │   0     │   0฿    │
└─────────┴─────────┴─────────┘

📱 เบอร์: +668xxxxxxxx
💰 กระเป๋า: กระเป๋าหลัก

บอทพร้อมใช้งานทันที 🎉


---

🛌 ป้องกัน Render Sleep (แนะนำ)

1. ไปที่ https://uptimerobot.com


2. สมัครฟรี


3. เพิ่ม Monitor:

Monitor Type: HTTP(s)

URL: URL ของ Render

Interval: 10 minutes





---

🔧 การแก้ปัญหาเบื้องต้น

หน้าเว็บไม่ขึ้น

ตรวจสอบ Render เป็น Live สีเขียว

รอ 1–2 นาที แล้ว Refresh


Login ไม่ได้

ตรวจสอบ API_ID และ API_HASH

เบอร์ต้องขึ้นต้นด้วย +66

กด ตั้งค่าใหม่


OTP ไม่มา

ตรวจสอบเบอร์ Telegram

ดูข้อความใน Telegram

กดส่ง OTP ใหม่


บอทไม่ทำงาน

ตรวจสอบหน้าเว็บขึ้น ✅ กำลังทำงาน

ตรวจสอบ Logs ที่ Render



---

หมายเหตุ

ใช้งานจาก Public Repository ได้ทันที

❌ ไม่ต้อง Fork

❌ ไม่ต้องอัปโหลดไฟล์เอง

❌ ไม่ต้องเขียนโค้ด



---

ผู้พัฒนา

GitHub: https://github.com/wexcea
