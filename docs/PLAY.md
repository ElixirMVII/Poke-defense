# เปิดให้เล่นบนเว็บ (GitHub Pages)

เกมเป็นไฟล์นิ่งล้วน ไม่ต้อง build ไม่ต้องมี workflow — เปิด Pages ชี้มาที่ branch ได้เลย

1. เข้า **Settings** ของรีโปนี้
2. เมนูซ้าย เลือก **Pages**
3. หัวข้อ *Build and deployment* → **Source: Deploy from a branch**
4. **Branch: `main`** · โฟลเดอร์ **`/ (root)`** → กด **Save**
5. รอสักครู่ (ครั้งแรกประมาณ 1–2 นาที) จะได้ลิงก์

```
https://elixirmvii.github.io/Poke-defense/
```

> ตัว `P` ใหญ่ใน path ด้วย — URL ของ Pages แยกตัวพิมพ์ใหญ่เล็ก

## เล่นบน iPad / iPhone

เปิดลิงก์ด้วย Safari แล้วกดปุ่มแชร์ → **เพิ่มลงในหน้าจอโฮม**
จะได้ไอคอนเปิดแบบเต็มจอเหมือนแอป และช่วยให้ Safari ไม่ล้างเซฟทิ้ง

การเล่นด้วยการแตะรองรับครบแล้ว:
- **ซาฟารี** — แตะช่องที่อยากไป ตัวละครเดินไปเอง (ไม่ต้องใช้ลูกศร)
- **สนามรบ** — แตะตัวในทีม แล้วแตะบนสนามเพื่อวาง มีปุ่มยกเลิกให้กด
- **ดูข้อมูลตัว** — แตะการ์ดในโปเกเด็กซ์เพื่อเปิดหน้าต่างข้อมูล

## ทำไมไม่ใช้ GitHub Actions

เคยลองใส่ workflow ที่เปิด Pages ให้อัตโนมัติแล้ว แต่ GITHUB_TOKEN ของรีโปนี้
ไม่มีสิทธิ์สร้าง Pages site (`Resource not accessible by integration`)
ซึ่งต้องไปเปิดสิทธิ์ที่ Settings อยู่ดี — เลยตัดออกเพราะจำนวนขั้นตอนเท่ากันแต่พังง่ายกว่า

ถ้าอยากใช้ Actions จริง ๆ: Settings → Actions → General → Workflow permissions
เลือก **Read and write permissions** แล้วค่อยใส่ workflow กลับเข้าไป
