import io
p = r"tools\design_a2.py"
s = io.open(p, encoding="utf-8").read()
# 拉开前三个决策，避免标签相撞
s = s.replace('(1.55, "让 NEO 冒充 Elite"', '(1.60, "让 NEO 冒充 Elite"')
s = s.replace('(3.05, "先走 HID 流"', '(3.55, "先走 HID 流"')
s = s.replace('(4.55, "放弃 HID，改 GATT"', '(5.55, "放弃 HID，改 GATT"')
s = s.replace('(7.55, "冒用 productKey"', '(8.40, "冒用 productKey"')
s = s.replace('(10.9, "锁定基线 b6677ef"', '(11.30, "锁定基线 b6677ef"')
s = s.replace('(13.9, "改板：加外部天线"', '(14.10, "改板：加外部天线"')
# 连线标注跟着挪
s = s.replace('(2.30, "按 Plus 的 HID 试")', '(2.60, "按 Plus 的 HID 试")')
s = s.replace('(3.80, "卡在「正在连接」")', '(4.55, "卡在「正在连接」")')
s = s.replace('(6.05, "GATT 能连，机型不对")', '(7.00, "GATT 能连，机型不对")')
s = s.replace('(9.20, "能跑了，先固化")', '(9.85, "能跑了，先固化")')
s = s.replace('(12.40, "天线衰减 12dB")', '(12.70, "天线衰减 12dB")')
s = s.replace('ax.text(3.80, TRUNK_Y - 0.18, "取代"', 'ax.text(4.55, TRUNK_Y - 0.18, "取代"')
# 决策标签略小
s = s.replace('label2(x, TRUNK_Y - 0.30, name, sub, size=10', 'label2(x, TRUNK_Y - 0.30, name, sub, size=9.6')
# 方案/资源整体跟着挪
s = s.replace('(1.55, "方案 v1"', '(1.60, "方案 v1"')
s = s.replace('(4.55, "GATT 直连方案"', '(5.55, "GATT 直连方案"')
s = s.replace('(7.55, "身份帧方案"', '(8.40, "身份帧方案"')
s = s.replace('(10.9, "基线复盘"', '(11.30, "基线复盘"')
s = s.replace('(13.9, "PCB v1"', '(14.10, "PCB v1"')
s = s.replace('(1.55, [("doc", "试错记录"', '(1.60, [("doc", "试错记录"')
s = s.replace('(7.55, [("data", "身份帧样本"', '(8.40, [("data", "身份帧样本"')
s = s.replace('(10.9, [("doc", "交接文档"', '(11.30, [("doc", "交接文档"')
s = s.replace('(13.9, [("code", "中转站 PCB 工程"', '(14.10, [("code", "中转站 PCB 工程"')
io.open(p, "w", encoding="utf-8").write(s)
print("ok")
