with open(r"d:\kiemtienfb\frontend\src\components\VoiceLibraryModal.tsx", "r", encoding="utf-8") as f:
    c = f.read()
    c = c.replace("import React, { useState, useMemo } from 'react';", "import { useState, useMemo } from 'react';")
    c = c.replace("import { Heart, X, Play, Square, Search, Filter } from 'lucide-react';", "import { Heart, X, Play, Square, Search } from 'lucide-react';")
with open(r"d:\kiemtienfb\frontend\src\components\VoiceLibraryModal.tsx", "w", encoding="utf-8") as f: f.write(c)

with open(r"d:\kiemtienfb\frontend\src\pages\VoiceLibrary.tsx", "r", encoding="utf-8") as f:
    c = f.read()
    c = c.replace("import React, { useState, useEffect, useMemo } from 'react';", "import { useState, useEffect, useMemo } from 'react';")
    c = c.replace("import { Heart, Play, Square, Search, Filter } from 'lucide-react';", "import { Heart, Play, Square, Search } from 'lucide-react';")
with open(r"d:\kiemtienfb\frontend\src\pages\VoiceLibrary.tsx", "w", encoding="utf-8") as f: f.write(c)
