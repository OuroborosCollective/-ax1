import fs from 'fs';
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

const targetStr = `  onOpenInventory: () => void;
  onOpenCrafting?: () => void;
  onOpenDungeonFinder?: () => void;`;

const replacement = `  onOpenInventory: () => void;
  onOpenCrafting?: () => void;
  onOpenDungeonFinder?: () => void;
  onOpenAuctionHouse?: () => void;`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/components/GameHUD.tsx', code);
