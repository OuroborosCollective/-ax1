import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importStatement = `import { GuildManagementModal } from './components/GuildManagementModal';
import { HomesteadBuilderModal } from './components/HomesteadBuilderModal';
import { AuctionHouseModal } from './components/AuctionHouseModal';`;

code = code.replace(/import \{ GuildManagementModal \} from '.\/components\/GuildManagementModal';\nimport \{ HomesteadBuilderModal \} from '.\/components\/HomesteadBuilderModal';/, importStatement);

const stateVars = `  const [isPartyOpen, setIsPartyOpen] = useState(false);
  const [isAuctionHouseOpen, setIsAuctionHouseOpen] = useState(false);`;

code = code.replace(/  const \[isPartyOpen, setIsPartyOpen\] = useState\(false\);/, stateVars);

const keyBindings = `      } else if (key === 'p') {
        e.preventDefault();
        setIsPartyOpen((prev) => !prev);
      } else if (key === 't') {
        e.preventDefault();
        setIsAuctionHouseOpen((prev) => !prev);`;

code = code.replace(/      \} else if \(key === 'p'\) \{\n        e\.preventDefault\(\);\n        setIsPartyOpen\(\(prev\) => !prev\);/, keyBindings);

const renderModal = `      {isPartyOpen && engineRef.current && (
        <PartyModal
          onClose={() => setIsPartyOpen(false)}
          members={partyMembers}
        />
      )}
      
      {isAuctionHouseOpen && engineRef.current && (
        <AuctionHouseModal
          onClose={() => setIsAuctionHouseOpen(false)}
          engine={engineRef.current}
        />
      )}`;

code = code.replace(/      \{isPartyOpen && engineRef\.current && \([\s\S]*?members=\{partyMembers\}\n        \/>\n      \)\}/, renderModal);

fs.writeFileSync('src/App.tsx', code);
