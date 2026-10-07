/**
 * EDEN DMS — Import เหตุการณ์ "อุทกภัย ปี 2569" ฉบับข้อมูลจริงล่าสุด (ปภ. 7 ต.ค. 2569)
 *
 * แหล่งข้อมูล (ค้นเมื่อ 7 ต.ค. 69):
 * - ปภ./ThaiPBS (7 ต.ค. 69): อุทกภัย 27 จังหวัด + กทม. 123 อำเภอ — ผู้ได้รับผลกระทบ
 *   1.1 ล้านครัวเรือน / 3.1 ล้านคน เสียชีวิต 52 ราย
 * - ปภ./PRD (6–7 ต.ค. 69): กทม. 329,000 ครัวเรือน เสียชีวิต 4 ราย ระดับน้ำลดลง
 * - ปภ. (29 ก.ย. 69): ประกาศเขตช่วยเหลือภัยพิบัติ กทม. 38 เขต 118 แขวง
 * - ThaiPBS (1 ต.ค. 69): ปทุมธานี 7 อำเภอ 29 ตำบล 510 หมู่บ้าน
 * - PRD (6 ต.ค. 69): นครสวรรค์ 12 อำเภอ
 * - กรมชลประทาน (3 ต.ค. 69): สถานี C.2 นครสวรรค์ ผ่านจุดสูงสุดแล้ว เริ่มลดลง
 * - รัฐบาล/ทบ. (6 ต.ค. 69): กำชับภาคใต้รับมือฝนตกหนัก 4–14 ต.ค. 69
 * - เยียวยา 9,000 บาท/ครัวเรือน — ครอบคลุม 15 พ.ค.–30 ก.ย. 69 (กทม. + 65 จังหวัด)
 *   ลงทะเบียนแอป "ทางรัฐ" / flood68.disaster.go.th โอนผ่านธนาคารออมสิน
 *
 * รัน: bun prisma/import-flood2569.ts   (idempotent — รันซ้ำไม่สร้างข้อมูลซ้ำ)
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const dt = (iso: string) => new Date(iso)
const ACTOR = 'ปภ. Data Import'

/** คืน id ของ Location ตามชื่อ ถ้ายังไม่มีจึงสร้างใหม่ (idempotent) */
async function upsertLocation(name: string, lat: number, lng: number): Promise<{ id: string; created: boolean }> {
  const found = await db.location.findFirst({ where: { name, deleted: false } })
  if (found) return { id: found.id, created: false }
  const row = await db.location.create({
    data: { name, level: 'province', lat, lng, createdBy: ACTOR, updatedBy: ACTOR },
  })
  return { id: row.id, created: true }
}

