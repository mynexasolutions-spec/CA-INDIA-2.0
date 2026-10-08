import pymupdf, re, os

pdf_path = os.path.expanduser("~/Downloads/All Module.pdf")
out_dir = "mods"
os.makedirs(out_dir, exist_ok=True)

doc = pymupdf.open(pdf_path)
footer_re = re.compile(r"^Page(\d+)\|(\d+)$")

def find_footer(text):
    found = None
    for line in text.splitlines():
        m = footer_re.match(re.sub(r"\s+", "", line))
        if m:
            found = (int(m.group(1)), int(m.group(2)))
    return found

texts = [p.get_text() for p in doc]
foots = [find_footer(t) for t in texts]
total = len(texts)

def title_of(t):
    for l in t.splitlines():
        s = l.strip()
        if len(s) > 3 and not footer_re.match(re.sub(r"\s+", "", s)):
            return s[:60]
    return "?"

print(f"{'Mod':<5}{'Pages':<7}{'PDF pp':<10}{'Check':<14}Title")
s, n = 0, 0
while s < total:
    # first footer at or after s -> gives N and our position k in module
    j = next((x for x in range(s, total) if foots[x]), None)
    if j is None:
        print(f"{n:<5}{total-s:<7}{s+1}-{total:<6}{'NO FOOTER':<14}{title_of(texts[s])}")
        break
    k, N = foots[j]
    check = "ok" if (j - s + 1) == k else f"MISMATCH(k={k},at+{j-s+1})"
    e = min(s + N, total)
    with open(f"{out_dir}/mod_{n:02d}.txt", "w", encoding="utf-8") as fh:
        for i in range(s, e):
            fh.write(f"\n--- pdf page {i+1} ---\n{texts[i]}")
    print(f"{n:<5}{e-s:<7}{s+1}-{e:<6}{check:<14}{title_of(texts[s])}")
    s, n = e, n + 1

print("\nPages covered:", total, "| modules:", n)
