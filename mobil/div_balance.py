from pathlib import Path

path = Path("src/pages/Anbar.tsx")
text = path.read_text(encoding="utf-8").splitlines()

stack = []
for lineno, line in enumerate(text, 1):
    idx = 0
    while True:
        idx = line.find("<div", idx)
        if idx == -1:
            break
        stack.append(lineno)
        idx += 4
    idx = 0
    while True:
        idx = line.find("</div>", idx)
        if idx == -1:
            break
        if stack:
            stack.pop()
        idx += 6

print("Unmatched <div> opening lines:", stack)
print("Total unmatched:", len(stack))


