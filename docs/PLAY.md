# เล่นบนเว็บ

**https://elixirmvii.github.io/Poke-defense/** — เปิดใช้งานแล้ว

> ตัว `P` ใหญ่ใน path ด้วย — URL ของ Pages แยกตัวพิมพ์ใหญ่เล็ก

## อัปเดตเว็บหลังแก้โค้ด

เว็บเสิร์ฟจาก branch **`gh-pages`** ไม่ใช่ `main`

```bash
git push origin main
git push origin main:gh-pages    # อันนี้คืออันที่ทำให้เว็บเปลี่ยน
```

## เล่นบน iPad / iPhone

เปิดลิงก์ด้วย Safari แล้วกดปุ่มแชร์ → **เพิ่มลงในหน้าจอโฮม**
จะได้ไอคอนเปิดแบบเต็มจอเหมือนแอป และช่วยให้ Safari ไม่ล้างเซฟทิ้ง

การเล่นด้วยการแตะรองรับครบแล้ว:
- **ซาฟารี** — แตะช่องที่อยากไป ตัวละครเดินไปเอง (ไม่ต้องใช้ลูกศร)
- **สนามรบ** — แตะตัวในทีม แล้วแตะบนสนามเพื่อวาง มีปุ่มยกเลิกให้กด
- **ดูข้อมูลตัว** — แตะการ์ดในโปเกเด็กซ์เพื่อเปิดหน้าต่างข้อมูล

## ทำไมถึงใช้ branch ชื่อ gh-pages

ตอนตั้งค่าครั้งแรก ลองมาสองทางแล้วไม่ผ่าน:

- **Actions workflow** ที่เรียก `actions/configure-pages` พร้อม `enablement: true`
  → `Resource not accessible by integration` (GITHUB_TOKEN ไม่มีสิทธิ์สร้าง Pages site)
- **เรียก REST API ตรง ๆ** `POST /repos/:owner/:repo/pages`
  → ถูกบล็อกที่ชั้น proxy ไม่ได้ออกไปถึง GitHub ด้วยซ้ำ

ทางที่ได้ผลคือ push branch ชื่อ `gh-pages` ขึ้นไป ซึ่ง GitHub จะเปิด Pages
ให้อัตโนมัติเมื่อเจอ branch ชื่อนี้ครั้งแรก (พฤติกรรมเดิมที่ยังใช้ได้อยู่)

ถ้าอยากย้ายไปเสิร์ฟจาก `main` แทน: Settings → Pages → เปลี่ยน Branch เป็น `main`
แล้วลบ branch `gh-pages` ทิ้งได้เลย
