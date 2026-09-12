import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `          onOpenMap={() => setIsMapOpen(true)}
          onOpenParty={() => setIsPartyOpen(true)}
          onOpenCrafting={() => setIsCraftingOpen(true)}
          onOpenDungeonFinder={() => setIsDungeonFinderOpen(true)}
          onOpenAuctionHouse={() => setIsAuctionHouseOpen(true)}
          onTalkToNPC={() => setIsDialogueOpen(true)}`;

code = code.replace(/          onOpenMap=\{[\s\S]*?onTalkToNPC=\{/m, replacement + "\n          onTalkToNPC={");
fs.writeFileSync('src/App.tsx', code);
