import fs from 'fs';
const path = 'src/components/CharacterModal.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/className=\{\`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer \$\{\n\s*isSelected\n\s*\? 'bg-black\/90 border-\[#fbbf24\] shadow-\[0_0_15px_rgba\(251,191,36,0\.25\)\] ring-1 ring-\[#fbbf24\]'\n\s*: 'bg-black\/50 border-gray-800 hover:border-gray-700'\n\s*\}\`\}\n\s*>\nclassName=\{\`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer \$\{\n\s*isSelected\n\s*\? 'bg-black\/90 border-\[#fbbf24\] shadow-\[0_0_15px_rgba\(251,191,36,0\.25\)\] ring-1 ring-\[#fbbf24\]'\n\s*: 'bg-black\/50 border-gray-800 hover:border-gray-700'\n\s*\}\`\}\n\s*>/m, 
`className={\`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer \${
                        isSelected
                          ? 'bg-black/90 border-[#fbbf24] shadow-[0_0_15px_rgba(251,191,36,0.25)] ring-1 ring-[#fbbf24]'
                          : 'bg-black/50 border-gray-800 hover:border-gray-700'
                      }\`}
                    >`);

// Fix missing imports if any
if (!code.includes('AlertCircle')) {
  code = code.replace(/import \{([\s\S]*?)Compass,/m, 'import { AlertCircle, $1Compass,');
}

fs.writeFileSync(path, code);
