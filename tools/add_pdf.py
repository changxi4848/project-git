import io, json
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import ParagraphStyle

pdfmetrics.registerFont(TTFont("YaHei", r"C:\Windows\Fonts\msyh.ttc"))
st = ParagraphStyle("s", fontName="YaHei", fontSize=11, leading=20)
doc = SimpleDocTemplate("data/files/中继底座-试错记录.pdf", pagesize=A4,
                        leftMargin=60, rightMargin=60, topMargin=60, bottomMargin=60)
doc.build([Paragraph(p, st) for p in [
    "中继底座 · 试错记录（PDF 版）",
    "一、目的",
    "把每一次尝试的结果和证据留下来，避免以后重复踩坑。",
    "二、关键结论",
    "广播名 TourBox Elite + 厂商 01 + 无 HID：Windows Console 可用，这是稳定基线（git b6677ef）。",
    "广播名改 TourBox Elite Plus：Windows 卡在「正在连接」，Console 按名字分流到 HID 流。",
    "三、我们放弃的路线",
    "真注册 HID 服务（0x1812）：仍卡住，说明我们的 HID 描述符不完整。",
]])

# 给 relay 项目加一个 PDF 节点
p = "data/state.json"
s = json.load(io.open(p, encoding="utf-8"))
if not any(n["id"] == "r_pdf" for n in s["nodes"]):
    s["nodes"].append({
        "id": "r_pdf", "project": "p_relay", "type": "doc",
        "title": "试错记录（PDF 版）", "summary": "把 44 条试错整理成可打印的 PDF",
        "content_at": "2026-11-18", "ingest_at": "2026-11-22T23:00",
        "status": "active", "confidence": 0.95, "auto": False, "placement": "grow",
        "source": {"file": "中继底座-试错记录.pdf",
                   "locator": {"kind": "pdf", "page": 2, "rect": [60, 300, 520, 360]},
                   "excerpt": "广播名改 TourBox Elite Plus"},
        "extra": {"要点": "归档版"}, "parent": "r2",
    })
    s["edges"].append({"from": "r_pdf", "to": "r2", "kind": "derived"})
json.dump(s, io.open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
io.open("desktop/seed/state.json", "w", encoding="utf-8").write(io.open(p, encoding="utf-8").read())
print("pdf node added")
