import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `      } else if (key === 'g') {
        e.preventDefault();
        setIsGuildOpen((prev) => !prev);
      } else if (key === 't') {`;

code = code.replace(/      \} else if \(key === 't'\) \{/, replacement);
fs.writeFileSync('src/App.tsx', code);
