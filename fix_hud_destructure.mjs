import fs from 'fs';
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

code = code.replace(/  onCycleTarget,\n  onCastSkill,\n\}\) => \{/, "  onCycleTarget,\n  onCastSkill,\n  onTriggerDodge,\n  onVirtualMove,\n}) => {");

fs.writeFileSync('src/components/GameHUD.tsx', code);
