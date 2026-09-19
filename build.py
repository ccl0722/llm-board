# -*- coding: utf-8 -*-
"""
build.py  ·  把 src/ 内联回单文件 index.html

用途：src/ 是便于编辑的拆分源码；根目录 index.html 是可离线双击打开的
     单文件发布版。改完 src/ 后运行本脚本即可重新生成 index.html。

用法：
    python build.py

规则：
    - CSS 按 01-tokens -> 02-layout -> 03-components 顺序内联（顺序即级联优先级）
    - JS  按 data.js -> app.js 顺序内联（app.js 依赖 data.js 暴露的常量）
    - assets/ 保持为外部目录：logo 走相对路径引用，不内联，
      因此 index.html 必须与 assets/ 保持同级，不能单独拎走
    - 额外产出 dist/artifact.html：发布到 claude.ai Artifact 用的版本，
      去掉了外层 <!doctype>/<html>/<head>/<body>（发布平台会自己套），
      其余内容与 index.html 完全一致
    - 不引入任何 fetch：数据直接写在内联的 <script> 里，
      双击 HTML（file:// 协议）也能正常工作
"""

import os
import re
import sys

# Windows 控制台默认是 GBK，路径里有中文时 print 会炸，这里统一转 UTF-8
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')

CSS_FILES = ['css/01-tokens.css', 'css/02-layout.css', 'css/03-components.css']
JS_FILES = ['js/data.js', 'js/app.js']

HEAD_NOTE = (
    '<!-- 由 build.py 从 src/ 生成，请勿直接编辑本文件；'
    '改动请改 src/ 后重新执行 python build.py -->\n'
)


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def main():
    html = read(os.path.join(SRC, 'index.html'))

    # --- CSS：把若干 <link> 合并替换为单个内联 <style> ---
    parts = []
    for rel in CSS_FILES:
        parts.append('\n/* ---------- %s ---------- */\n%s' % (rel, read(os.path.join(SRC, rel)).rstrip()))
    css_block = '<style>' + '\n'.join(parts) + '\n</style>'

    link_re = re.compile(r'(?:<link[^>]*href="css/[^"]*"[^>]*>\s*)+')
    assert link_re.search(html), 'src/index.html 中未找到 css link 标签'
    html = link_re.sub(css_block + '\n', html, count=1)

    # --- JS：逐个把 <script src> 替换回内联 <script> ---
    for rel in JS_FILES:
        js = read(os.path.join(SRC, rel))
        pat = re.compile(r'<script\s+src="%s"\s*></script>' % re.escape(rel))
        assert pat.search(html), 'src/index.html 中未找到 %s 引用' % rel
        html = pat.sub(
            lambda _m, _j=js, _r=rel: '<script>\n/* ---------- %s ---------- */\n%s\n</script>' % (_r, _j.rstrip()),
            html, count=1)

    html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + HEAD_NOTE.rstrip(), 1)

    out = os.path.join(ROOT, 'index.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('built -> %s  (%.1f KB)' % (out, len(html.encode('utf-8')) / 1024.0))

    # --- 再产出一份用于发布到 claude.ai Artifact 的版本 ---
    # 发布平台会自己套上 <!doctype html><head>…</head><body>，所以这份要去掉外层文档标签，
    # 只保留 <title> / <style> / 正文 / <script>。两份内容完全同源，只差这个外壳。
    art = html
    art = re.sub(r'^.*?<head>\s*', '', art, flags=re.S)          # 砍掉 doctype/html/head 开头
    art = re.sub(r'<meta[^>]*charset[^>]*>\s*', '', art)          # 平台已提供
    art = re.sub(r'<meta[^>]*name="viewport"[^>]*>\s*', '', art)  # 平台已提供（含 viewport-fit=cover）
    art = re.sub(r'<link[^>]*rel="icon"[^>]*>\s*', '', art)       # 用发布参数的 icon 代替
    art = re.sub(r'</head>\s*<body>\s*', '', art)
    art = re.sub(r'</body>\s*</html>\s*$', '', art)
    # 文档语言：外层 <html> 由平台生成，这里在脚本里补上
    art = art.replace('<script>', '<script>document.documentElement.lang="zh-CN";</script>\n<script>', 1)
    dist = os.path.join(ROOT, 'dist')
    if not os.path.isdir(dist):
        os.makedirs(dist)
    out2 = os.path.join(dist, 'artifact.html')
    with open(out2, 'w', encoding='utf-8') as f:
        f.write(art.strip() + '\n')
    print('built -> %s  (%.1f KB)' % (out2, len(art.encode('utf-8')) / 1024.0))


if __name__ == '__main__':
    main()
