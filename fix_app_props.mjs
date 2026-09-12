import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `          onOpenParty={() => setIsPartyOpen(true)}
          onOpenGuild={() => setIsGuildOpen(true)}
          onOpenAuctionHouse={() => setIsAuctionHouseOpen(true)}
          onOpenServerConsole={() => setIsServerConsoleOpen(true)}`;

code = code.replace(/          onOpenParty=\{\(\) => setIsPartyOpen\(true\)\}\n          onOpenGuild=\{\(\) => setIsGuildOpen\(true\)\}\n          onOpenServerConsole=\{\(\) => setIsServerConsoleOpen\(true\)\}/, replacement);
fs.writeFileSync('src/App.tsx', code);
