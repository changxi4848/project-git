import io
p = "D:/03_code_list/project-git-项目知识时间轴/engine.py"
s = io.open(p, encoding="utf-8").read()

s = s.replace(
    '''    "decision": ["定了", "就按", "决定", "改为", "改成", "统一为", "暂停", "不做",
                 "批准", "拍板", "确认用", "切换到", "取消", "同意", "上线吧", "就用"],''',
    '''    "decision": ["定了", "就按", "决定", "改为", "改成", "统一为", "暂停", "不做",
                 "批准", "拍板", "确认用", "切换到", "取消", "同意", "上线吧", "就用",
                 "延长到", "定为", "不再", "别再加", "就算了", "提前", "锁定"],''')

old = """    conf = 0.50 * t_strength + 0.30 * p_score + 0.20 * parent_score
    conf = round(min(0.98, max(0.05, conf)), 3)"""
new = """    conf = 0.45 * t_strength + 0.30 * p_score + 0.25 * parent_score
    # 类型与项目都很确定时，给一个“双重确定”加成（避免明明很清楚却进队列）
    if t_strength >= 0.8 and p_score >= 0.8:
        conf += 0.08
    conf = round(min(0.98, max(0.05, conf)), 3)"""
assert old in s
s = s.replace(old, new)
io.open(p, "w", encoding="utf-8").write(s)

p2 = "D:/03_code_list/project-git-项目知识时间轴/seedgen.py"
s2 = io.open(p2, encoding="utf-8").read()
s2 = s2.replace('"keywords": ["定价", "报价", "阶梯", "客单价", "A 方案", "B 方案", "灰度", "锚点", "商家"]',
                '"keywords": ["定价", "报价", "阶梯", "客单价", "A 方案", "B 方案", "灰度", "锚点", "商家", "跨境", "垫资", "回款"]')
s2 = s2.replace('"keywords": ["大促", "双十一", "预算", "GMV", "主推", "品类", "返场", "活动"]',
                '"keywords": ["大促", "双十一", "预算", "GMV", "主推", "品类", "返场", "活动", "投产比", "复购"]')
s2 = s2.replace('"keywords": ["口径", "转化率", "埋点", "指标", "标签", "归因", "看板"]',
                '"keywords": ["口径", "转化率", "埋点", "指标", "标签", "归因", "看板", "双跑", "v2", "长尾"]')
io.open(p2, "w", encoding="utf-8").write(s2)
print("patched")