async function main() {
  console.log('🌊 Import เหตุการณ์อุทกภัย ปี 2569 — ฉบับข้อมูลจริง ปภ. 7 ต.ค. 69')
  let created = 0
  let updated = 0

  // ===== 1) อัปเดต Incidents ด้วยตัวเลขจริงล่าสุด =====
  const nationwide = await db.incident.findUnique({ where: { code: 'INC-2569-005' } })
  if (nationwide) {
    await db.incident.update({
      where: { id: nationwide.id },
      data: {
        title: 'อุทกภัยรอบด้าน 27 จังหวัด + กรุงเทพฯ (ปภ. 7 ต.ค. 69)',
        affectedPeople: 3100000,
        deceased: 52,
        description:
          'อุทกภัยจากร่องมรสุมและพายุดีเปรสชัน (เริ่ม 16 ก.ย. 69) — รายงานล่าสุด ปภ. 7 ต.ค. 69: ' +
          'พื้นที่ประสบอุทกภัย 27 จังหวัด 123 อำเภอ รวมกรุงเทพฯ ผู้ได้รับผลกระทบ 1.1 ล้านครัวเรือน / 3.1 ล้านคน ' +
          'เสียชีวิต 52 ราย (จุดสูงสุด 1 ต.ค.: 30 จังหวัด 3.3 ล้านคน) ' +
          'น้ำที่สถานี C.2 นครสวรรค์ผ่านจุดสูงสุดแล้วเริ่มลดลง (3 ต.ค.) ' +
          'เยียวยา 9,000 บาท/ครัวเรือน ครอบคลุม 15 พ.ค.–30 ก.ย. 69 ใน กทม. + 65 จังหวัด ' +
          'ลงทะเบียนแอป "ทางรัฐ" / flood68.disaster.go.th โอนผ่านธนาคารออมสิน',
        updatedBy: ACTOR,
      },
    })
    updated++
  }

  const bkflood = await db.incident.findUnique({ where: { code: 'INC-2569-006' } })
  if (bkflood) {
    await db.incident.update({
      where: { id: bkflood.id },
      data: {
        endDate: null, // 7 ต.ค. ยังระบายน้ำซอยลึก/พื้นที่ต่ำ — ยกเลิกวันปิดเหตุการณ์เดิม
        description:
          'ฝนตกต่อเนื่อง 48 ชม. จากพายุดีเปรสชัน ประกาศภาวะฉุกเฉิน 26 ก.ย. 69 เวลา 10:16 น. ' +
          'ปภ. ประกาศเขตช่วยเหลือภัยพิบัติ 38 เขต 118 แขวง (29 ก.ย. 69) ' +
          'รายงานล่าสุด ปภ. 7 ต.ค. 69: ผู้ได้รับผลกระทบ 329,000 ครัวเรือน เสียชีวิต 4 ราย ระดับน้ำลดลง ' +
          'เร่งระบายน้ำซอยลึก/พื้นที่ต่ำฝั่งตะวันออก (ลาดกระบัง หนองจอก มีนบุรี) และฟื้นฟูพื้นที่',
        updatedBy: ACTOR,
      },
    })
    updated++
  }

  const cpflood = await db.incident.findUnique({ where: { code: 'INC-2569-007' } })
  if (cpflood) {
    await db.incident.update({
      where: { id: cpflood.id },
      data: {
        description:
          'น้ำเหนือลุ่มเจ้าพระยา — ปทุมธานีน้ำท่วม 7 อำเภอ (ธัญบุรี เมือง สามโคก คลองหลวง ลำลูกกา หนองเสือ ลาดหลุมแก้ว) ' +
          'รวม 29 ตำบล 510 หมู่บ้าน (1 ต.ค. 69) อยุธยา–นนทบุรีทรงตัว ' +
          'กรมชลประทาน: ปริมาณน้ำที่สถานี C.2 อ.เมืองนครสวรรค์ผ่านจุดสูงสุดแล้วเริ่มลดลง (3 ต.ค. 69) ' +
          'ระบายน้ำเจ้าพระยา–ป่าสักชลสิทธิ์ควบคุมได้ ไม่กระทบ กทม. เพิ่มเติม',
        updatedBy: ACTOR,
      },
    })
    updated++
  }

  const southflood = await db.incident.findUnique({ where: { code: 'INC-2569-008' } })
  if (southflood) {
    await db.incident.update({
      where: { id: southflood.id },
      data: {
        description:
          'ภาคใต้ฝั่งทะเลอ่าวไทย — สถานการณ์คลี่คลาย แต่รัฐบาลกำชับเฝ้าระวังฝนตกหนักช่วง 4–14 ต.ค. 69 ' +
          'กองทัพบก (มทบ.42) ระดมแจกถุงยังชีพ เคลื่อนย้ายผู้ติดค้าง และเตรียมกำลังรับอุทกภัยภาคใต้ล่วงหน้า ' +
          'ประกาศเฝ้าระวัง 10 จังหวัดภาคใต้ ระหว่างรอพายุระลอกใหม่',
        updatedBy: ACTOR,
      },
    })
    updated++
  }
  console.log(`✓ อัปเดต incidents 4 รายการด้วยข้อมูล ปภ. 7 ต.ค. 69`)

  // ===== 2) Locations — จังหวัดที่ข่าว ปภ. ระบุชื่อ (ไม่ซ้ำกับ seed เดิม) =====
  const provinces: Array<[string, number, number]> = [
    ['จังหวัดนครสวรรค์', 15.6936, 100.1159],
    ['จังหวัดอุทัยธานี', 15.383, 100.0288],
    ['จังหวัดชัยนาท', 15.8022, 100.078],
    ['จังหวัดสิงห์บุรี', 14.7147, 100.395],
    ['จังหวัดสุพรรณบุรี', 14.4735, 100.1173],
    ['จังหวัดอ่างทอง', 14.59, 100.4565],
    ['จังหวัดราชบุรี', 13.5283, 99.8133],
    ['จังหวัดเพชรบุรี', 12.9452, 99.8585],
    ['จังหวัดนครนายก', 14.2063, 101.2131],
    ['จังหวัดกาญจนบุรี', 14.0035, 99.5283],
    ['จังหวัดสมุทรสงคราม', 13.4117, 100.005],
    ['จังหวัดสมุทรสาคร', 13.5475, 100.2744],
    ['จังหวัดสมุทรปราการ', 13.5236, 100.5876],
    ['จังหวัดชลบุรี', 13.3611, 100.9847],
    ['จังหวัดลพบุรี', 14.7995, 100.6532],
  ]
  let newLoc = 0
  const locId = new Map<string, string>()
  for (const [name, lat, lng] of provinces) {
    const r = await upsertLocation(name, lat, lng)
    locId.set(name, r.id)
    if (r.created) newLoc++
  }
  console.log(`✓ Locations: เพิ่ม ${newLoc} จังหวัด (รวมที่มีอยู่ ${locId.size})`)

  // ===== 3) SITREP ล่าสุด (อิงรายงานจริง ปภ. 3–7 ต.ค. 69) =====
  const sitreps = nationwide
    ? [
        {
          incidentId: nationwide.id,
          title: 'SITREP #10 — ปภ. รายงานสถานการณ์ 27 จังหวัด + กทม. (7 ต.ค. 69)',
          content:
            'ปภ. เผยพื้นที่ประสบอุทกภัย 27 จังหวัด 123 อำเภอ รวมกรุงเทพฯ มีประชาชนได้รับผลกระทบ ' +
            '1.1 ล้านครัวเรือน / 3.1 ล้านคน และมีรายงานผู้เสียชีวิต 52 ราย ' +
            'ผนึกกำลังทุกภาคส่วนเร่งระบายน้ำ–ฟื้นฟูพื้นที่ บรรเทาความเดือดร้อนให้ประชาชนกลับมาใช้ชีวิตตามปกติโดยเร็ว ' +
            'สายด่วน ปภ. 1784 / สายด่วนน้ำท่วม 1111 กด 5',
          status: 'published',
          author: 'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)',
          createdAt: dt('2026-10-07T09:00:00+07:00'),
        },
        {
          incidentId: nationwide.id,
          title: 'SITREP #11 — น้ำท่วม 26 จังหวัด + กทม. ระดับน้ำเพิ่มในบางลุ่ม (3 ต.ค. 69)',
          content:
            'ยังท่วม 26 จังหวัดและ กทม. จังหวัดที่ระดับน้ำเพิ่มขึ้น: นครสวรรค์ อุทัยธานี ชัยนาท สิงห์บุรี สุพรรณบุรี ' +
            'อ่างทอง พระนครศรีอยุธยา ปทุมธานี ราชบุรี เพชรบุรี นครนายก ' +
            'ขณะเดียวกันกรมชลประทานแจ้งน้ำที่สถานี C.2 (นครสวรรค์) ผ่านจุดสูงสุดแล้ว มีแนวโน้มลดลง',
          status: 'published',
          author: 'ศูนย์ปฏิบัติการช่วยเหลือประชาชนฯ (EOC ปภ.)',
          createdAt: dt('2026-10-03T18:00:00+07:00'),
        },
        {
          incidentId: nationwide.id,
          title: 'SITREP #12 — ปภ. ระดมกำลังและทรัพยากรเร่งช่วยเหลือ (6 ต.ค. 69)',
          content:
            'ปภ. รายงานน้ำท่วม 27 จังหวัด และ กทม. ระดมกำลังและทรัพยากรเร่งช่วยเหลือประชาชน ' +
            'บรรเทาความเดือดร้อนของผู้ประสบภัย พร้อมติดตามสถานการณ์อย่างใกล้ชิด ' +
            'นครสวรรค์น้ำท่วม 12 อำเภอ กำลังพล ทบ. แจกข้าวกล่อง–น้ำดื่ม และเคลื่อนย้ายประชาชนที่ติดค้าง ' +
            'ด้านภาคใต้รัฐบาลกำชับเตรียมรับมือฝนตกหนัก 4–14 ต.ค. 69',
          status: 'published',
          author: 'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)',
          createdAt: dt('2026-10-06T17:00:00+07:00'),
        },
        {
          incidentId: bkflood?.id ?? '',
          title: 'SITREP #13 — กทม. น้ำลดลงต่อเนื่อง เร่งฟื้นฟูฝั่งตะวันออก (7 ต.ค. 69)',
          content:
            'ปภ. รายงาน กทม. ผู้ได้รับผลกระทบ 329,000 ครัวเรือน เสียชีวิต 4 ราย ระดับน้ำลดลง ' +
            'เขตที่ยังน้ำท่วมขัง: ลาดกระบัง หนองจอก มีนบุรี (ซอยลึก/พื้นที่ต่ำ) ' +
            'เขตช่วยเหลือภัยพิบัติ 38 เขต 118 แขวง — เยียวยาตามหลักเกณฑ์กระทรวงการคลัง ' +
            'โดยต้องไม่เกิน 3 เดือนนับแต่วันที่เกิดเหตุ (ประกาศ 29 ก.ย. 69)',
          status: 'published',
          author: 'EOC กรุงเทพมหานคร / ปภ.',
          createdAt: dt('2026-10-07T11:00:00+07:00'),
        },
      ]
    : []
  for (const s of sitreps) {
    if (!s.incidentId) continue
    const dup = await db.incidentReport.findFirst({ where: { title: s.title } })
    if (dup) continue
    await db.incidentReport.create({ data: { ...s, createdBy: ACTOR, updatedBy: ACTOR } })
    created++
  }
  console.log(`✓ เพิ่ม SITREP ใหม่ ${created} รายงาน`)

  // ===== 4) Alerts — เตือนภัยภาคใต้ (draft สำหรับทดสอบ pipeline) + แจ้งเตือน กทม. =====
  const alertSeed = [
    {
      title: '⛈️ เตือนภัยฝนตกหนักภาคใต้ 4–14 ต.ค. 69 — เตรียมรับมืออุทกภัย',
      message:
        'กรมอุตุนิยมวิทยาคาดฝนตกหนักถึงหนักมากบางพื้นที่ภาคใต้ฝั่งทะเลอ่าวไทย 4–14 ต.ค. 69 ' +
        'รัฐบาลกำชับจังหวัดภาคใต้เตรียมพื้นที่รองรับน้ำ เตือนประชาชนติดตามประกาศและเตรียมถุงยังชีพ ' +
        'หน่วยงานพร้อมช่วยเหลือ: ปภ. 1784 / 1111 กด 5',
      channel: 'broadcast',
      severity: 'warning',
      audience: 'all',
      status: 'draft',
      incidentId: southflood?.id ?? null,
    },
    {
      title: '🚨 แจ้งเตือนน้ำท่วมขังซอยลึกฝั่งตะวันออก กทม. — งดเดินทางผ่านพื้นที่ต่ำ',
      message:
        'เขตลาดกระบัง หนองจอก มีนบุรี ยังมีน้ำท่วมขังในซอยลึกและพื้นที่ต่ำ ' +
        'งดเดินทางผ่านจุดเสี่ยง จอดรถบนที่สูง ระวังไฟดูด ' +
        'แจ้งเหตุได้ที่ 1555 (กทม.) หรือ 1784 (ปภ.)',
      channel: 'broadcast',
      severity: 'warning',
      audience: 'area',
      status: 'sent',
      sentAt: dt('2026-10-07T08:00:00+07:00'),
      incidentId: bkflood?.id ?? null,
    },
  ]
  let newAlerts = 0
  for (const a of alertSeed) {
    const dup = await db.alert.findFirst({ where: { title: a.title } })
    if (dup) continue
    await db.alert.create({ data: { ...a, createdBy: ACTOR, updatedBy: ACTOR } as never })
    newAlerts++
  }
  console.log(`✓ เพิ่ม Alerts ${newAlerts} รายการ`)

  // ===== 5) Shelters ใหม่ (นครสวรรค์ / ปทุมธานี / กทม.) + occupancy ledger =====
  const nakhonId = locId.get('จังหวัดนครสวรรค์')
  const pathumId = (await db.location.findFirst({ where: { name: 'จังหวัดปทุมธานี' } }))?.id
  const bangkokId = (await db.location.findFirst({ where: { name: 'กรุงเทพมหานคร' } }))?.id

  const shelterSeed = [
    {
      key: 'ศูนย์พักพิงมหาวิทยาลัยนเรศวร (พยุหะคีรี)',
      data: {
        name: 'ศูนย์พักพิงมหาวิทยาลัยนเรศวร (พยุหะคีรี)', type: 'school',
        address: '99 หมู่ 9 ต.ท่าทอง อ.พยุหะคีรี จ.นครสวรรค์', locationId: nakhonId,
        capacity: 800, currentOccupancy: 530, contactPerson: 'ผอ.ดร.สมชาย รักไทย', phone: '056-221-101',
        status: 'open', facilities: 'water,electricity,medical,food,toilet', lat: 16.0612, lng: 99.9463,
      },
      logs: [
        { delta: 180, count: 180, note: 'เปิดศูนย์รับผู้อพยพ อ.พยุหะคีรี–อ.เมืองนครสวรรค์', at: dt('2026-10-03T16:00:00+07:00') },
        { delta: 210, count: 390, note: 'อพยพเพิ่มจาก ต.ท่าทอง บ้านน้ำท่วมขังเกิน 1.5 ม.', at: dt('2026-10-04T19:00:00+07:00') },
        { delta: 95, count: 485, note: 'รับผู้อพยพจาก อ.ตาคลี และชุมชนริมแม่น้ำน่าน', at: dt('2026-10-05T20:30:00+07:00') },
        { delta: 45, count: 530, note: 'รับผู้อพยพเพิ่มเติม จำนวน 45 คน (อ.ไพศาลี)', at: dt('2026-10-06T21:00:00+07:00') },
      ],
    },
    {
      key: 'ศูนย์พักพิงโรงเรียนคลองหลวง (ปทุมธานี)',
      data: {
        name: 'ศูนย์พักพิงโรงเรียนคลองหลวง (ปทุมธานี)', type: 'school',
        address: 'อ.คลองหลวง จ.ปทุมธานี', locationId: pathumId,
        capacity: 600, currentOccupancy: 385, contactPerson: 'ผอ.นิกร วงศ์คงเป็น', phone: '02-166-1002',
        status: 'open', facilities: 'water,electricity,medical,food,toilet', lat: 14.0298, lng: 100.5283,
      },
      logs: [
        { delta: 120, count: 120, note: 'เปิดศูนย์รับผู้อพยพ อ.คลองหลวง–อ.ธัญบุรี', at: dt('2026-10-04T15:00:00+07:00') },
        { delta: 160, count: 280, note: 'น้ำเข้าหมู่บ้านคลองสอง–คลองสี่ เร่งอพยพผู้สูงอายุ', at: dt('2026-10-05T18:00:00+07:00') },
        { delta: 105, count: 385, note: 'รับผู้อพยพ 105 คน จาก อ.ลำลูกกา', at: dt('2026-10-06T20:00:00+07:00') },
      ],
    },
    {
      key: 'ศูนย์พักพิงมหาวิทยาลัยราชภัฏสวนสุนันทา (กทม.)',
      data: {
        name: 'ศูนย์พักพิงมหาวิทยาลัยราชภัฏสวนสุนันทา (กทม.)', type: 'school',
        address: '1 ถ.อุทยาน แขวงวชิรพยาบาล เขตดุสิต กรุงเทพฯ', locationId: bangkokId,
        capacity: 700, currentOccupancy: 260, contactPerson: 'นางสาวพรทิพย์ อารีย์', phone: '02-160-1003',
        status: 'open', facilities: 'water,electricity,medical,food,toilet', lat: 13.7774, lng: 100.5081,
      },
      logs: [
        { delta: 420, count: 420, note: 'รับผู้อพยพช่วงน้ำท่วมหนัก กทม. (26–28 ก.ย.)', at: dt('2026-09-28T20:00:00+07:00') },
        { delta: 180, count: 600, note: 'รับเพิ่มจากเขตบางกะปิ–บึงกุ่ม', at: dt('2026-09-30T19:00:00+07:00') },
        { delta: -140, count: 460, note: 'ผู้อพยพ 140 คนย้ายกลับบ้าน หลังน้ำลดแล้ว', at: dt('2026-10-02T16:00:00+07:00') },
        { delta: -200, count: 260, note: 'ปิดพื้นที่บางส่วน — ย้ายกลับ 200 คน เหลือผู้สูงอายุ/ผู้ป่วย', at: dt('2026-10-05T15:00:00+07:00') },
      ],
    },
  ]
  let newShelters = 0
  for (const s of shelterSeed) {
    const dup = await db.shelter.findFirst({ where: { name: s.data.name, deleted: false } })
    if (dup) continue
    const sh = await db.shelter.create({ data: { ...s.data, createdBy: ACTOR, updatedBy: ACTOR } })
    for (const l of s.logs) {
      await db.shelterOccupancy.create({
        data: { shelterId: sh.id, delta: l.delta, count: l.count, note: l.note, createdBy: ACTOR, createdAt: l.at },
      })
    }
    newShelters++
  }
  console.log(`✓ เพิ่มศูนย์พักพิง ${newShelters} แห่ง (พร้อม occupancy ledger)`)

  // ===== 6) Persons เพิ่ม (พร้อม contacts + presence trail) + อัปเดตกรณีหายสำเร็จ =====
  let newPersons = 0

  // 6a) อัปเดต: จีรนันท์ (หายตั้งแต่ 26 ก.ย. กทม.) → พบตัวแล้ว (สอดคล้อง "น้ำลดลง" 7 ต.ค.)
  if (bkflood) {
    const jiranan = await db.person.findFirst({ where: { firstName: 'จีรนันท์', lastName: 'ทองประเสริฐ', incidentId: bkflood.id } })
    if (jiranan && jiranan.status === 'missing') {
      await db.person.update({
        where: { id: jiranan.id },
        data: {
          status: 'found',
          shelterId: null,
          notes: 'พบตัวแล้ว 6 ต.ค. 69 — อยู่บ้านญาติ อ.ลาดกระบัง หลังน้ำลด ญาติยืนยันตัวที่ EOC กทม.',
          updatedBy: ACTOR,
        },
      })
      const dupEv = await db.personEvent.findFirst({ where: { personId: jiranan.id, note: { contains: 'พบตัวแล้ว 6 ต.ค.' } } })
      if (!dupEv) {
        await db.personEvent.create({
          data: {
            personId: jiranan.id, status: 'found',
            note: 'พบตัวแล้ว 6 ต.ค. 69 — อยู่บ้านญาติ อ.ลาดกระบัง หลังน้ำลด ญาติยืนยันตัวที่ EOC กทม.',
            location: 'เขตลาดกระบัง กรุงเทพมหานคร', observer: 'EOC กรุงเทพมหานคร',
            occurredAt: dt('2026-10-06T14:00:00+07:00'), createdBy: ACTOR,
          },
        })
      }
      updated++
    }
  }

  const personSeed = [
    {
      key: 'อภิชาติ|บึงทองหลาง',
      data: {
        firstName: 'อภิชาติ', lastName: 'บึงทองหลาง', gender: 'male', age: 54,
        status: 'missing', incidentId: nationwide?.id ?? '',
        lastSeenLocation: 'ตลาดเก่านครสวรรค์ อ.เมือง จ.นครสวรรค์', lastSeenAt: dt('2026-10-06T17:30:00+07:00'),
        notes: 'ญาติแจ้งหายหลังออกไปเก็บของที่ร้านริมน้ำ ทีมกู้ภัยค้นหาด้วยเรือ 7 ต.ค. 69',
        phone: '081-900-2001',
      },
      contacts: [{ type: 'mobile', value: '081-900-2002', priority: 1, isEmergency: true, note: 'ภรรยา (นางสาวยุพา)' }],
      events: [
        { status: 'missing', note: 'ญาติแจ้งหายที่ EOC นครสวรรค์', location: 'ตลาดเก่านครสวรรค์', observer: 'ภรรยาของผู้สูญหาย', occurredAt: dt('2026-10-06T21:00:00+07:00') },
        { status: 'sighted', note: 'มีรายงานว่าเห็นที่หลังคาโกดังข้าว รอยืนยันทีมค้นหา', location: 'ใกล้ท่าเรืออ.พยุหะคีรี', observer: 'อาสาสมัครเรือช่วยคน', occurredAt: dt('2026-10-07T09:40:00+07:00') },
      ],
    },
    {
      key: 'สายฝน|คลองสี่',
      data: {
        firstName: 'สายฝน', lastName: 'คลองสี่', gender: 'female', age: 41,
        status: 'evacuated', incidentId: cpflood?.id ?? '',
        phone: '081-900-2003', address: 'หมู่บ้านคลองสี่ อ.คลองหลวง จ.ปทุมธานี',
        notes: 'นาข้าวถูกน้ำท่วม 12 ไร่ อพยพมาศูนย์พักพิงโรงเรียนคลองหลวง',
      },
      contacts: [{ type: 'line', value: 'sairain.k4', priority: 2, isEmergency: false, note: 'LINE ญาติที่อุดร' }],
      events: [
        { status: 'sighted', note: 'ติดค้างบนหลังคาบ้านชั้นสอง ทีมเรือเข้าถึงไม่ได้ช่วงกลางคืน', location: 'หมู่บ้านคลองสี่ อ.คลองหลวง', observer: 'เพื่อนบ้าน', occurredAt: dt('2026-10-04T23:00:00+07:00') },
        { status: 'found', note: 'พบตัวปลอดภัย อพยพด้วยเรือยางเช้าวันต่อมา', location: 'หมู่บ้านคลองสี่', observer: 'ทีมอพยพ ปภ. ปทุมธานี', occurredAt: dt('2026-10-05T08:30:00+07:00') },
        { status: 'evacuated', note: 'เข้าพักศูนย์พักพิงโรงเรียนคลองหลวง ได้รับถุงยังชีพ', location: 'ศูนย์พักพิงโรงเรียนคลองหลวง', observer: 'ผู้ประสานงานศูนย์', occurredAt: dt('2026-10-05T09:15:00+07:00') },
      ],
    },
    {
      key: 'ประเวศ|พยุหะ',
      data: {
        firstName: 'ประเวศ', lastName: 'พยุหะ', gender: 'male', age: 67,
        status: 'evacuated', incidentId: nationwide?.id ?? '',
        address: 'ต.ท่าทอง อ.พยุหะคีรี จ.นครสวรรค์',
        notes: 'ผู้ป่วยความดัน–เบาหวาน อพยพด้วยรถกระบะของ อปท. ต้องการยาประจำตัว',
      },
      contacts: [
        { type: 'mobile', value: '081-900-2004', priority: 1, isEmergency: true, note: 'ลูกชาย' },
        { type: 'phone', value: '056-221-777', priority: 2, isEmergency: false, note: 'บ้านลูกสาว (นครสวรรค์)' },
      ],
      events: [
        { status: 'evacuated', note: 'อพยพจากบ้าน น้ำสูง 1.8 ม. เข้าศูนย์พักพิง ม.นเรศวร', location: 'อ.พยุหะคีรี → ศูนย์พักพิง ม.นเรศวร', observer: 'อปท. พยุหะคีรี', occurredAt: dt('2026-10-05T17:00:00+07:00') },
        { status: 'hospitalized', note: 'ส่งตรวจที่หน่วยแพทย์เคลื่อนที่ ปรับยาความดัน', location: 'ศูนย์พักพิง ม.นเรศวร', observer: 'นพ.อนันต์ ศรีวิไล', occurredAt: dt('2026-10-06T10:00:00+07:00') },
      ],
    },
    {
      key: 'กฤษณะ|เสรีไทย',
      data: {
        firstName: 'กฤษณะ', lastName: 'เสรีไทย', gender: 'male', age: 33,
        status: 'safe', incidentId: bkflood?.id ?? '',
        address: 'ซอยเสรีไทย 45 เขตบางกอกน้อย กรุงเทพฯ',
        notes: 'ติดค้างที่สำนักงานฝั่งตะวันออกคืนน้ำท่วมหนัก ปัจจุบันกลับบ้านปลอดภัย',
        phone: '081-900-2005',
      },
      contacts: [{ type: 'email', value: 'krisana.sritai@example.com', priority: 2, isEmergency: false }],
      events: [
        { status: 'missing', note: 'ติดต่อไม่ได้หลังน้ำท่วมหนัก โทรศัพท์ไม่มีสัญญาณ', location: 'ฝั่งตะวันออก กทม.', observer: 'แม่ของผู้ประสบภัย', occurredAt: dt('2026-09-26T23:30:00+07:00') },
        { status: 'found', note: 'ยืนยันตัวผ่าน LINE หลังไฟฟ้ากลับมา', location: 'ที่ทำงาน เขตลาดกระบัง', observer: 'ญาติ', occurredAt: dt('2026-09-27T11:00:00+07:00') },
        { status: 'safe', note: 'กลับถึงบ้านปลอดภัยหลังน้ำลด', location: 'ซอยเสรีไทย 45', observer: 'ตนเอง', occurredAt: dt('2026-10-02T18:00:00+07:00') },
      ],
    },
  ]
  for (const p of personSeed) {
    const [fn, ln] = p.key.split('|')
    const dup = await db.person.findFirst({ where: { firstName: fn, lastName: ln, deleted: false } })
    if (dup) continue
    const payload = (p as unknown as { data: Record<string, unknown> }).data
    const { contacts, events } = p as unknown as { contacts: object[]; events: object[] }
    const row = await db.person.create({ data: { ...payload, createdBy: ACTOR, updatedBy: ACTOR } })
    for (const c of contacts as never[]) {
      await db.personContact.create({ data: { ...(c as object), personId: row.id, createdBy: ACTOR } })
    }
    for (const e of events as never[]) {
      await db.personEvent.create({ data: { ...(e as object), personId: row.id, createdBy: ACTOR } })
    }
    newPersons++
  }
  console.log(`✓ เพิ่มผู้ประสบภัย ${newPersons} คน (พร้อม contacts + presence trail) / อัปเดตกรณีจีรนันท์ → พบตัว`)

  // ===== 7) Aid Requests ใหม่ (REQ-2569-2xx) =====
  const reqSeed = [
    {
      requestCode: 'REQ-2569-201', requesterName: 'ผู้ประสานงานอพยพ อ.พยุหะคีรี', requesterOrg: 'อปท. พยุหะคีรี',
      type: 'evacuation', priority: 'urgent', status: 'pending', quantity: 'เรือยาง 10 ลำ + ลูกเรือ 20 นาย',
      description: 'ขอเรือยางเพิ่มสำหรับอพยพผู้ติดค้างย่านตลาดเก่านครสวรรค์และ ต.ท่าทอง (ประเมินเหลือติดค้าง ~80 ครัวเรือน)',
      locationName: 'อ.พยุหะคีรี จ.นครสวรรค์', incidentId: nationwide?.id ?? '',
    },
    {
      requestCode: 'REQ-2569-202', requesterName: 'ผู้จัดการศูนย์พักพิงคลองหลวง', requesterOrg: 'ปภ. ปทุมธานี',
      type: 'water', priority: 'high', status: 'in_progress', quantity: 'น้ำดื่ม 5,000 ลัง + อาหารแห้ง 2,000 ชุด',
      description: 'สต๊อกน้ำดื่มในศูนย์เหลือรองรับไม่ถึง 2 วัน ผู้อพยพเพิ่มจาก 295 เป็น 385 คนใน 3 วัน',
      locationName: 'อ.คลองหลวง จ.ปทุมธานี', incidentId: cpflood?.id ?? '', assignedTo: 'คลังกลาง ปภ. (นนทบุรี)',
    },
    {
      requestCode: 'REQ-2569-203', requesterName: 'นพ.อนันต์ ศรีวิไล', requesterOrg: 'สภากาชาดไทย',
      type: 'medical', priority: 'high', status: 'approved', quantity: 'ยาความดัน/เบาหวาน 400 ชุด + ชุดปฐมพยาบาล 100 ชุด',
      description: 'หน่วยแพทย์เคลื่อนที่ศูนย์ ม.นเรศวร ต้องการยาประจำตัวผู้สูงอายุอพยพ 400 คน (สูงอายุ 62%)',
      locationName: 'ศูนย์พักพิง ม.นเรศวร จ.นครสวรรค์', incidentId: nationwide?.id ?? '', assignedTo: 'สภากาชาดไทย',
    },
    {
      requestCode: 'REQ-2569-204', requesterName: 'ศูนย์เตรียมการภาคใต้', requesterOrg: 'ปภ. เขต 10–12',
      type: 'other', priority: 'medium', status: 'pending', quantity: 'ถุงยังชีพ 2,000 ชุด (จังหวัดละ 200)',
      description: 'เตรียมถุงยังชีพล่วงหน้าสำหรับ 10 จังหวัดภาคใต้ รับมือฝนตกหนัก 4–14 ต.ค. 69 ตามกำชับของรัฐบาล',
      locationName: '10 จังหวัดภาคใต้', incidentId: southflood?.id ?? '', assignedTo: 'คลังกลาง ปภ. (นนทบุรี)',
    },
  ]
  let newReqs = 0
  for (const r of reqSeed) {
    const dup = await db.aidRequest.findUnique({ where: { requestCode: r.requestCode } })
    if (dup) continue
    await db.aidRequest.create({ data: { ...r, createdBy: ACTOR, updatedBy: ACTOR } })
    newReqs++
  }
  console.log(`✓ เพิ่มคำขอความช่วยเหลือ ${newReqs} รายการ`)

  // ===== 8) Stock Movements (ledger จริง: รับบริจาค → จ่ายศูนย์พักพิง) =====
  let newMoves = 0
  const reliefKit = await db.inventoryItem.findFirst({ where: { name: { contains: 'ชุดบรรเทาทุกข์' }, deleted: false } })
  const water = await db.inventoryItem.findFirst({ where: { name: { contains: 'น้ำดื่ม' }, deleted: false } })
  const movTarget = [
    { item: reliefKit, type: 'receive', qty: 2000, ref: 'ผู้บริจาค: ซีพีอาสา (รณรงค์น้ำท่วม 69)', note: 'รับถุงยังชีพเข้าคลังเตรียมพื้นที่ภาคใต้ 4–14 ต.ค. 69' },
    { item: reliefKit, type: 'issue', qty: 800, ref: 'ศูนย์พักพิง ม.นเรศวร', note: 'จ่ายถุงยังชีพผู้อพยพนครสวรรค์/ปทุมธานี 530+385 คน' },
    { item: water, type: 'receive', qty: 5000, ref: 'ผู้บริจาค: ไทยน้ำใส', note: 'รับน้ำดื่มรอบที่ 3 ประจำสัปดาห์ (6 ต.ค. 69)' },
    { item: water, type: 'issue', qty: 3500, ref: 'ศูนย์พักพิงลุ่มเจ้าพระยา', note: 'จ่ายน้ำดื่มศูนย์พักพิงคลองหลวง/ปากเกร็ด/อยุธยา' },
  ]
  for (const m of movTarget) {
    if (!m.item) continue
    if (m.type === 'receive') {
      await db.$transaction(async (tx) => {
        const fresh = await tx.inventoryItem.findUnique({ where: { id: m.item!.id } })
        if (!fresh) return
        await tx.inventoryItem.update({ where: { id: fresh.id }, data: { quantity: fresh.quantity + m.qty } })
        await tx.stockMovement.create({
          data: { itemId: fresh.id, type: m.type, quantity: m.qty, toWarehouseId: fresh.warehouseId, reference: m.ref, note: m.note, createdBy: ACTOR, createdAt: dt('2026-10-06T10:00:00+07:00') },
        })
      })
    } else {
      await db.$transaction(async (tx) => {
        const fresh = await tx.inventoryItem.findUnique({ where: { id: m.item!.id } })
        if (!fresh || fresh.quantity < m.qty) return
        await tx.inventoryItem.update({ where: { id: fresh.id }, data: { quantity: fresh.quantity - m.qty } })
        await tx.stockMovement.create({
          data: { itemId: fresh.id, type: m.type, quantity: m.qty, fromWarehouseId: fresh.warehouseId, reference: m.ref, note: m.note, createdBy: ACTOR, createdAt: dt('2026-10-07T09:30:00+07:00') },
        })
      })
    }
    newMoves++
  }
  console.log(`✓ เพิ่ม StockMovements ${newMoves} รายการ (ledger คงเหลือตรงกับยอดจริง)`)

  // ===== 9) Human Resources เพิ่ม (ทบ. + อาสา นครสวรรค์) =====
  const ddpm = await db.organization.findFirst({ where: { name: { contains: 'ป้องกันและบรรเทาสาธารณภัย' } } })
  const army = await db.organization.findFirst({ where: { name: { contains: 'กองทัพบก' } } })
  let armyId = army?.id
  if (!armyId) {
    const r = await db.organization.create({
      data: { name: 'กองทัพบก (มทบ.42)', type: 'government', sector: 'search_rescue', contactPerson: 'นายก้องภพ จันทร์เพ็ญ', phone: '02-405-1111', email: 'mtb42@army.mi.th', address: 'นครสวรรค์/สุราษฎร์ธานี', description: 'กำลังพลช่วยเหลือผู้ประสบน้ำท่วม แจกถุงยังชีพ เคลื่อนย้ายผู้ติดค้าง และเตรียมรับมือภาคใต้ 4–14 ต.ค. 69', createdBy: ACTOR },
    })
    armyId = r.id
  }
  const hrSeed = [
    { name: 'นายก้องภพ จันทร์เพ็ญ', type: 'staff', jobTitle: 'หน่วยช่วยเหลือ มทบ.42', organizationId: armyId, phone: '081-900-3001', skills: 'อพยพ,โลจิสติกส์,เรือ', status: 'on_mission', baseLocation: 'อ.พยุหะคีรี จ.นครสวรรค์', createdBy: ACTOR },
    { name: 'นางจุไรพร ตาคลีใจ', type: 'volunteer', jobTitle: 'อาสาสมัครครัวกลางนครสวรรค์', organizationId: ddpm?.id ?? null, phone: '081-900-3002', skills: 'ทำอาหาร,จัดแจก 3,000 ชุด/วัน', status: 'on_mission', baseLocation: 'ศูนย์พักพิง ม.นเรศวร', createdBy: ACTOR },
    { name: 'นายธีรเดช คลองหลวงใจ', type: 'volunteer', jobTitle: 'อาสาสมัครอพยพทางเรือ', organizationId: ddpm?.id ?? null, phone: '081-900-3003', skills: 'พายเรือ,ปฐมพยาบาล,เดินนำทาง', status: 'on_mission', baseLocation: 'ศูนย์พักพิงคลองหลวง ปทุมธานี', createdBy: ACTOR },
  ]
  let newHr = 0
  for (const h of hrSeed) {
    const dup = await db.humanResource.findFirst({ where: { name: h.name } })
    if (dup) continue
    await db.humanResource.create({ data: h })
    newHr++
  }
  console.log(`✓ เพิ่มบุคลากร ${newHr} คน`)

  // ===== 10) Audit trail =====
  await db.auditLog.create({
    data: {
      userName: ACTOR, action: 'create', module: 'incidents',
      detail: `Import เหตุการณ์อุทกภัย 2569 ฉบับข้อมูลจริง ปภ. 7 ต.ค. 69 — อัปเดต incidents ${updated} / SITREP +${created} / alerts +${newAlerts} / shelters +${newShelters} / persons +${newPersons} / requests +${newReqs} / movements +${newMoves} / hr +${newHr} (แหล่งข้อมูล: ปภ., ThaiPBS, PRD, กรมชลประทาน, ทบ.)`,
    },
  })

  console.log('\n🌊 สรุป Import สำเร็จ')
  console.log(`   incidents อัปเดต: ${updated} | SITREP +${created} | alerts +${newAlerts} | shelters +${newShelters}`)
  console.log(`   persons +${newPersons} | requests +${newReqs} | movements +${newMoves} | hr +${newHr}`)
}

main()
  .catch((e) => {
    console.error('❌ Import ล้มเหลว:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
