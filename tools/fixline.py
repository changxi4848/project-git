import io
p = r"desktop\web\app.js"
s = io.open(p, encoding="utf-8").read()

# 1) 删掉“主干基线”（那条铺在底下的横线）
i1 = s.index("  // 主干基线：一条很淡的横线")
i2 = s.index("  ls.forEach((l) => {")
s = s[:i1] + s[i2:]

# 2) 删掉“主干换行处：直角连接”——所有线一律直线
a1 = s.index("    // 主干换行处：直角连接")
a2 = s.index("    const on = !focus || (focus.has(a.id) && focus.has(b.id));", a1)
s = s[:a1] + s[a2:]

io.open(p, "w", encoding="utf-8").write(s)
print("removed:", "yMid" in s, "byRow" in s)
