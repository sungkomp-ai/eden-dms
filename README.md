# EDEN DMS — ระบบจัดการภัยพิบัติ (Disaster Management System)

ระบบจัดการภัยพิบัติแบบครบวงจร พัฒนาใหม่ (reimplementation) จากการศึกษาสถาปัตยกรรม **Sahana Eden** (eden-core, Python/web2py) ขึ้นเป็นเว็บแอปพลิเคชันสมัยใหม่ ใช้งานง่าย ด้วย **Next.js 16 + TypeScript + Prisma + shadcn/ui** และอินเทอร์เฟซภาษาไทยทั้งระบบ

## ความสามารถหลัก

- บริหารเหตุการณ์ภัยพิบัติครบวงจร ตั้งแต่รับสายเหตุการณ์ รายงานสถานการณ์ ทะเบียนผู้ประสบภัย ศูนย์พักพิง คลังสิ่งของ ไปจนถึงคำขอความช่วยเหลือ
- แผนที่ GIS แสดงเหตุการณ์ ศูนย์พักพิง และองค์กร พร้อมเลเยอร์และมุมมองดาวเทียม
- การแจ้งเตือนภัยพิบัติผ่านหลายช่องทาง (SMS / Email / Line / Facebook)
- **ผู้ช่วย AI ด้านการจัดการภัยพิบัติ** — ผู้เชี่ยวชาญที่รับคำถาม วิเคราะห์ ตอบพร้อมคำแนะนำที่จำเป็น ค้นข้อมูลได้ทั้งจากภายในแพลตฟอร์ม (Prisma ทุกโมดูล) และจากภายนอก (Web Search พร้อมแหล่งอ้างอิงคลิกได้)
- Dashboard สรุป KPI และกราฟสถานการณ์แบบเรียลไทม์จากข้อมูลจริงในระบบ

## โมดูลทั้งหมด 13 โมดูล

| # | โมดูล | คำอธิบาย | อ้างอิงเดิม (eden-core) |
|---|-------|----------|------------------------|
| 1 | ภาพรวม (Dashboard) | KPI cards, กราฟเหตุการณ์/ผู้ประสบภัย, กิจกรรมล่าสุด | default/sit |
| 2 | เหตุการณ์ภัยพิบัติ | ประเภท/ระดับความรุนแรง/สถานะ, CRUD | sit |
| 3 | รายงานสถานการณ์ (SITREP) | รายงานผูกกับเหตุการณ์, CRUD | cms + sit |
| 4 | ทะเบียนบุคคล | ผู้ประสบภัย/บุคคลสูญหาย/พบตัว, CRUD | pr |
| 5 | ทะเบียนองค์กร | ประเภท/ภาคส่วน/ผู้บริจาค, CRUD | org |
| 6 | บุคลากร | อาสาสมัคร/เจ้าหน้าที่/ทักษะ/สถานะ, CRUD | hrm |
| 7 | ศูนย์พักพิง | ความจุ/จำนวนปัจจุบัน/สถานะ, CRUD | org/gis |
| 8 | คลังสินค้า | สินค้า/หน่วย/ปริมาณ/คลัง + จุดสั่งซื้อขั้นต่ำ, CRUD | org/inv |
| 9 | คำขอความช่วยเหลือ | ประเภท/ลำดับความสำคัญ/สถานะจับคู่, CRUD | req |
| 10 | แผนที่ GIS | เหตุการณ์ + ศูนย์พักพิง + องค์กร, หลายเลเยอร์ | gis |
| 11 | การแจ้งเตือน | เตือนภัย/ประกาศ/ช่องทาง, CRUD | msg |
| 12 | ผู้ดูแลระบบ | ผู้ใช้/บทบาท/ตั้งค่า/audit log | admin/auth |
| 13 | ผู้ช่วย AI | ผู้เชี่ยวชาญภัยพิบัติ วิเคราะห์+ตอบ+คำแนะนำ ค้นข้อมูลในระบบและภายนอก | — (ใหม่) |

## เทคโนโลยีที่ใช้

- **Next.js 16** (App Router) + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (New York) + Lucide Icons
- **Prisma ORM** + **SQLite**
- recharts (กราฟสถิติ), framer-motion (transition), next-themes (light/dark)
- **z-ai-web-dev-sdk** (ฝั่ง backend เท่านั้น): LLM สำหรับผู้ช่วย AI + Web Search

## การติดตั้งและรันโปรเจกต์

