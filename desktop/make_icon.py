# -*- coding: utf-8 -*-
"""生成应用图标：暗色圆角方块 + 关系图谱（点与线）"""
import os
from PIL import Image, ImageDraw

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

r = int(S * 0.22)
# 底：深色圆角方块
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=(22, 23, 28, 255))

ACC = (139, 124, 246)
RED = (224, 108, 98)
BLUE = (90, 169, 214)
GREEN = (127, 176, 105)
GREY = (141, 154, 168)


def P(x, y):
    return (x * S, y * S)


pts = {"a": P(0.30, 0.64), "b": P(0.50, 0.36), "c": P(0.73, 0.54),
       "d": P(0.60, 0.75), "e": P(0.35, 0.30)}

LW = int(S * 0.017)
d.line([pts["e"], pts["b"]], fill=(255, 255, 255, 55), width=LW)
d.line([pts["a"], pts["b"]], fill=(255, 255, 255, 65), width=LW)
d.line([pts["b"], pts["c"]], fill=(255, 255, 255, 65), width=LW)
d.line([pts["a"], pts["d"]], fill=(255, 255, 255, 50), width=LW)
d.line([pts["d"], pts["c"]], fill=RED + (230,), width=int(LW * 1.6))


def dot(k, rad, color, ring=True):
    x, y = pts[k]
    if ring:
        d.ellipse([x - rad - S * 0.012, y - rad - S * 0.012,
                   x + rad + S * 0.012, y + rad + S * 0.012], fill=(22, 23, 28, 255))
    d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=color)


dot("a", S * 0.075, BLUE)
dot("b", S * 0.088, ACC)
dot("c", S * 0.078, RED)
dot("d", S * 0.062, GREEN)
dot("e", S * 0.050, GREY)

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
os.makedirs(out_dir, exist_ok=True)
img.save(os.path.join(out_dir, "icon.png"))
img.save(os.path.join(out_dir, "icon.ico"), format="ICO",
         sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print("ok")
