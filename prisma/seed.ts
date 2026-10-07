/**
 * EDEN DMS — Seed script (ข้อมูลจำลองภาษาไทย)
 * อ้างอิงเหตุการณ์จริง: อุทกภัยประเทศไทย ก.ย.–ต.ค. 2569 (2026)
 * รัน: bun prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import { scryptSync, randomBytes } from 'crypto'

const db = new PrismaClient()

/** scrypt hash แบบเดียวกับ src/lib/auth.ts (salt:hash) */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

async function main() {
  console.log('🌱 Seeding EDEN DMS (ฤดูน้ำหลาก ก.ย.–ต.ค. 2569)...')

  // ล้างข้อมูลเดิม (เรียงตาม dependency)
  await db.auditLog.deleteMany()
  await db.mapLayer.deleteMany()
  await db.alert.deleteMany()
  await db.aidRequest.deleteMany()
  await db.inventoryItem.deleteMany()
  await db.warehouse.deleteMany()
  await db.person.deleteMany()
  await db.humanResource.deleteMany()
  await db.shelter.deleteMany()
  await db.incidentReport.deleteMany()
  await db.incident.deleteMany()
  await db.organization.deleteMany()
  await db.user.deleteMany()
  await db.setting.deleteMany()
  await db.location.deleteMany()

  const dt = (iso: string) => new Date(iso) // ISO แบบมี +07:00 = เวลาไทย

  // ===== Locations (gis) =====
  const chiangmai = await db.location.create({ data: { name: 'จังหวัดเชียงใหม่', level: 'province', lat: 18.7883, lng: 98.9853 } })
  const lampang = await db.location.create({ data: { name: 'จังหวัดลำปาง', level: 'province', lat: 18.2926, lng: 99.4927 } })
  const nan = await db.location.create({ data: { name: 'จังหวัดน่าน', level: 'province', lat: 18.7755, lng: 100.7734 } })
  const bangkok = await db.location.create({ data: { name: 'กรุงเทพมหานคร', level: 'province', lat: 13.7563, lng: 100.5018 } })
  const nont = await db.location.create({ data: { name: 'จังหวัดนนทบุรี', level: 'province', lat: 13.8628, lng: 100.5101 } })
  const pathum = await db.location.create({ data: { name: 'จังหวัดปทุมธานี', level: 'province', lat: 14.0127, lng: 100.5312 } })
  const ayut = await db.location.create({ data: { name: 'จังหวัดพระนครศรีอยุธยา', level: 'province', lat: 14.3532, lng: 100.5776 } })
  await db.location.createMany({
    data: [
      { name: 'อำเภอเมืองเชียงใหม่', level: 'district', lat: 18.7904, lng: 98.9847, parentId: chiangmai.id },
      { name: 'อำเภอสันทราย', level: 'district', lat: 18.8772, lng: 99.0089, parentId: chiangmai.id },
      { name: 'อำเภอห้างฉัตร', level: 'district', lat: 18.3667, lng: 99.5333, parentId: lampang.id },
      { name: 'อำเภอเวียงสา', level: 'district', lat: 18.9333, lng: 100.7167, parentId: nan.id },
      { name: 'เขตบางกะปิ', level: 'district', lat: 13.7449, lng: 100.6640, parentId: bangkok.id },
      { name: 'เขตบึงกุ่ม', level: 'district', lat: 13.7652, lng: 100.7031, parentId: bangkok.id },
      { name: 'เขตลาดสี', level: 'district', lat: 13.8848, lng: 100.6155, parentId: bangkok.id },
    ],
  })

  // ===== Incidents (sit) =====
  // เหตุการณ์จริงช่วง ก.ย.–ต.ค. 2569: อุทกภัยรอบด้าน 42 จังหวัด + น้ำท่วมใหญ่ กทม. (24–30 ก.ย. 69)
  const nationwide = await db.incident.create({
    data: {
      code: 'INC-2569-005', title: 'อุทกภัยรอบด้าน 42 จังหวัด (ร่องมรสุม + พายุดีเปรสชัน)', type: 'flood', severity: 'critical', status: 'active',
      description: 'ฝนตกหนักต่อเนื่องจากร่องมรสุมและพายุดีเปรสชันตั้งแต่ 16 ก.ย. 2569 น้ำท่วมทั่วประเทศ 42 จังหวัด ผู้ประสบภัยกว่า 2.6 ล้านคน เสียชีวิตรวม 40 ราย (ข้อมูล 6 ต.ค. 69) ครม. อนุมัติเงินช่วยเหลือฉุกเฉิน 4,100 ล้านบาท และเยียวยา 9,000 บาท/ครัวเรือน',
      locationName: 'ทั่วประเทศ — ลุ่มเจ้าพระยา อีสาน ภาคใต้ฝั่งอ่าวไทย', lat: 15.1, lng: 100.6,
      affectedPeople: 2600000, injured: 143, deceased: 40, startDate: dt('2026-09-16T08:00:00+07:00'),
    },
  })
  const bkflood = await db.incident.create({
    data: {
      code: 'INC-2569-006', title: 'น้ำท่วมใหญ่กรุงเทพมหานคร (24–30 ก.ย. 69)', type: 'flood', severity: 'critical', status: 'monitoring',
      description: 'ฝนตกต่อเนื่อง 48 ชม. จากพายุดีเปรสชัน ปริมาณฝนบางพื้นที่เกิน 300 มม. ประกาศภาวะฉุกเฉิน 26 ก.ย. 69 เวลา 10:16 น. ทั้ง 50 เขตเป็นพื้นที่ประสบภัยพิบัติ จุดน้ำท่วมถนนหลัก 37 จุด ผู้ประสบภัยกว่า 700,000 คน ประกาศวันหยุดพิเศษ 28–29 ก.ย. เป็นน้ำท่วมรุนแรงที่สุดในรอบ 15 ปี — ขณะนี้น้ำลดและอยู่ระหว่างฟื้นฟู',
      locationId: bangkok.id, locationName: 'เขตบางกะปิ, เขตบึงกุ่ม, เขตลาดสี และพื้นที่ต่ำทั่ว 50 เขต', lat: 13.7449, lng: 100.6640,
      affectedPeople: 700000, injured: 58, deceased: 4, startDate: dt('2026-09-24T05:00:00+07:00'), endDate: dt('2026-09-30T23:00:00+07:00'),
    },
  })
  const cpflood = await db.incident.create({
    data: {
      code: 'INC-2569-007', title: 'น้ำท่วมลุ่มเจ้าพระยาตอนล่าง (อยุธยา–ปทุมธานี–นนทบุรี)', type: 'flood', severity: 'high', status: 'monitoring',
      description: 'น้ำเหนือจากภาคเหนือไหลลงสู่ลุ่มเจ้าพระยา ร่วมกับน้ำฝนเข้าเขื่อน เขื่อนภูมิพลระบาย 35 ลบ.ม./วิ สิริกิติ์ 93 ลบ.ม./วิ (29 ก.ย. 69) น้ำท่วมชายทุ่งการเกษตรและพื้นที่ต่ำนอกคันคลอง กรมชลประทานยืนยันเขื่อนหลักยังมีช่องว่างรับน้ำ น้ำระบายไม่ท่วมภาคกลาง (6 ต.ค. 69)',
      locationId: ayut.id, locationName: 'จ.พระนครศรีอยุธยา, จ.ปทุมธานี, จ.นนทบุรี', lat: 14.3532, lng: 100.5776,
      affectedPeople: 318000, injured: 22, deceased: 8, startDate: dt('2026-09-19T06:00:00+07:00'),
    },
  })
  const southflood = await db.incident.create({
    data: {
      code: 'INC-2569-008', title: 'น้ำท่วมภาคใต้ฝั่งทะเลอ่าวไทย', type: 'flood', severity: 'medium', status: 'monitoring',
      description: 'น้ำท่วมฉับพลันและน้ำท่วมขังจากฝนตกหนักฝั่งอ่าวไทย ปภ. ประกาศ 7 มาตรการเร่งด่วนดูแลพื้นที่ภาคใต้ (29 ก.ย. 69) เร่งอพยพ จัดถุงยังชีพ และซ่อมสาธารณูปโภค',
      locationName: 'ภาคใต้ฝั่งอ่าวไทย (สุราษฎร์ธานี นครศรีธรรมราช ชุมพร)', lat: 9.14, lng: 99.33,
      affectedPeople: 176000, injured: 11, deceased: 2, startDate: dt('2026-09-27T04:00:00+07:00'),
    },
  })
  const flood = await db.incident.create({
    data: {
      code: 'INC-2569-001', title: 'น้ำท่วมพื้นที่ลุ่มแม่น้ำปิง', type: 'flood', severity: 'critical', status: 'active',
      description: 'น้ำท่วมฉับพลันจากฝนตกหนักต่อเนื่อง ระดับน้ำในแม่น้ำปิงเกินระดับวิกฤต ส่งผลกระทบต่อประชาชนใน 4 อำเภอ (ส่วนหนึ่งของอุทกภัยรอบด้านทั่วประเทศ)',
      locationId: chiangmai.id, locationName: 'อ.เมืองเชียงใหม่, อ.สันทราย จ.เชียงใหม่', lat: 18.7904, lng: 98.9847,
      affectedPeople: 12480, injured: 37, deceased: 2, startDate: dt('2026-09-30T07:00:00+07:00'),
    },
  })
  const landslide = await db.incident.create({
    data: {
      code: 'INC-2569-002', title: 'ดินโคลนถล่มบนถนนสายภูคา', type: 'landslide', severity: 'high', status: 'monitoring',
      description: 'ดินโคลนถล่มบนถนนทางขึ้นดอย ปิดการจราจรชั่วคราว กำลังเฝ้าระวังฝนตกเพิ่มเติม',
      locationId: nan.id, locationName: 'อ.เวียงสา จ.น่าน', lat: 18.9333, lng: 100.7167,
      affectedPeople: 850, injured: 5, deceased: 0, startDate: dt('2026-10-03T06:00:00+07:00'),
    },
  })
  const fire = await db.incident.create({
    data: {
      code: 'INC-2569-003', title: 'ไฟป่าลามบริเวณเขาหลวง', type: 'fire', severity: 'medium', status: 'resolved',
      description: 'ไฟป่าควบคุมได้แล้วในพื้นที่ 85% กำลังค้นหาจุดค้างไฟ',
      locationId: lampang.id, locationName: 'อ.ห้างฉัตร จ.ลำปาง', lat: 18.3667, lng: 99.5333,
      affectedPeople: 120, injured: 2, deceased: 0, startDate: dt('2026-09-24T05:00:00+07:00'), endDate: dt('2026-10-04T18:00:00+07:00'),
    },
  })
  const storm = await db.incident.create({
    data: {
      code: 'INC-2569-004', title: 'พายุฝนฟ้าคะนองหนัก', type: 'storm', severity: 'low', status: 'closed',
      description: 'พายุฝนฟ้าคะนองผ่านพื้นที่ ทำเสียหายบ้านเรือน 24 หลัง ซ่อมแซมแล้วเสร็จ',
      locationId: lampang.id, locationName: 'จ.ลำปาง', lat: 18.2926, lng: 99.4927,
      affectedPeople: 96, injured: 0, deceased: 0, startDate: dt('2026-09-16T09:00:00+07:00'), endDate: dt('2026-09-21T20:00:00+07:00'),
    },
  })

  // ===== Incident Reports (sitreps) — ไทม์ไลน์จริง ก.ย.–ต.ค. 69 =====
  await db.incidentReport.createMany({
    data: [
      { incidentId: nationwide.id, title: 'SITREP #1 — เริ่มต้นอุทกภัย (18 ก.ย. 69)', content: 'ฝนตกหนักจากร่องมรสุมพาดผ่าน น้ำท่วมแล้ว 12 จังหวัด อีก 70 จังหวัดอยู่ในเขตเฝ้าระวังถึง 27 ก.ย. 69 เส้นทางชำรุด 8 จุด สายด่วน ปภ. 1784 กู้ชีพ 1669 เปิดรับแจ้งเหตุตลอด 24 ชม.', status: 'published', author: 'ศูนย์ปฏิบัติการช่วยเหลือประชาชนฯ (EOC ปภ.)', createdAt: dt('2026-09-18T17:30:00+07:00') },
      { incidentId: bkflood.id, title: 'SITREP #2 — ประกาศภาวะฉุกเฉิน กทม. (26 ก.ย. 69)', content: '26 ก.ย. 69 เวลา 10:16 น. ประกาศภาวะฉุกเฉินน้ำท่วมหลังฝนตกต่อเนื่อง 48 ชม. บางพื้นที่ปริมาณฝนเกิน 300 มม. จุดน้ำท่วมบนถนนหลัก 37 จุด ประกาศทั้ง 50 เขตเป็นพื้นที่ประสบภัยพิบัติ กทม. ประเมินใช้เวลาระบายน้ำ 2–3 วันหลังฝนหยุด พบผู้เสียชีวิตในเขตบึงกุ่ม (ไฟดูด 1 ราย จมน้ำ 2 ราย) ที่จอดรถและซอยยาวยังเป็นจุดเสี่ยง', status: 'published', author: 'สำนักการระบายน้ำ กทม.', createdAt: dt('2026-09-26T14:00:00+07:00') },
      { incidentId: nationwide.id, title: 'SITREP #3 — ผู้ประสบภัย 1.8 ล้านคน (28 ก.ย. 69)', content: 'น้ำท่วมลามถึง 42 จังหวัดตั้งแต่ 16 ก.ย. 69 เสียชีวิต 8 ราย ผู้ประสบภัยกว่า 1.8 ล้านคน ครม. ประกาศวันหยุดพิเศษกรุงเทพมหานคร 28–29 ก.ย. เพื่อความปลอดภัยและงดเดินทาง ย้ำมาตรการเยียวยา 9,000 บาท/ครัวเรือน ตามมติ ครม. 2 ก.ย. 69', status: 'published', author: 'กรมป้องกันและบรรเทาสาธารณภัย', createdAt: dt('2026-09-28T18:00:00+07:00') },
      { incidentId: bkflood.id, title: 'SITREP #4 — สนามบินสุวรรณภูมิกระเป๋าตกค้าง (29 ก.ย. 69)', content: 'เที่ยวบินถูกยกเลิกกว่า 10 เที่ยว กระเป๋าเดินทางตกค้างหลายร้อยใบที่ท่าอากาศยานสุวรรณภูมิ กองทัพอากาศส่งกำลังพลมาช่วยเคลียร์ ผู้ประสบภัยใน กทม. กว่า 700,000 คน ย่านบางกะปิหนักสุด พ่อค้าแม่ค้าเปิดตลาดชั่วคราวบนทางเดินลอยฟ้าหน้าศูนย์การค้า แม้น้ำยังสูงเข่า', status: 'published', author: 'EOC กรุงเทพมหานคร', createdAt: dt('2026-09-29T16:00:00+07:00') },
      { incidentId: nationwide.id, title: 'SITREP #5 — ครม. อนุมัติ 4,100 ล้านบาท (29 ก.ย. 69)', content: 'รัฐบาลอนุมัติเงินช่วยเหลือฉุกเฉิน 4,100 ล้านบาท (≈122 ล้านดอลลาร์) กระทรวงมหาดไทยรับจ่ายเยียวยาทั่วประเทศ ผู้ประสบภัยกว่า 2.6 ล้านคน เสียชีวิต 19 ราย มีผู้ได้รับผลกระทบต่อเนื่องใน 29 จังหวัด ปภ. ประกาศมาตรการเร่งด่วน 14 ข้อ ด้านการอพยพและการช่วยเหลือ', status: 'published', author: 'กรมป้องกันและบรรเทาสาธารณภัย', createdAt: dt('2026-09-29T20:30:00+07:00') },
      { incidentId: bkflood.id, title: 'SITREP #6 — น้ำเริ่มลด (30 ก.ย. 69)', content: 'พายุดีเปรสชันอ่อนกำลังลงเป็นหย่อมความกดอากาศต่ำคลุมเมียนมา ฝนหยุดเป็นส่วนใหญ่ น้ำลดเร็วขึ้น จุดที่ยังจมหนักคือฝั่งตะวันออกของ กทม. ผู้ว่าฯ ชัชชาติ คาดเมื่อวานนี้รถวิ่งบนถนนหลักได้ภายใน 2 วัน ซอยลึก/พื้นที่ต่ำใช้เวลาถึง 7 วัน เริ่มงานทำความสะอาดและประเมินความเสียหาย', status: 'published', author: 'สำนักการระบายน้ำ กทม.', createdAt: dt('2026-09-30T15:00:00+07:00') },
      { incidentId: nationwide.id, title: 'SITREP #7 — เปิดลงทะเบียนเยียวยา (1 ต.ค. 69)', content: 'เปิดลงทะเบียนขอรับเงินเยียวยาน้ำท่วมผ่านแอปพลิเคชันและเว็บไซต์ ครอบคลุม 65 จังหวัดและกรุงเทพมหานคร 50 เขต สำหรับบ้านที่ถูกน้ำท่วมช่วง 15 พ.ค.–30 ก.ย. 69 ตามประกาศ ปภ. บ้านที่น้ำท่วมไม่เกิน 7 วันรับ 9,000 บาท/ครัวเรือน', status: 'published', author: 'กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม', createdAt: dt('2026-10-01T10:00:00+07:00') },
      { incidentId: nationwide.id, title: 'SITREP #8 — เสียชีวิต 31 ราย (5 ต.ค. 69)', content: 'กระทรวงมหาดไทยรายงานเสียชีวิต 31 รายใน 8 จังหวัด (กรุงเทพฯ 4 ราย) กรมอุตุนิยมวิทยาเตือนฝนตกหนักอีกระลอก สถานการณ์น้ำ: เขื่อนภูมิพลระบาย 35 ลบ.ม./วิ เขื่อนสิริกิติ์ 93 ลบ.ม./วิ (รายงาน 29 ก.ย.) ประชาชนลงทะเบียนขอเยียวยาแล้วกว่า 1 ล้านครัวเรือน', status: 'published', author: 'กระทรวงมหาดไทย', createdAt: dt('2026-10-05T12:00:00+07:00') },
      { incidentId: nationwide.id, title: 'SITREP #9 — สรุปสถานการณ์ปัจจุบัน (6 ต.ค. 69)', content: 'เสียชีวิตรวม 40 รายทั่วประเทศ ความเสียหายรวมเกิน 11,000 ล้านบาท (ประเมินทางการ 5 วันน้ำท่วม กทม.+26 จังหวัด ≈ 12,300 ล้านบาท) กรุงเทพฯ ส่วนใหญ่แห้งแล้ว เหลือซอยลึกบางจุดระหว่างฟื้นฟู กรมชลประทานยืนยันเขื่อนภูมิพล–สิริกิติ์–แควน้อย ยังรับน้ำได้มาก น้ำระบายไม่ท่วมภาคกลาง ประเทศเพื่อนบ้าน (เมียนมา กัมพูชา) ก็ได้รับผลกระทบจากพายุระลอกเดียวกัน', status: 'published', author: 'ศูนย์ปฏิบัติการช่วยเหลือประชาชนฯ (EOC ปภ.)', createdAt: dt('2026-10-06T08:30:00+07:00') },
      { incidentId: bkflood.id, title: '(ร่าง) แผนฟื้นฟูหลังน้ำลด — กรุงเทพมหานคร', content: '(ร่าง) แผนฟื้นฟู 3 เฟส: ① ระบายน้ำซอยลึก/พื้นที่ต่ำ (ลาดพร้าว บึงกุ่ม บางกะปิ) ② ทำความสะอาด–ฆ่าเชื้อโรงเรียน วัด ตลาด ③ เยียวยา 9,000 บาท/ครัวเรือน + ฟื้นฟูอาชีพและประกันความเสียหาย', status: 'draft', author: 'สำนักการระบายน้ำ กทม.', createdAt: dt('2026-10-05T09:00:00+07:00') },
      // รายงานเดิม (ภาคเหนือ)
      { incidentId: flood.id, title: 'SITREP #5 — น้ำท่วมลุ่มแม่น้ำปิง', content: 'สถานการณ์น้ำท่วมวันนี้: ระดับน้ำในแม่น้ำปิงลดลง 15 ซม. ผู้ประสบภัย 12,480 คน อยู่ศูนย์พักพิง 4 แห่ง จำนวน 3,240 คน ขอเครื่องผลิตน้ำดื่มเพิ่ม 2 หน่วย', status: 'published', author: 'ศูนย์ปฏิบัติการช่วยเหลือ (EOC) จ.เชียงใหม่' },
      { incidentId: flood.id, title: 'SITREP #4 — ความเสียหายเบื้องต้น', content: 'ประเมินความเสียหายเบื้องต้น: บ้านเรือนพังยับ 412 หลัง ถนนชำรุด 6 จุด เกษตรกรรมเสียหาย 1,850 ไร่', status: 'published', author: 'หน่วยประเมินความเสียหาย' },
      { incidentId: landslide.id, title: 'SITREP #2 — ดินโคลนถล่มภูคา', content: 'เปิดถนนช่องทางสำรองแล้ว ทีมกู้ภัยค้นหาเหลืออีก 1 จุด เฝ้าระวังฝน 24 ชม.', status: 'published', author: 'ทีมกู้ภัยภูคา' },
      { incidentId: fire.id, title: 'รายงานสรุปไฟป่าเขาหลวง', content: 'ควบคุมไฟได้ 100% เมื่อวันที่ 4 ต.ค. ไม่มีการลุกลามเพิ่มเติม ปิดภารกิจ', status: 'published', author: 'หน่วยดับไฟป่า' },
    ],
  })

  // ===== Organizations (org) =====
  const or1 = await db.organization.create({ data: { name: 'กรมป้องกันและบรรเทาสาธารณภัย', type: 'government', sector: 'search_rescue', contactPerson: 'นายสมชาย วิไลวรรธน์', phone: '02-241-1111', email: 'contact@ddpm.go.th', address: 'ถนนอังรีดุนังต์ กรุงเทพฯ', description: 'หน่วยงานหลักด้านป้องกันและบรรเทาสาธารณภัย (ปภ.) — ผู้ประสาน EOC ทั่วประเทศ ประกาศมาตรการเร่งด่วน 14 ข้อ ในเหตุการณ์อุทกภัย ก.ย.–ต.ค. 69' } })
  const or2 = await db.organization.create({ data: { name: 'สภากาชาดไทย', type: 'ngo', sector: 'health', contactPerson: 'นางสาวปิยะดา จรัสแสง', phone: '02-251-7890', email: 'info@redcross.or.th', address: 'ถนนเฮนรีดุนังต์ กรุงเทพฯ', description: 'ให้ความช่วยเหลือด้านการแพทย์และมนุษยธรรม' } })
  const or3 = await db.organization.create({ data: { name: 'กาชาดนานาชาติ (IFRC)', type: 'international', sector: 'food', contactPerson: 'Mr. James Carter', phone: '+60-3-2161-1111', email: 'asia.pacific@ifrc.org', address: 'Kuala Lumpur, Malaysia', description: 'สหพันธ์กาชาดและเสี้ยววงษ์เดือนนานาชาติ' } })
  const or4 = await db.organization.create({ data: { name: 'มูลนิธิร่วมกตัญญู', type: 'ngo', sector: 'logistics', contactPerson: 'นายธนกร ศรีสุข', phone: '02-938-5555', email: 'help@ruamkatanyu.org', address: 'กรุงเทพฯ', description: 'หน่วยกู้ภัยและบรรเทาทุพภิกขภัย' } })
  const or5 = await db.organization.create({ data: { name: 'บริษัท ไทยน้ำใส จำกัด', type: 'private', sector: 'water', contactPerson: 'นางสาวมนัสนันท์ กุลชาติ', phone: '02-555-1999', email: 'csr@thaiwater.co.th', address: 'ปทุมธานี', description: 'ผู้สนับสนุนน้ำดื่มและโลจิสติกส์' } })
  const or6 = await db.organization.create({ data: { name: 'ชุมชนริมปิงรวมใจ', type: 'community', sector: 'other', contactPerson: 'นายวิชัย ใจดี', phone: '053-999-111', address: 'ต.ช้างเผือก จ.เชียงใหม่', status: 'active', description: 'เครือข่ายอาสาสมัครชุมชน 8 หมู่บ้าน' } })
  const or7 = await db.organization.create({ data: { name: 'สำนักการระบายน้ำ กรุงเทพมหานคร', type: 'government', sector: 'water', contactPerson: 'นายธนากร รุ่งโรจน์', phone: '02-248-5000', email: 'drainage@bma.go.th', address: 'ถ.ศรีอยุธยา เขตดุสิต กรุงเทพฯ', description: 'หน่วยงานระบายน้ำ/ปั๊มน้ำของ กทม. ผู้ประกาศภาวะฉุกเฉินน้ำท่วม 26 ก.ย. 69 และผู้นำการฟื้นฟูหลังน้ำลด' } })
  const or8 = await db.organization.create({ data: { name: 'กรมชลประทาน', type: 'government', sector: 'water', contactPerson: 'นางสาวจิราพร น้ำใส', phone: '02-211-0111', email: 'info@rid.go.th', address: 'ถ.สีหบุรษฎี เขตดุสิต กรุงเทพฯ', description: 'บริหารเขื่อนภูมิพล–สิริกิติ์–แควน้อย ติดตามน้ำเหนือลุ่มเจ้าพระยา ยืนยันน้ำระบายไม่ท่วมภาคกลาง (6 ต.ค. 69)' } })
  const or9 = await db.organization.create({ data: { name: 'กองทัพอากาศไทย', type: 'government', sector: 'search_rescue', contactPerson: 'นายชัยพร อินทรวงศ์', phone: '02-170-1111', email: 'info@rtaf.af.mil.th', address: 'ถ.พหลโยธิน กรุงเทพฯ', description: 'ส่งกำลังพลช่วยเคลียร์กระเป๋าเดินทางตกค้างที่ท่าอากาศยานสุวรรณภูมิ และหน่วยช่วยเหลือภาคสนาม' } })

  // ===== Human Resources (hrm) =====
  await db.humanResource.createMany({
    data: [
      { name: 'นพ.อนันต์ ศรีวิไล', type: 'staff', jobTitle: 'ผู้อำนวยการแพทย์ภาคสนาม', organizationId: or2.id, phone: '081-234-5678', email: 'anan.s@redcross.or.th', skills: 'แพทย์ฉุกเฉิน,ปฐมพยาบาล', status: 'on_mission', baseLocation: 'ศูนย์พักพิงโรงเรียนวัดเกตุ' },
      { name: 'นางสาวกมลวรรณ ทองสุข', type: 'staff', jobTitle: 'ผู้ประสานงานอาสาสมัคร', organizationId: or1.id, phone: '089-876-5432', email: 'kamonwan@ddpm.go.th', skills: 'ประสานงาน,จัดการค่าย', status: 'assigned', baseLocation: 'EOC เชียงใหม่' },
      { name: 'นายประเสริฐ ชัยมงคล', type: 'volunteer', jobTitle: 'อาสาสมัครกู้ภัย', organizationId: or4.id, phone: '086-111-2233', skills: 'กู้ภัยน้ำ,ดำน้ำ,เรือ', status: 'on_mission', baseLocation: 'ท่าเรือวัดเกตุ' },
      { name: 'นางสาวสุนิสา แก้วใส', type: 'volunteer', jobTitle: 'อาสาสมัครครัวกลาง', organizationId: or3.id, phone: '095-333-4455', skills: 'ทำอาหาร,จัดแจก', status: 'available', baseLocation: 'ศูนย์พักพิง รร.ยุพราช' },
      { name: 'นายเกรียงไกร พรหมดี', type: 'volunteer', jobTitle: 'อาสาสมัครขนส่ง', organizationId: or5.id, phone: '098-555-6677', skills: 'ขับรถบรรทุก,โลจิสติกส์', status: 'available', baseLocation: 'คลังกลางไทยน้ำใส' },
      { name: 'นายอธิป เวชชาชีวะ', type: 'trainee', jobTitle: 'ผู้ฝึกอบรม EMT', organizationId: or2.id, phone: '082-999-8877', skills: 'EMT(กำลังฝึก)', status: 'unavailable', baseLocation: 'ศูนย์ฝึกกาชาด' },
      { name: 'นางพิมพ์ชนก วงศ์สุวรรณ', type: 'staff', jobTitle: 'พยาบาลวิชาชีพ', organizationId: or2.id, phone: '083-222-3344', skills: 'พยาบาล,ดูแลเด็ก', status: 'on_mission', baseLocation: 'ศูนย์พักพิง รร.ยุพราช' },
      { name: 'นายสมศักดิ์ เข็มทอง', type: 'volunteer', jobTitle: 'อาสาสมัครประชาสัมพันธ์', organizationId: or1.id, phone: '084-666-7788', skills: 'ประชาสัมพันธ์,ล่าม', status: 'available', baseLocation: 'EOC เชียงใหม่' },
      // กำลังพลช่วยเหลือน้ำท่วม กทม. (ก.ย.–ต.ค. 69)
      { name: 'นายธนากร รุ่งโรจน์', type: 'staff', jobTitle: 'วิศวกรระบายน้ำ กทม.', organizationId: or7.id, phone: '081-700-1001', email: 'thanakorn.r@bma.go.th', skills: 'ระบายน้ำ,ปั๊มน้ำ,วิศวกรรม', status: 'on_mission', baseLocation: 'จุดปั๊มน้ำคลองแสนสุข เขตบางกะปิ' },
      { name: 'นายชัยพร อินทรวงศ์', type: 'staff', jobTitle: 'เจ้าหน้าที่โลจิสติกส์ ทบ.อากาศ', organizationId: or9.id, phone: '081-700-1002', email: 'chaiporn.i@rtaf.mi.th', skills: 'โลจิสติกส์,ขนส่งอากาศยาน', status: 'on_mission', baseLocation: 'ท่าอากาศยานสุวรรณภูมิ (จุดกระจายกระเป๋าเดินทาง)' },
      { name: 'นางสาวจิราพร น้ำใส', type: 'staff', jobTitle: 'นักวิชาการน้ำ กรมชลประทาน', organizationId: or8.id, phone: '081-700-1003', email: 'jiraporn.n@rid.go.th', skills: 'วิเคราะห์น้ำ,พยากรณ์น้ำท่า', status: 'assigned', baseLocation: 'สถานีติดตามน้ำท่าพระจันทร์' },
      { name: 'นายวุฒิชัย ช่วยชาติ', type: 'volunteer', jobTitle: 'อาสาสมัครปั๊มน้ำ/กู้ภัย', organizationId: or1.id, phone: '081-700-1004', skills: 'ปั๊มน้ำ,กู้ภัยน้ำ,ปฐมพยาบาล', status: 'on_mission', baseLocation: 'EOC ปภ. กรุงเทพฯ' },
    ],
  })

  // ===== Shelters =====
  const sh1 = await db.shelter.create({ data: { name: 'ศูนย์พักพิงโรงเรียนยุพราชวิทยาลัย', type: 'school', address: 'ถ.ดำรงค์มหาราช อ.เมือง จ.เชียงใหม่', capacity: 1200, currentOccupancy: 964, contactPerson: 'ผอ.วิชัย อินทร์สวัสดิ์', phone: '053-241-001', status: 'full', facilities: 'water,electricity,medical,food,toilet', lat: 18.7935, lng: 98.9725, locationId: chiangmai.id } })
  const sh2 = await db.shelter.create({ data: { name: 'ศูนย์พักพิงวัดเกตุการาม', type: 'temple', address: 'ถ.เจริญประเทศ อ.เมือง จ.เชียงใหม่', capacity: 800, currentOccupancy: 612, contactPerson: 'พระครูปัญญาภิวัฒน์', phone: '053-281-234', status: 'open', facilities: 'water,electricity,food,toilet', lat: 18.7999, lng: 98.9944, locationId: chiangmai.id } })
  const sh3 = await db.shelter.create({ data: { name: 'ศูนย์พักพิงศูนย์ราชการสันทราย', type: 'community_center', address: 'อ.สันทราย จ.เชียงใหม่', capacity: 500, currentOccupancy: 380, contactPerson: 'นางสาวอารีย์ ปัญญาดี', phone: '053-880-555', status: 'open', facilities: 'water,electricity,medical,food', lat: 18.8772, lng: 99.0089, locationId: chiangmai.id } })
  const sh4 = await db.shelter.create({ data: { name: 'ศูนย์พักพิงชั่วคราวเวียงสา', type: 'tent', address: 'อ.เวียงสา จ.น่าน', capacity: 300, currentOccupancy: 145, contactPerson: 'นายทศพล มีสุข', phone: '054-710-111', status: 'open', facilities: 'water,toilet', lat: 18.9333, lng: 100.7167, locationId: nan.id } })
  const sh5 = await db.shelter.create({ data: { name: 'ศูนย์พักพิงโรงเรียนห้างฉัตร', type: 'school', address: 'อ.ห้างฉัตร จ.ลำปาง', capacity: 400, currentOccupancy: 0, contactPerson: 'ผอ.สมพงษ์ แก้วมณี', phone: '054-221-333', status: 'closed', facilities: 'water,electricity,food,toilet', lat: 18.3667, lng: 99.5333, locationId: lampang.id } })
  // ศูนย์พักพิงเหตุการณ์น้ำท่วม กทม. + ลุ่มเจ้าพระยา (ก.ย.–ต.ค. 69)
  const shB1 = await db.shelter.create({ data: { name: 'ศูนย์พักพิงโรงเรียนบางกะปิ', type: 'school', address: 'เขตบางกะปิ กรุงเทพมหานคร', capacity: 1500, currentOccupancy: 1120, contactPerson: 'ผอ.อาทิตย์ วัฒนเกียรติ', phone: '02-319-1001', status: 'full', facilities: 'water,electricity,medical,food,toilet', lat: 13.7449, lng: 100.6640, locationId: bangkok.id } })
  const shB2 = await db.shelter.create({ data: { name: 'ศูนย์พักพิงวัดบึงกุ่ม', type: 'temple', address: 'เขตบึงกุ่ม กรุงเทพมหานคร', capacity: 600, currentOccupancy: 430, contactPerson: 'พระครูสังฆรักษ์เมตตา', phone: '02-518-1002', status: 'open', facilities: 'water,electricity,food,toilet', lat: 13.7652, lng: 100.7031, locationId: bangkok.id } })
  const shB3 = await db.shelter.create({ data: { name: 'ศูนย์พักพิงสนามกีฬาเขตลาดสี', type: 'stadium', address: 'เขตลาดสี กรุงเทพมหานคร', capacity: 900, currentOccupancy: 640, contactPerson: 'นางสาวณัฐพร ศรีเทวา', phone: '02-598-1003', status: 'open', facilities: 'water,electricity,medical,food,toilet', lat: 13.8848, lng: 100.6155, locationId: bangkok.id } })
  const shB4 = await db.shelter.create({ data: { name: 'ศูนย์พักพิงศูนย์ราชการเฉลิมพระเกียรติ 80 พรรษา (ปากเกร็ด)', type: 'community_center', address: 'อ.ปากเกร็ด จ.นนทบุรี', capacity: 2000, currentOccupancy: 1350, contactPerson: 'นายสุวัฒน์ นิ่มทอง', phone: '02-503-1004', status: 'full', facilities: 'water,electricity,medical,food,toilet', lat: 13.9071, lng: 100.5063, locationId: nont.id } })
  const shB5 = await db.shelter.create({ data: { name: 'ศูนย์พักพิงโรงเรียนอยุธยา', type: 'school', address: 'พระนครศรีอยุธยา', capacity: 800, currentOccupancy: 320, contactPerson: 'ผอ.พงษ์เทพ สารสุวรรณ', phone: '035-241-005', status: 'open', facilities: 'water,electricity,food,toilet', lat: 14.3532, lng: 100.5776, locationId: ayut.id } })
  const shB6 = await db.shelter.create({ data: { name: 'ศูนย์พักพิงชั่วคราวหน้าศาลากลางปทุมธานี', type: 'tent', address: 'จ.ปทุมธานี', capacity: 400, currentOccupancy: 210, contactPerson: 'นายอดิศร บุญมี', phone: '02-977-1006', status: 'open', facilities: 'water,toilet,food', lat: 14.0127, lng: 100.5312, locationId: pathum.id } })

  // ===== Persons (pr) =====
  const personSeed: any[] = [
    // ผู้ประสบภัยเหตุการณ์น้ำท่วม กทม. (ก.ย.–ต.ค. 69)
    { firstName: 'ประนอม', lastName: 'สุขสันต์', gender: 'female', age: 58, status: 'deceased', incidentId: bkflood.id, lastSeenLocation: 'ที่จอดรถหมู่บ้าน แขวงคลองจันทร์ เขตบึงกุ่ม', lastSeenAt: dt('2026-09-26T20:30:00+07:00'), notes: 'เสียชีวิตจากไฟดูดในที่จอดรถที่ถูกน้ำท่วม' },
    { firstName: 'วิเชียร', lastName: 'พัฒนกิจ', gender: 'male', age: 73, status: 'deceased', incidentId: bkflood.id, lastSeenLocation: 'แขวงบึงกุ่ม เขตบึงกุ่ม', lastSeenAt: dt('2026-09-27T09:00:00+07:00'), notes: 'จมน้ำหลังลื่นล้นขณะยกของออกจากบ้าน' },
    { firstName: 'หม่อมเจ้าทวี', lastName: 'กมลวณิช', gender: 'male', age: 78, status: 'deceased', incidentId: bkflood.id, lastSeenLocation: 'บ้านพักผู้สูงอายุ เขตบึงกุ่ม', lastSeenAt: dt('2026-09-27T07:00:00+07:00'), notes: 'ผู้ป่วยติดเตียง จมน้ำก่อนทีมอพยพจะเข้าถึง' },
    { firstName: 'กัญญาณัฐ', lastName: 'ช่องแคบ', gender: 'female', age: 34, status: 'evacuated', incidentId: bkflood.id, shelterId: shB1.id, phone: '081-800-0001', address: 'แขวงบางกะปิ เขตบางกะปิ' },
    { firstName: 'อนันดา', lastName: 'ศรีสมบูรณ์', gender: 'male', age: 41, status: 'evacuated', incidentId: bkflood.id, shelterId: shB1.id, phone: '081-800-0002', address: 'ซอยลาดพร้าว 101 เขตบึงกุ่ม', notes: 'อพยพด้วยเรือยางในคืนวันที่ 26 ก.ย.' },
    { firstName: 'พรทิพย์', lastName: 'น้ำทิพย์', gender: 'female', age: 29, status: 'injured', incidentId: bkflood.id, notes: 'ไฟดูดบาดเจ็บขณะยืนในน้ำถือสายไฟต่อพ่วง ส่ง รพ.ลาดพร้าว' },
    { firstName: 'สมพงษ์', lastName: 'แสงไฟ', gender: 'male', age: 66, status: 'evacuated', incidentId: bkflood.id, shelterId: shB3.id, phone: '081-800-0003', notes: 'ผู้สูงอายุต้องการยาความดัน หน่วยแพทย์เคลื่อนที่ดูแล' },
    { firstName: 'จีรนันท์', lastName: 'ทองประเสริฐ', gender: 'male', age: 47, status: 'missing', incidentId: bkflood.id, lastSeenLocation: 'ซอยเสรีไทย ใกล้ตลาดน้ำบางกะปิ', lastSeenAt: dt('2026-09-26T22:00:00+07:00'), notes: 'ญาติแจ้งหายคืนวันน้ำท่วมหนัก ทีมกู้ภัยค้นหาอยู่' },
    { firstName: 'ศรีอาภา', lastName: 'บางขุนพรหม', gender: 'female', age: 52, status: 'evacuated', incidentId: cpflood.id, shelterId: shB4.id, phone: '081-800-0004', address: 'อ.ปากเกร็ด จ.นนทบุรี' },
    { firstName: 'มนตรี', lastName: 'ชายทุ่ง', gender: 'male', age: 60, status: 'evacuated', incidentId: cpflood.id, shelterId: shB5.id, address: 'ต.ท่าท่า จ.พระนครศรีอยุธยา', notes: 'นาข้าวถูกน้ำท่วม 30 ไร่' },
    { firstName: 'ลัดดาวัลย์', lastName: 'คลองสอง', gender: 'female', age: 38, status: 'safe', incidentId: cpflood.id, shelterId: shB6.id, phone: '081-800-0005' },
    { firstName: 'สุเนตร', lastName: 'อ่าวไทย', gender: 'female', age: 45, status: 'evacuated', incidentId: southflood.id, phone: '081-800-0006', address: 'จ.สุราษฎร์ธานี' },
    // ผู้ประสบภัยเดิม (ภาคเหนือ)
    { firstName: 'สมใจ', lastName: 'ใจดี', gender: 'female', age: 67, status: 'evacuated', incidentId: flood.id, shelterId: sh1.id, phone: '081-111-0001', address: 'ต.ช้างเผือก อ.เมือง จ.เชียงใหม่' },
    { firstName: 'ประยูร', lastName: 'มั่นคง', gender: 'male', age: 45, status: 'evacuated', incidentId: flood.id, shelterId: sh2.id, address: 'ต.แม่เหียะ อ.เมือง จ.เชียงใหม่' },
    { firstName: 'แก้ว', lastName: 'ปิ่นทอง', gender: 'female', age: 8, status: 'safe', incidentId: flood.id, shelterId: sh1.id, address: 'ต.สันทราย จ.เชียงใหม่' },
    { firstName: 'วิชัย', lastName: 'ทรงเกษตร', gender: 'male', age: 34, status: 'injured', incidentId: flood.id, shelterId: sh3.id, notes: 'บาดเจ็บขาหัก ส่งโรงพยาบาลมหาราชเชียงใหม่' },
    { firstName: 'มาลี', lastName: 'ดอกรัก', gender: 'female', age: 52, status: 'missing', incidentId: flood.id, lastSeenLocation: 'ตลาดวโรรส อ.เมือง จ.เชียงใหม่', lastSeenAt: dt('2026-10-02T11:00:00+07:00'), phone: '081-222-3344', notes: 'ญาติติดต่อมาที่ EOC' },
    { firstName: 'ธนวัฒน์', lastName: 'ศรีสุวรรณ', gender: 'male', age: 28, status: 'missing', incidentId: landslide.id, lastSeenLocation: 'ถนนสายภูคา อ.เวียงสา จ.น่าน', lastSeenAt: dt('2026-10-03T09:00:00+07:00'), notes: 'คนงานก่อสร้างบนดอย' },
    { firstName: 'สุดา', lastName: 'แสงจันทร์', gender: 'female', age: 61, status: 'found', incidentId: flood.id, shelterId: sh2.id, notes: 'พบตัวแล้วที่บ้านญาติ ย้ายมาศูนย์พักพิง' },
    { firstName: 'อนุชา', lastName: 'รุ่งเรือง', gender: 'male', age: 39, status: 'evacuated', incidentId: flood.id, shelterId: sh3.id, phone: '089-444-5566' },
    { firstName: 'จันทร์เพ็ญ', lastName: 'สุขใจ', gender: 'female', age: 73, status: 'safe', incidentId: flood.id, shelterId: sh1.id, notes: 'ต้องการยาความดัน' },
    { firstName: 'เอกชัย', lastName: 'วงศ์คำ', gender: 'male', age: 22, status: 'safe', incidentId: landslide.id, shelterId: sh4.id },
    { firstName: 'บุษราคัม', lastName: 'พรหมมา', gender: 'female', age: 35, status: 'missing', incidentId: flood.id, lastSeenLocation: 'ร้านค้าบริเวณตลาดต้นลำเจียก', lastSeenAt: dt('2026-10-02T14:00:00+07:00') },
    { firstName: 'ชาติชาย', lastName: 'อินทรกำแหง', gender: 'male', age: 48, status: 'evacuated', incidentId: flood.id, shelterId: sh2.id, phone: '086-777-8899' },
  ]
  const createdPersons: { id: string; firstName: string; status: string }[] = []
  for (const p of personSeed) {
    const row = await db.person.create({ data: p })
    createdPersons.push({ id: row.id, firstName: row.firstName, status: row.status })
  }

  // ===== PersonContact + PersonEvent (P1: G3 — ช่องทางติดต่อ + presence trail) =====
  const P = (name: string) => createdPersons.find((x) => x.firstName === name)
  const kanyanat = P('กัญญาณัฐ')
  const jiranan = P('จีรนันท์')
  const malee = P('มาลี')
  const suda = P('สุดา')
  const pranom = P('ประนอม')

  await db.personContact.createMany({
    data: [
      ...(kanyanat ? [
        { personId: kanyanat.id, type: 'mobile', value: '081-800-0001', priority: 1, isEmergency: false },
        { personId: kanyanat.id, type: 'line', value: 'kanyanat.s', priority: 2, note: 'LINE ของตัวเอง' },
      ] : []),
      ...(jiranan ? [
        { personId: jiranan.id, type: 'mobile', value: '081-900-1122', priority: 1, isEmergency: true, note: 'เบอร์ของผู้สูญหาย' },
        { personId: jiranan.id, type: 'phone', value: '02-377-8899', priority: 2, note: 'ญาติ (น้องสาว) — นางจันทร์แก้ว' },
      ] : []),
      ...(malee ? [
        { personId: malee.id, type: 'mobile', value: '081-222-3344', priority: 1, isEmergency: true, note: 'เบอร์ล่าสุดที่ติดต่อได้' },
        { personId: malee.id, type: 'phone', value: '053-401-220', priority: 2, note: 'บ้านลูกสาว อ.สันทราย' },
      ] : []),
    ],
  })

  await db.personEvent.createMany({
    data: [
      // trail ผู้สูญหาย: มาลี
      ...(malee ? [
        { personId: malee.id, status: 'missing', location: 'ตลาดวโรรส อ.เมือง จ.เชียงใหม่', observer: 'ญาติ (ลูกสาว) แจ้งที่ EOC', occurredAt: dt('2026-10-02T13:00:00+07:00'), note: 'ญาติแจ้งหายหลังติดต่อไม่ได้ตั้งแต่เที่ยง', createdBy: 'นายสมศักดิ์ เข็มทอง' },
        { personId: malee.id, status: 'sighted', location: 'ปากซอยหมู่บ้าน ต.ช้างเผือก', observer: 'อาสาสมัคร วอล.เชียงใหม่', occurredAt: dt('2026-10-03T09:30:00+07:00'), note: 'มีคนพบเห็นผู้สูงอายุลักษณะคล้ายกันเดินหาทางแห้ง', createdBy: 'นายสมศักดิ์ เข็มทอง' },
      ] : []),
      // trail พบตัวแล้ว: สุดา
      ...(suda ? [
        { personId: suda.id, status: 'missing', location: 'บ้านต.แม่เหียะ', observer: 'ญาติแจ้ง', occurredAt: dt('2026-09-30T10:00:00+07:00'), createdBy: 'นายสมศักดิ์ เข็มทอง' },
        { personId: suda.id, status: 'found', location: 'บ้านญาติ อ.สันทราย', observer: 'ทีมค้นหา ปภ.เชียงใหม่', occurredAt: dt('2026-10-01T15:20:00+07:00'), note: 'พบที่บ้านญาติ สภาพปลอดภัย', createdBy: 'นายสมศักดิ์ เข็มทอง' },
        { personId: suda.id, status: 'evacuated', location: 'ศูนย์พักพิงวัดเกตุการาม', observer: 'เจ้าหน้าที่ศูนย์พักพิง', occurredAt: dt('2026-10-01T18:00:00+07:00'), note: 'ย้ายเข้าพักพิงพร้อมญาติ 2 คน', createdBy: 'นายสมศักดิ์ เข็มทอง' },
      ] : []),
      // trail เสียชีวิต: ประนอม
      ...(pranom ? [
        { personId: pranom.id, status: 'missing', location: 'ที่จอดรถหมู่บ้าน แขวงคลองจันทร์', observer: 'ครอบครัว', occurredAt: dt('2026-09-26T21:00:00+07:00'), createdBy: 'นายธนากร รุ่งโรจน์' },
        { personId: pranom.id, status: 'found', location: 'จุดเดียวกัน', observer: 'ทีมกู้ภัย', occurredAt: dt('2026-09-27T08:10:00+07:00'), note: 'พบไม่มีสติในรถยนต์ที่จอดในน้ำ', createdBy: 'นายธนากร รุ่งโรจน์' },
        { personId: pranom.id, status: 'deceased', location: 'โรงพยาบาลบึงกุ่ม', observer: 'แพทย์ รพ.บึงกุ่ม', occurredAt: dt('2026-09-27T09:40:00+07:00'), note: 'เสียชีวิตจากไฟดูด', createdBy: 'นายธนากร รุ่งโรจน์' },
      ] : []),
    ],
  })

  // ===== ShelterOccupancy (P1: G4 — ประวัติเข้า-ออกพักพิง) =====
  await db.shelterOccupancy.createMany({
    data: [
      { shelterId: sh1.id, delta: 700, count: 700, note: 'รับอพยพชุดแรกจาก ต.ช้างเผือก', createdBy: 'นายสมศักดิ์ เข็มทอง', createdAt: dt('2026-09-29T16:00:00+07:00') },
      { shelterId: sh1.id, delta: 200, count: 900, note: 'รถพุ่มเช้า 3 คันจาก ต.แม่เหียะ', createdBy: 'นายสมศักดิ์ เข็มทอง', createdAt: dt('2026-10-01T09:30:00+07:00') },
      { shelterId: sh1.id, delta: 100, count: 1000, note: 'รับโยกย้ายจากศูนย์พักพิงเวียงสาบางส่วน', createdBy: 'นางสาวกมลวรรณ ทองสุข', createdAt: dt('2026-10-02T14:00:00+07:00') },
      { shelterId: sh1.id, delta: -36, count: 964, note: 'กลับบ้านตามสถิติประจำวัน (น้ำลด)', createdBy: 'นายสมศักดิ์ เข็มทอง', createdAt: dt('2026-10-03T17:00:00+07:00') },
      { shelterId: shB1.id, delta: 600, count: 600, note: 'อพยพจาก แขวงบางกะปิ คืนวันน้ำท่วมหนัก', createdBy: 'นายธนากร รุ่งโรจน์', createdAt: dt('2026-09-26T23:30:00+07:00') },
      { shelterId: shB1.id, delta: 420, count: 1020, note: 'รับเพิ่มจากเขตบึงกุ่ม + หน่วยเรือยาง', createdBy: 'นายธนากร รุ่งโรจน์', createdAt: dt('2026-09-27T10:00:00+07:00') },
      { shelterId: shB1.id, delta: 100, count: 1120, note: 'ย้ายเข้าเพิ่ม 1 ครอบครัวขยาย (รวม 12 คน) + คืนที่พ้นกำหนด', createdBy: 'นายธนากร รุ่งโรจน์', createdAt: dt('2026-09-28T18:00:00+07:00') },
    ],
  })


  // ===== Warehouses + Inventory (แต่ละคลังมีหน่วยงานเจ้าของชัดเจน) =====
  const w1 = await db.warehouse.create({ data: { name: 'คลังสินค้ากลางจังหวัดเชียงใหม่', purpose: 'อาหารและน้ำดื่ม', address: 'อ.เมือง จ.เชียงใหม่', manager: 'นายอภิชาติ สินอุดม', phone: '053-300-100', capacity: 5000, organizationId: or3.id } })
  const w2 = await db.warehouse.create({ data: { name: 'คลังสินค้าภาคเหนือตอนบน', purpose: 'เวชภัณฑ์และสุขอนามัย', address: 'อ.สันทราย จ.เชียงใหม่', manager: 'นางสาววรรณา ดีปัญญา', phone: '053-880-200', capacity: 3000, organizationId: or2.id } })
  const w3 = await db.warehouse.create({ data: { name: 'คลังกระจายสินค้าน่าน', purpose: 'เครื่องมือ ที่พักพิง และเชื้อเพลิง', address: 'อ.เวียงสา จ.น่าน', manager: 'นายพีรพงษ์ จันทร์ดี', phone: '054-710-222', capacity: 1500, organizationId: or1.id } })
  const w4 = await db.warehouse.create({ data: { name: 'คลังบรรเทาทุกข์ ปภ. บางเขน', purpose: 'อุปกรณ์ระบายน้ำ เรือ และสิ่งบรรเทาทุกข์', address: 'ถ.พหลโยธิน เขตบางเขน กรุงเทพมหานคร', manager: 'นายวุฒิชัย ช่วยชาติ', phone: '02-551-0400', capacity: 4000, organizationId: or1.id } })
  await db.inventoryItem.createMany({
    data: [
      // คลัง ปภ. บางเขน (ภารกิจน้ำท่วม กทม. 69)
      { name: 'ถุงทรายกันน้ำ', category: 'tools', type: 'กระสอบ', size: '25 กก.', unit: 'ถุง', quantity: 5200, minQuantity: 2000, warehouseId: w4.id },
      { name: 'ปั๊มน้ำเคลื่อนที่', category: 'tools', type: 'ดีเซล', size: '6 นิ้ว', unit: 'เครื่อง', quantity: 68, minQuantity: 30, warehouseId: w4.id },
      { name: 'เรือยางเคลื่อนที่เร็ว', category: 'tools', type: 'มอเตอร์', size: '40 แรงม้า', unit: 'ลำ', quantity: 22, minQuantity: 10, warehouseId: w4.id },
      { name: 'เสื้อชูชีพ', category: 'relief', type: 'อย่างดี', size: '50 กก.', unit: 'ตัว', quantity: 1800, minQuantity: 800, warehouseId: w4.id },
      { name: 'ชุดยังชีพ', category: 'relief', type: 'ชุด', size: '4 คน/7 วัน', unit: 'ชุด', quantity: 1500, minQuantity: 600, warehouseId: w4.id },
      { name: 'ยาฆ่าเชื้อโรค', category: 'hygiene', type: 'น้ำยา', size: '5 ลิตร', unit: 'แกลลอน', quantity: 320, minQuantity: 150, warehouseId: w4.id, expiryDate: new Date('2027-06-30') },
      { name: 'น้ำดื่มบรรจุขวด', category: 'water', type: 'ขวด', size: '1,500ml', unit: 'ลัง', quantity: 900, minQuantity: 300, warehouseId: w4.id, expiryDate: new Date('2027-08-15') },
      { name: 'รองเท้าบูทยาง', category: 'clothing', type: 'บูท', size: '41–45', unit: 'คู่', quantity: 240, minQuantity: 100, warehouseId: w4.id },
      // คลังภาคเหนือ (เดิม)
      { name: 'น้ำดื่มบรรจุขวด', category: 'water', type: 'ขวด', size: '600ml', unit: 'ลัง', quantity: 850, minQuantity: 200, warehouseId: w1.id, expiryDate: new Date('2027-10-01') },
      { name: 'ถุงข้าวสาร', category: 'food', type: 'ถุง', size: '5 กก.', unit: 'ถุง', quantity: 1240, minQuantity: 300, warehouseId: w1.id },
      { name: 'บะหมี่กึ่งสำเร็จรูป', category: 'food', type: 'ซอง', size: '60 กรัม', unit: 'ลัง', quantity: 430, minQuantity: 150, warehouseId: w1.id, expiryDate: new Date('2026-12-31') },
      { name: 'ชุดยาปฐมพยาบาล', category: 'medical', type: 'ชุด', size: 'มาตรฐาน กฟผ.', unit: 'ชุด', quantity: 96, minQuantity: 100, warehouseId: w2.id, expiryDate: new Date('2026-11-30') },
      { name: 'ยาแก้ท้องร่วง', category: 'medical', type: 'แคปซูล', size: '2mg', unit: 'แผง', quantity: 500, minQuantity: 200, warehouseId: w2.id, expiryDate: new Date('2026-09-30') },
      { name: 'ผ้าห่มกันหนาว', category: 'clothing', type: 'ขนสังเคราะห์', size: '150×200 ซม.', unit: 'ผืน', quantity: 640, minQuantity: 250, warehouseId: w2.id },
      { name: 'เต็นท์พักพิง', category: 'shelter', type: 'เอ-ไลน์', size: '6 คน', unit: 'หลัง', quantity: 45, minQuantity: 50, warehouseId: w3.id },
      { name: 'เรือกู้ภัย', category: 'tools', type: 'ยางเป่าลม', size: '8 ที่นั่ง', unit: 'ลำ', quantity: 12, minQuantity: 5, warehouseId: w1.id },
      { name: 'ชุดสุขอนามัย', category: 'hygiene', type: 'ชุด', size: '4 คน/7 วัน', unit: 'ชุด', quantity: 720, minQuantity: 300, warehouseId: w2.id },
      { name: 'ไฟฉายพร้อมถ่าน', category: 'tools', type: 'แบตเตอรี่ D', size: '2 ดวง', unit: 'ชุด', quantity: 210, minQuantity: 100, warehouseId: w3.id },
      { name: 'แก๊ส LPG บรรจุกระบอก', category: 'fuel', type: 'แก๊ส', size: '15 กก.', unit: 'กระบอก', quantity: 88, minQuantity: 40, warehouseId: w3.id },
      { name: 'น้ำมันเบนซิน 91', category: 'fuel', type: 'ถังพร้อมปั๊มมือ', size: '20 ลิตร', unit: 'ถัง', quantity: 36, minQuantity: 20, warehouseId: w3.id },
      { name: 'ชุดบรรเทาทุกข์', category: 'relief', type: 'ชุด', size: '5 คน/3 วัน', unit: 'ชุด', quantity: 260, minQuantity: 120, warehouseId: w1.id },
      { name: 'จอบ เสียม เลื่อย', category: 'tools', type: 'ชุดพกพา', size: '3 ชิ้น/ชุด', unit: 'ชุด', quantity: 130, minQuantity: 60, warehouseId: w3.id },
    ],
  })

  // ===== StockMovement (P1: G4 — ledger รับ/จ่าย/โอน/ปรับ ตัวอย่าง) =====
  const items = await db.inventoryItem.findMany({ orderBy: { createdAt: 'asc' } })
  const I = (name: string, wid: string) => items.find((x) => x.name === name && x.warehouseId === wid)
  const sandbag = I('ถุงทรายกันน้ำ', w4.id)
  const waterBkk = I('น้ำดื่มบรรจุขวด', w4.id)
  const rice = I('ถุงข้าวสาร', w1.id)
  const medkit = I('ชุดยาปฐมพยาบาล', w2.id)
  const tent = I('เต็นท์พักพิง', w3.id)
  await db.stockMovement.createMany({
    data: [
      ...(sandbag ? [
        { itemId: sandbag.id, type: 'receive', quantity: 3000, fromWarehouseId: null, toWarehouseId: w4.id, reference: 'ใบส่งของ ปภ. 2568/0912', note: 'รับจากโรงงานส่งกลาง', createdBy: 'นายวุฒิชัย ช่วยชาติ', createdAt: dt('2026-09-25T08:00:00+07:00') },
        { itemId: sandbag.id, type: 'issue', quantity: 1200, fromWarehouseId: w4.id, toWarehouseId: null, reference: 'เบิก กทม. เขตบึงกุ่ม', note: 'ก่อแนวกั้นน้ำ ซอยเสรีไทย', createdBy: 'นายธนากร รุ่งโรจน์', createdAt: dt('2026-09-26T07:00:00+07:00') },
        { itemId: sandbag.id, type: 'issue', quantity: 600, fromWarehouseId: w4.id, toWarehouseId: null, reference: 'เบิก ทหารพลาธิการ', note: 'สนับสนุนจุดตั้งแรงงานสวน', createdBy: 'นายวุฒิชัย ช่วยชาติ', createdAt: dt('2026-09-28T13:30:00+07:00') },
      ] : []),
      ...(waterBkk ? [
        { itemId: waterBkk.id, type: 'receive', quantity: 1500, toWarehouseId: w4.id, reference: 'บริจาค บริษัท ปตท.', note: 'โครงการน้ำใจน้ำท่วม', createdBy: 'นายวุฒิชัย ช่วยชาติ', createdAt: dt('2026-09-27T10:00:00+07:00') },
        { itemId: waterBkk.id, type: 'transfer', quantity: 300, fromWarehouseId: w4.id, toWarehouseId: w1.id, reference: 'โอนเสริมภาคเหนือ', note: 'เชียงใหม่ขาดแคลนหลังผู้อพยพเพิ่ม', createdBy: 'นางสาวกมลวรรณ ทองสุข', createdAt: dt('2026-09-30T09:00:00+07:00') },
      ] : []),
      ...(rice ? [
        { itemId: rice.id, type: 'receive', quantity: 800, toWarehouseId: w1.id, reference: 'องค์การตลาดเพื่อเกษตรกร', note: 'ข้าวสารสนับสนุน 4 ตัน', createdBy: 'นายอภิชาติ สินอุดม', createdAt: dt('2026-09-29T11:00:00+07:00') },
        { itemId: rice.id, type: 'issue', quantity: 350, fromWarehouseId: w1.id, toWarehouseId: null, reference: 'จ่ายศูนย์พักพิงยุพราช', note: 'ตามอัตรา 3 มื้อ/คน/วัน', createdBy: 'นายสมศักดิ์ เข็มทอง', createdAt: dt('2026-10-01T08:00:00+07:00') },
      ] : []),
      ...(medkit ? [
        { itemId: medkit.id, type: 'adjust', quantity: 4, fromWarehouseId: w2.id, toWarehouseId: null, reference: 'ปรับปรุงสต๊อก Q3', note: 'ตรวจนับพบขาด 4 ชุด (ชำรุด)', createdBy: 'นางสาววรรณา ดีปัญญา', createdAt: dt('2026-09-30T16:00:00+07:00') },
      ] : []),
      ...(tent ? [
        { itemId: tent.id, type: 'transfer', quantity: 12, fromWarehouseId: w3.id, toWarehouseId: w1.id, reference: 'โอนเต็นท์เสริมจุดพักพิง', note: 'ศูนย์ราชการสันทรายต้องการเพิ่ม', createdBy: 'นายพีรพงษ์ จันทร์ดี', createdAt: dt('2026-10-02T10:30:00+07:00') },
      ] : []),
    ],
  })

  // ===== Aid Requests =====
  await db.aidRequest.createMany({
    data: [
      // คำขอเหตุการณ์น้ำท่วม กทม./ทั่วประเทศ (ก.ย.–ต.ค. 69)
      { requestCode: 'REQ-2569-001', requesterName: 'นายธนากร รุ่งโรจน์', requesterOrg: 'สำนักการระบายน้ำ กทม.', type: 'water', priority: 'urgent', status: 'in_progress', quantity: '120,000 ขวด + 8,000 ชุดอาหารแห้ง', description: 'ขอน้ำดื่มและอาหารแห้งสนับสนุนศูนย์พักพิง 4 แห่งใน 50 เขต (ย่านบางกะปิ–บึงกุ่ม)', locationName: 'เขตบางกะปิ–บึงกุ่ม กทม.', incidentId: bkflood.id, assignedTo: 'บริษัท ไทยน้ำใส จำกัด', createdAt: dt('2026-09-27T08:00:00+07:00') },
      { requestCode: 'REQ-2569-002', requesterName: 'นายอนันดา ศรีสมบูรณ์', requesterOrg: 'ชุมชนซอยลาดพร้าว 101', type: 'evacuation', priority: 'urgent', status: 'in_progress', quantity: 'เรือ 12 ลำ', description: 'ขอเรืออพยพผู้สูงอายุและผู้ป่วยติดเตียงจากซอยลึกที่น้ำท่วมสูง 1.2 ม.', locationName: 'ซอยลาดพร้าว 101 เขตบึงกุ่ม', incidentId: bkflood.id, assignedTo: 'มูลนิธิร่วมกตัญญู', createdAt: dt('2026-09-26T23:00:00+07:00') },
      { requestCode: 'REQ-2569-003', requesterName: 'นพ.อนันต์ ศรีวิไล', requesterOrg: 'สภากาชาดไทย', type: 'medical', priority: 'high', status: 'approved', quantity: 'หน่วยแพทย์เคลื่อนที่ 6 หน่วย', description: 'ดูแลผู้ป่วยติดเตียงและผู้สูงอายุในศูนย์พักพิง 50 เขต หลังพบกรณีผู้ป่วยติดเตียงจมน้ำ', locationName: 'ศูนย์พักพิงทั่ว กทม.', incidentId: bkflood.id, assignedTo: 'สภากาชาดไทย', createdAt: dt('2026-09-28T10:00:00+07:00') },
      { requestCode: 'REQ-2569-004', requesterName: 'นายชัยพร อินทรวงศ์', requesterOrg: 'กองทัพอากาศไทย', type: 'other', priority: 'high', status: 'in_progress', quantity: 'กำลังพล 120 นาย', description: 'เร่งระบายกระเป๋าเดินทางตกค้างหลังยกเลิกเที่ยวบินกว่า 10 เที่ยวจากเหตุน้ำท่วม', locationName: 'ท่าอากาศยานสุวรรณภูมิ', incidentId: bkflood.id, assignedTo: 'กองทัพอากาศไทย', createdAt: dt('2026-09-29T11:00:00+07:00') },
      { requestCode: 'REQ-2569-005', requesterName: 'นายธนากร รุ่งโรจน์', requesterOrg: 'สำนักการระบายน้ำ กทม.', type: 'water', priority: 'high', status: 'approved', quantity: 'ปั๊มน้ำ 20 เครื่อง', description: 'ขอปั๊มน้ำเคลื่อนที่เพิ่มเพื่อระบายน้ำจากซอยลึกย่านบึงกุ่ม–ลาดพร้าว (คาดใช้เวลาถึง 7 วัน)', locationName: 'เขตบึงกุ่ม–ลาดพร้าว กทม.', incidentId: bkflood.id, assignedTo: 'คลังบรรเทาทุกข์ ปภ. บางเขน', createdAt: dt('2026-09-30T09:00:00+07:00') },
      { requestCode: 'REQ-2569-006', requesterName: 'นายสมชาย วิไลวรรธน์', requesterOrg: 'กรมป้องกันและบรรเทาสาธารณภัย', type: 'other', priority: 'medium', status: 'fulfilled', quantity: '9,000 บาท/ครัวเรือน', description: 'เปิดลงทะเบียนเยียวยาผ่านแอป/เว็บไซต์ ครอบคลุม 65 จังหวัด + กทม. 50 เขต ประชาชนลงทะเบียนแล้วกว่า 1 ล้านครัวเรือน', locationName: 'ทั่วประเทศ', incidentId: nationwide.id, assignedTo: 'กระทรวงมหาดไทย / ปภ.', createdAt: dt('2026-10-01T09:30:00+07:00') },
      // คำขอเดิม (ภาคเหนือ)
      { requestCode: 'REQ-2569-101', requesterName: 'ผอ.สุเมธ วัฒนชัย', requesterOrg: 'เทศบาลนครเชียงใหม่', type: 'water', priority: 'urgent', status: 'in_progress', quantity: '500 ลัง/วัน', description: 'ขอน้ำดื่มเพิ่มเติมสำหรับศูนย์พักพิง 3 แห่ง ระยะ 5 วัน', locationName: 'อ.เมือง จ.เชียงใหม่', incidentId: flood.id, assignedTo: 'บริษัท ไทยน้ำใส จำกัด' },
      { requestCode: 'REQ-2569-102', requesterName: 'นพ.อนันต์ ศรีวิไล', requesterOrg: 'สภากาชาดไทย', type: 'medical', priority: 'high', status: 'approved', quantity: '200 ชุด', description: 'ชุดยาปฐมพยาบาล + ยาแก้ท้องร่วง สำหรับหน่วยแพทย์เคลื่อนที่', locationName: 'ศูนย์พักพิงยุพราช', incidentId: flood.id, assignedTo: 'คลังกลางกรมอนามัย' },
      { requestCode: 'REQ-2569-103', requesterName: 'นายทศพล มีสุข', requesterOrg: 'อบต.เวียงสา', type: 'shelter', priority: 'high', status: 'pending', quantity: '20 หลัง', description: 'เต็นท์พักพิงสำหรับผู้เสียบ้านจากดินถล่ม', locationName: 'อ.เวียงสา จ.น่าน', incidentId: landslide.id },
      { requestCode: 'REQ-2569-104', requesterName: 'นางสาวอารีย์ ปัญญาดี', requesterOrg: 'ศูนย์ราชการสันทราย', type: 'food', priority: 'medium', status: 'fulfilled', quantity: '300 ถุง', description: 'ข้าวสารและอาหารแห้ง สำหรับ 380 คน', locationName: 'อ.สันทราย จ.เชียงใหม่', incidentId: flood.id, assignedTo: 'มูลนิธิร่วมกตัญญู' },
      { requestCode: 'REQ-2569-105', requesterName: 'คุณนิรมล เสนหา', type: 'search_rescue', priority: 'urgent', status: 'in_progress', description: 'ขอทีมค้นหาบุคคลสูญหาย นางมาลี ดอกรัก พื้นที่ตลาดวโรรส', locationName: 'ตลาดวโรรส จ.เชียงใหม่', incidentId: flood.id, assignedTo: 'มูลนิธิร่วมกตัญญู' },
      { requestCode: 'REQ-2569-106', requesterName: 'นายวิชัย ใจดี', requesterOrg: 'ชุมชนริมปิงรวมใจ', type: 'evacuation', priority: 'high', status: 'pending', quantity: '2 เที่ยว', description: 'ขอเรืออพยพผู้สูงอายุ 42 คน จากหมู่ 5 ต.ช้างเผือก', locationName: 'ต.ช้างเผือก จ.เชียงใหม่', incidentId: flood.id },
    ],
  })

  // ===== Alerts (msg) =====
  await db.alert.createMany({
    data: [
      // การแจ้งเตือนเหตุการณ์น้ำท่วม ก.ย.–ต.ค. 69
      { title: '🚨 ประกาศภาวะฉุกเฉินน้ำท่วม กทม.', message: '26 ก.ย. 69 เวลา 10:16 น. ประกาศภาวะฉุกเฉินน้ำท่วม — ทั้ง 50 เขตเป็นพื้นที่ประสบภัยพิบัติ โปรดอพยพจากพื้นที่ต่ำ/ซอยลึกไปยังศูนย์พักพิงที่กำหนด ห้ามลุยน้ำบริเวณเสาไฟฟ้า สายด่วน ปภ. 1784 กู้ชีพ 1669', channel: 'sms', severity: 'critical', audience: 'area', status: 'sent', sentAt: dt('2026-09-26T10:30:00+07:00'), incidentId: bkflood.id },
      { title: '⛈️ เตือนเฝ้าระวังน้ำท่วม 70 จังหวัด', message: 'ปภ. เตือนฝนตกหนักถึงหนักมากและน้ำหลาก อีก 70 จังหวัดเข้าเขตเฝ้าระวังถึง 27 ก.ย. 69 โปรดติดตามประกาศและเตรียมของจำเป็น', channel: 'broadcast', severity: 'warning', audience: 'all', status: 'sent', sentAt: dt('2026-09-25T09:00:00+07:00'), incidentId: nationwide.id },
      { title: '🏛️ ประกาศวันหยุดพิเศษ กทม. 28–29 ก.ย. 69', message: 'ครม. ประกาศวันหยุดพิเศษกรุงเทพมหานคร 28–29 ก.ย. 69 เพื่อความปลอดภัยของประชาชน โปรดงดเดินทางในพื้นที่น้ำท่วม สถาบันการศึกษาปิดสอน', channel: 'broadcast', severity: 'info', audience: 'all', status: 'sent', sentAt: dt('2026-09-27T18:00:00+07:00'), incidentId: bkflood.id },
      { title: '📱 เปิดลงทะเบียนเยียวยา 9,000 บาท/ครัวเรือน', message: 'ผู้ประสบอุทกภัย 65 จังหวัด + กทม. 50 เขต (ช่วง 15 พ.ค.–30 ก.ย. 69) ลงทะเบียนขอรับเงินเยียวยาผ่านแอป/เว็บไซต์ ตามประกาศ ปภ. — บ้านท่วมไม่เกิน 7 วันรับ 9,000 บาท', channel: 'sms', severity: 'info', audience: 'all', status: 'sent', sentAt: dt('2026-10-01T08:30:00+07:00'), incidentId: nationwide.id },
      { title: '🌧️ เตือนฝนตกหนักอีกระลอก (5 ต.ค. 69)', message: 'กรมอุตุนิยมวิทยาเตือนฝนตกหนักถึงหนักมากและอุทกภัยฉับพลัน หลังรายงานผู้เสียชีวิตจากน้ำท่วมรวม 31 รายใน 8 จังหวัด ผู้ปฏิบัติงานโปรดเฝ้าระวังพื้นที่เสี่ยงดินถล่ม/น้ำป่า 24 ชม.', channel: 'broadcast', severity: 'warning', audience: 'officers', status: 'sent', sentAt: dt('2026-10-05T07:00:00+07:00'), incidentId: nationwide.id },
      { title: '🙋 เรียกอาสาสมัครฟื้นฟูหลังน้ำลด', message: 'ขออาสาสมัครทำความสะอาด–ฆ่าเชื้อโรงเรียน วัด และตลาดหลังน้ำลดในย่านบางกะปิ บึงกุ่ม ลาดพร้าว สมัครได้ที่ EOC ปภ. กรุงเทพฯ', channel: 'app', severity: 'info', audience: 'volunteers', status: 'draft', incidentId: bkflood.id },
      // การแจ้งเตือนเดิม (ภาคเหนือ)
      { title: '⚠️ เตือนภัยน้ำท่วมฉับพลัน', message: 'ประชาชนในพื้นที่ริมแม่น้ำปิง อ.เมืองเชียงใหม่ โปรดยกระดับสัมภาระและเตรียมอพยพไปที่ศูนย์พักพิงที่กำหนด ระดับน้ำขึ้นต่อเนื่อง', channel: 'sms', severity: 'critical', audience: 'area', status: 'sent', sentAt: dt('2026-10-05T08:00:00+07:00'), incidentId: flood.id },
      { title: '📢 ประกาศเวลาให้ความช่วยเหลือ', message: 'หน่วยแพทย์เคลื่อนที่ให้บริการที่ศูนย์พักพิงยุพราช ทุกวัน 08:00-20:00 น.', channel: 'broadcast', severity: 'info', audience: 'all', status: 'sent', sentAt: dt('2026-10-04T10:00:00+07:00'), incidentId: flood.id },
      { title: '🚒 เรียกประจำการหน่วยกู้ภัย', message: 'อาสาสมัครกู้ภัยน้ำทุกท่าน โปรดประจำการที่ท่าเรือวัดเกตุ เวลา 07:00 น. พรุ่งนี้', channel: 'app', severity: 'warning', audience: 'volunteers', status: 'sent', sentAt: dt('2026-10-05T15:00:00+07:00'), incidentId: flood.id },
      { title: '⛈️ คำเตือนฝนตกหนักพื้นที่ภูคา', message: 'พยากรณ์อากาศ: ฝนตกหนักถึงหนักมากบริเวณ อ.เวียงสา จ.น่าน ประชาชนเสี่ยงดินถล่มโปรดงดเดินทาง', channel: 'email', severity: 'warning', audience: 'officers', status: 'scheduled', scheduledAt: new Date(Date.now() + 3600000), incidentId: landslide.id },
      { title: '🩸 ขอเชิญบริจาคเลือดฉุกเฉิน', message: 'ธนาคารเลือดกลางขอเชิญประชาชนบริจาคเลือดที่ศูนย์พักพิงยุพราช ช่วง 10:00-16:00 น.', channel: 'broadcast', severity: 'info', audience: 'all', status: 'draft', incidentId: flood.id },
    ],
  })

  // ===== Users (admin) =====
  await db.user.createMany({
    data: [
      { email: 'admin@eden.go.th', name: 'ผู้ดูแลระบบกลาง', role: 'admin', passwordHash: hashPassword('Admin@2568'), lastLoginAt: new Date(Date.now() - 3600000) },
      { email: 'coordinator@eden.go.th', name: 'นางสาวกมลวรรณ ทองสุข', role: 'coordinator', passwordHash: hashPassword('Coord@2568'), lastLoginAt: new Date(Date.now() - 7200000) },
      { email: 'officer.cm@eden.go.th', name: 'นายสมศักดิ์ เข็มทอง', role: 'officer', passwordHash: hashPassword('Officer@2568'), lastLoginAt: new Date(Date.now() - 86400000) },
      { email: 'officer.bkk@eden.go.th', name: 'นายธนากร รุ่งโรจน์', role: 'officer', passwordHash: hashPassword('Officer@2568'), lastLoginAt: new Date(Date.now() - 5400000) },
      { email: 'volunteer1@eden.go.th', name: 'นายประเสริฐ ชัยมงคล', role: 'volunteer', passwordHash: hashPassword('Vol@2568'), lastLoginAt: new Date(Date.now() - 172800000) },
      { email: 'volunteer2@eden.go.th', name: 'นางสาวสุนิสา แก้วใส', role: 'volunteer', status: 'inactive', passwordHash: hashPassword('Vol@2568') },
    ],
  })

  // ===== Audit Log =====
  const logs = [
    { userName: 'ผู้ดูแลระบบกลาง', action: 'create', module: 'incidents', detail: 'สร้างเหตุการณ์ INC-2569-005 อุทกภัยรอบด้าน 42 จังหวัด (16 ก.ย. 69)' },
    { userName: 'นายธนากร รุ่งโรจน์', action: 'create', module: 'incidents', detail: 'ประกาศภาวะฉุกเฉินน้ำท่วม กทม. 26 ก.ย. 69 เวลา 10:16 น. — 50 เขตเป็นพื้นที่ภัยพิบัติ' },
    { userName: 'ผู้ดูแลระบบกลาง', action: 'send', module: 'alerts', detail: 'ส่ง SMS ประกาศภาวะฉุกเฉินน้ำท่วมไปยังพื้นที่ 50 เขต' },
    { userName: 'ผู้ดูแลระบบกลาง', action: 'approve', module: 'requests', detail: 'อนุมัติคำขอ REQ-2569-005 ปั๊มน้ำ 20 เครื่อง ย่านบึงกุ่ม–ลาดพร้าว' },
    { userName: 'นางสาวกมลวรรณ ทองสุข', action: 'create', module: 'persons', detail: 'ลงทะเบียนผู้ประสบภัยน้ำท่วม กทม. 12 ราย ที่ศูนย์พักพิงบางกะปิ' },
    { userName: 'ผู้ดูแลระบบกลาง', action: 'approve', module: 'requests', detail: 'อนุมัติคำขอ REQ-2568-002 ชุดยาปฐมพยาบาล' },
    { userName: 'นายประเสริฐ ชัยมงคล', action: 'update', module: 'persons', detail: 'อัปเดตสถานะพบตัว: สุดา แสงจันทร์' },
  ]
  for (let i = 0; i < logs.length; i++) {
    await db.auditLog.create({ data: { ...logs[i], createdAt: new Date(Date.now() - i * 5400000) } })
  }

  // ===== Map Layers (gis) =====
  // (1) เดิม — ภาคเหนือ
  const chmaiZone = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'เขตพื้นที่ประสบน้ำท่วม', detail: 'อ.เมืองเชียงใหม่ + อ.สันทราย — ระดับวิกฤต', updated: '2569-10-04' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [98.94, 18.85], [99.08, 18.87], [99.16, 18.80], [99.13, 18.70],
            [99.02, 18.64], [98.90, 18.67], [98.84, 18.76], [98.94, 18.85],
          ]],
        },
      },
      {
        type: 'Feature',
        properties: { name: 'เขตเฝ้าระวังฝั่งแม่น้ำปิง', detail: 'ระดับน้ำเกิน 4.20 ม. — ต้องเฝ้าระวังต่อเนื่อง' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [98.97, 18.83], [99.06, 18.84], [99.09, 18.74], [98.99, 18.70], [98.94, 18.76], [98.97, 18.83],
          ]],
        },
      },
    ],
  }
  const reliefRoute = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'เส้นทางลำเลียงหลัก', detail: 'คลังกลางเชียงใหม่ → ศูนย์บรรเทาทุกข์น่าน (ระยะ ~268 กม.)' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [98.98, 18.79], [99.05, 18.72], [99.25, 18.62], [99.49, 18.42],
            [99.72, 18.45], [99.95, 18.55], [100.20, 18.63], [100.47, 18.72], [100.78, 18.78],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { name: 'ทางเข้าพื้นที่ดินโคลนถล่ม (น่าน)', detail: 'ช่วงภูเขาใช้รถกระบะ 6 ล้อขึ้นไปเท่านั้น' },
        geometry: {
          type: 'LineString',
          coordinates: [[100.72, 18.74], [100.78, 18.83], [100.88, 18.90], [100.99, 18.95]],
        },
      },
    ],
  }
  const reliefPoints = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: 'จุดกระจายน้ำดื่ม 1', detail: 'วัดเจ็ดยอด — รองรับ 400 ครัวเรือน/วัน' }, geometry: { type: 'Point', coordinates: [98.89, 18.81] } },
      { type: 'Feature', properties: { name: 'จุดกระจายอาหารแห้ง 2', detail: 'มหาวิทยาลัยเชียงใหม่ (ด้านหลัง) — 3 มื้อ/วัน' }, geometry: { type: 'Point', coordinates: [98.96, 18.80] } },
      { type: 'Feature', properties: { name: 'จุดกระจายเวชภัณฑ์ 3', detail: 'โรงพยาบาลสันทราย — เปิด 08:00–18:00' }, geometry: { type: 'Point', coordinates: [99.01, 18.88] } },
      { type: 'Feature', properties: { name: 'จุดกระจายเชื้อเพลิง 4', detail: 'สนามกีฬาเวียงสา จ.น่าน' }, geometry: { type: 'Point', coordinates: [100.72, 18.93] } },
    ],
  }
  // (2) ใหม่ — เหตุการณ์น้ำท่วม กทม. + ลุ่มเจ้าพระยา (ก.ย.–ต.ค. 69)
  const bkkDisaster = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'เขตประสบภัยพิบัติ 50 เขต กทม.', detail: 'ประกาศภาวะฉุกเฉิน 26 ก.ย. 69 เวลา 10:16 น. — น้ำท่วมรุนแรงที่สุดในรอบ 15 ปี', updated: '2569-09-26' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [100.35, 13.68], [100.55, 13.54], [100.80, 13.52], [100.95, 13.62],
            [100.99, 13.78], [100.92, 13.92], [100.72, 13.98], [100.50, 13.94],
            [100.36, 13.82], [100.35, 13.68],
          ]],
        },
      },
      {
        type: 'Feature',
        properties: { name: 'โซนน้ำท่วมหนักฝั่งตะวันออก', detail: 'บางกะปิ–บึงกุ่ม–ลาดพร้าว น้ำสูง 0.8–1.2 ม. ซอยลึกระบายน้ำถึง 7 วัน' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [100.62, 13.70], [100.74, 13.66], [100.80, 13.72], [100.78, 13.84], [100.68, 13.88], [100.60, 13.80], [100.62, 13.70],
          ]],
        },
      },
    ],
  }
  const cpBasin = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'พื้นที่น้ำท่วมลุ่มเจ้าพระยา', detail: 'อยุธยา–ปทุมธานี–นนทบุรี น้ำเหนือ 16 ก.ย. 69 เขื่อนภูมิพลระบาย 35 ลบ.ม./วิ สิริกิติ์ 93 ลบ.ม./วิ', updated: '2569-10-06' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [100.42, 14.44], [100.68, 14.40], [100.66, 14.18], [100.60, 14.02], [100.55, 13.88], [100.46, 13.80], [100.38, 13.86], [100.36, 14.08], [100.42, 14.44],
          ]],
        },
      },
    ],
  }
  const bkkHelpPoints = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: 'จุดแจกน้ำดื่ม–อาหาร บางกะปิ', detail: 'หน้าโรงเรียนบางกะปิ — 5,000 ชุด/วัน' }, geometry: { type: 'Point', coordinates: [100.664, 13.745] } },
      { type: 'Feature', properties: { name: 'จุดปั๊มน้ำบึงกุ่ม', detail: 'ปั๊มน้ำเคลื่อนที่ 12 เครื่อง — ระบายซอยลึกลาดพร้าว 101' }, geometry: { type: 'Point', coordinates: [100.703, 13.765] } },
      { type: 'Feature', properties: { name: 'ศูนย์พักพิงสนามกีฬาลาดสี', detail: 'รองรับ 900 คน — มีหน่วยแพทย์เคลื่อนที่' }, geometry: { type: 'Point', coordinates: [100.615, 13.885] } },
      { type: 'Feature', properties: { name: 'จุดรับกระเป๋าเดินทาง สุวรรณภูมิ', detail: 'กองทัพอากาศช่วยเคลียร์กระเป๋าตกค้างหลังยกเลิกเที่ยวบิน' }, geometry: { type: 'Point', coordinates: [100.747, 13.693] } },
      { type: 'Feature', properties: { name: 'ศูนย์พักพิงปากเกร็ด', detail: 'ศูนย์ราชการเฉลิมพระเกียรติ 80 พรรษา — รองรับ 2,000 คน' }, geometry: { type: 'Point', coordinates: [100.506, 13.907] } },
      { type: 'Feature', properties: { name: 'จุดแจกถุงยังชีพ อยุธยา', detail: 'หน้าศาลากลางจังหวัด — 1,200 ชุด/วัน' }, geometry: { type: 'Point', coordinates: [100.578, 14.353] } },
    ],
  }
  const cpFlowLine = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'เส้นทางน้ำเหนือลุ่มเจ้าพระยา', detail: 'นครสวรรค์ → ชัยนาท → อยุธยา → ปทุมธานี → กทม. (ติดตามโดยกรมชลประทาน 6 ต.ค. 69: เขื่อนหลักยังรับน้ำได้มาก)' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [100.12, 15.70], [100.10, 15.35], [100.09, 15.20], [100.22, 14.85],
            [100.42, 14.55], [100.56, 14.36], [100.53, 14.01], [100.51, 13.80], [100.53, 13.55],
          ],
        },
      },
    ],
  }
  await db.mapLayer.createMany({
    data: [
      { name: 'เขตพื้นที่ประสบน้ำท่วม (เชียงใหม่)', sourceType: 'kml_file', data: JSON.stringify(chmaiZone), color: '#14b8a6', featureCount: 2 },
      { name: 'เส้นทางลำเลียงสิ่งบรรเทาทุกข์', sourceType: 'kml_file', data: JSON.stringify(reliefRoute), color: '#f59e0b', featureCount: 2 },
      { name: 'จุดกระจายสิ่งบรรเทาทุกข์', sourceType: 'kml_file', data: JSON.stringify(reliefPoints), color: '#8b5cf6', featureCount: 4 },
      { name: 'เขตประสบภัยพิบัติ 50 เขต กทม. (ก.ย. 69)', sourceType: 'kml_file', data: JSON.stringify(bkkDisaster), color: '#ef4444', featureCount: 2 },
      { name: 'พื้นที่น้ำท่วมลุ่มเจ้าพระยา (ก.ย.–ต.ค. 69)', sourceType: 'kml_file', data: JSON.stringify(cpBasin), color: '#f97316', featureCount: 1 },
      { name: 'จุดช่วยเหลือและปั๊มน้ำ กทม.–ลุ่มเจ้าพระยา', sourceType: 'kml_file', data: JSON.stringify(bkkHelpPoints), color: '#8b5cf6', featureCount: 6 },
      { name: 'เส้นทางน้ำเหนือลุ่มเจ้าพระยา (ติดตามสด)', sourceType: 'url_geojson', sourceUrl: 'https://api.rid.go.th/chao-phraya/flow-2569', data: JSON.stringify(cpFlowLine), color: '#10b981', featureCount: 1 },
    ],
  })

  // ===== Settings =====
  await db.setting.createMany({
    data: [
      { key: 'system_name', value: 'EDEN DMS — ระบบจัดการภัยพิบัติ' },
      { key: 'region', value: 'ประเทศไทย — ลุ่มเจ้าพระยา ภาคใต้ และภาคเหนือตอนบน' },
      { key: 'active_operation', value: 'ปฏิบัติการช่วยเหลืออุทกภัย ก.ย.–ต.ค. 2569 (42 จังหวัด)' },
      { key: 'alert_sms_gateway', value: 'sms-gateway.local:8080' },
      { key: 'backup_schedule', value: 'ทุกวัน 02:00 น.' },
    ],
  })

  const counts = {
    incidents: await db.incident.count(),
    reports: await db.incidentReport.count(),
    persons: await db.person.count(),
    organizations: await db.organization.count(),
    hr: await db.humanResource.count(),
    shelters: await db.shelter.count(),
    items: await db.inventoryItem.count(),
    requests: await db.aidRequest.count(),
    alerts: await db.alert.count(),
    users: await db.user.count(),
    mapLayers: await db.mapLayer.count(),
  }
  console.log('✅ Seed complete:', counts)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
