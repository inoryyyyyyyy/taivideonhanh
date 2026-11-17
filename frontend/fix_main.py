with open(r"d:\kiemtienfb\frontend\src\main.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the bad import placement
content = content.replace("import VoiceLibrary from './pages/VoiceLibrary'\n\n// ...\n", "")
# add import at top
content = content.replace("import Academy from './pages/Academy'", "import Academy from './pages/Academy'\nimport VoiceLibrary from './pages/VoiceLibrary'")

with open(r"d:\kiemtienfb\frontend\src\main.tsx", "w", encoding="utf-8") as f:
    f.write(content)