ต้องมี [Bun](https://bun.sh) (หรือ Node.js 20+)

```bash
# 1) ติดตั้ง dependencies
bun install

# 2) ตั้งค่า environment
cp .env.example .env

# 3) สร้าง Prisma Client
bun run db:generate

# 4) รันเซิร์ฟเวอร์พัฒนา
bun run dev
```

เปิดเบราว์เซอร์ที่ `http://localhost:3000`

> ฐานข้อมูลตัวอย่าง (ข้อมูลจำลองภาษาไทย) มาพร้อมไฟล์ `db/custom.db` รันได้ทันที
> หากต้องการเริ่มใหม่: `bun run db:push` แล้ว seed ข้อมูลด้วย `bun prisma/seed.ts`

## โครงสร้างโปรเจกต์

```
├── src/
│   ├── app/
│   │   ├── api/            # REST API routes (incidents, persons, shelters, ...)
│   │   ├── page.tsx        # Single-page app หลัก (SPA navigation)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── eden/           # โมดูลของระบบ (13 โมดูล)
│   │   └── ui/             # shadcn/ui components
│   └── lib/                # db client, constants, formatters, hooks
├── prisma/
│   ├── schema.prisma       # 20+ models
│   └── seed.ts             # ข้อมูลจำลองภาษาไทย (อ้างอิงเหตุการณ์จริง)
├── db/custom.db            # SQLite (ข้อมูลตัวอย่างพร้อมใช้)
└── worklog.md              # บันทึกการพัฒนาทุกเฟส
```

## REST API หลัก

| Endpoint | Methods | คำอธิบาย |
|----------|---------|----------|
| `/api/incidents` | GET, POST, PUT, DELETE | เหตุการณ์ภัยพิบัติ |
| `/api/sitreps` | GET, POST, PUT, DELETE | รายงานสถานการณ์ |
| `/api/persons` | GET, POST, PUT, DELETE | ทะเบียนบุคคล |
| `/api/organizations` | GET, POST, PUT, DELETE | องค์กร |
| `/api/hr` | GET, POST, PUT, DELETE | บุคลากร |
| `/api/shelters` | GET, POST, PUT, DELETE | ศูนย์พักพิง |
| `/api/inventory` | GET, POST, PUT, DELETE | คลังสินค้า |
| `/api/requests` | GET, POST, PUT, DELETE | คำขอความช่วยเหลือ |
| `/api/alerts` | GET, POST, PUT, DELETE | การแจ้งเตือน |
| `/api/users` | GET, POST, PUT, DELETE | ผู้ใช้/บทบาท |
| `/api/stats` | GET | สถิติรวมสำหรับ Dashboard |
| `/api/ai-assistant` | POST | ผู้ช่วย AI — `{ question, usePlatform, useWeb }` |

## ผู้ช่วย AI ด้านการจัดการภัยพิบัติ

โมดูล "ผู้ช่วย AI" เป็นบอทผู้เชี่ยวชาญด้านการจัดการภัยพิบัติ (อ้างอิงแนวปฏิบัติ ICS, แผนรับมือภัยพิบัติแห่งชาติ ปภ., Sendai Framework, OCHA):

- รับคำถาม วิเคราะห์ และตอบเป็นภาษาไทย พร้อม **คำแนะนำที่จำเป็น** ปิดท้ายทุกคำตอบ
- **ค้นข้อมูลในแพลตฟอร์ม** — ดึงข้อมูลจริงจากทุกโมดูล (เหตุการณ์, SITREP, ศูนย์พักพิง, คลังสินค้า, คำขอ, แจ้งเตือน, บุคคล, องค์กร, บุคลากร) มาใส่บริบทก่อนตอบ (RAG pattern)
- **ค้นข้อมูลจากภายนอก** — Web Search พร้อมแหล่งอ้างอิงคลิกได้ และเลขอ้างอิง [1] [2] ในคำตอบ
- ผู้ใช้ควบคุมแหล่งข้อมูลด้วยสวิตช์ 2 ตัว (ใช้ข้อมูลในระบบ / ค้นหาข้อมูลภายนอก)

## หมายเหตุ

- ข้อมูลทั้งหมดในระบบเป็น **ข้อมูลจำลอง (mock data) เพื่อการสาธิต** — อ้างอิงบริบทเหตุการณ์อุทกภัยฤดูน้ำหลาก ก.ย.–ต.ค. 2569
- พัฒนาโดยการศึกษาสถาปัตยกรรมและโมดูลของ Sahana Eden (eden-core) แล้วออกแบบใหม่ทั้งหมดบนเทคโนโลยีสมัยใหม่
- **เอกสารเปรียบเทียบสถาปัตยกรรมฉบับละเอียด (eden-core vs EDEN DMS, ฉบับ 1.1)** — module completeness + data granularity audit + แผนที่ความสัมพันธ์ 9 Entity หลัก (R1–R14) + Gap Analysis G1–G10 พร้อมเกณฑ์ปิด + Action Plan พร้อมประมาณความพยายาม (person-day) + Scorecard ต่อโดเมน/มิติ: [`docs/ARCHITECTURE-COMPARISON.md`](docs/ARCHITECTURE-COMPARISON.md)
- บันทึกการพัฒนารายเฟสทั้งหมดอยู่ที่ `worklog.md`
