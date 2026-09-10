import fs from 'fs';
const path = 'src/components/CharacterModal.tsx';
let code = fs.readFileSync(path, 'utf8');

// I will just use prettier or something to check? No, I'll write a simple brace counter.
let depth = 0;
for(let i=0; i<code.length; i++) {
  if (code[i] === '{') depth++;
  if (code[i] === '}') depth--;
}
console.log("Brace depth:", depth);

let divDepth = 0;
for(let i=0; i<code.length - 4; i++) {
  if (code.substring(i, i+4) === '<div') divDepth++;
  if (code.substring(i, i+5) === '</div') divDepth--;
}
console.log("Div depth:", divDepth);
