import fs from 'fs';
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

const propsInterface = `export interface GameHUDProps {
  playerStats: PlayerStats;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  onOpenInventory: () => void;
  onOpenCharacter: () => void;
  onOpenClasses: () => void;
  onOpenQuestLog: () => void;
  onOpenMap: () => void;
  onOpenParty: () => void;
  onOpenCrafting?: () => void;
  onOpenDungeonFinder?: () => void;
  onOpenAuctionHouse?: () => void;`;

code = code.replace(/export interface GameHUDProps \{[\s\S]*?onOpenDungeonFinder\?: \(\) => void;/m, propsInterface);

const componentDecl = `export const GameHUD: React.FC<GameHUDProps> = ({
  playerStats,
  health,
  maxHealth,
  mana,
  maxMana,
  onOpenInventory,
  onOpenCharacter,
  onOpenClasses,
  onOpenQuestLog,
  onOpenMap,
  onOpenParty,
  onOpenCrafting,
  onOpenDungeonFinder,
  onOpenAuctionHouse,`;

code = code.replace(/export const GameHUD: React\.FC<GameHUDProps> = \(\{[\s\S]*?onOpenDungeonFinder,/m, componentDecl);

const buttonPatch = `            {onOpenAuctionHouse && (
              <button
                onClick={onOpenAuctionHouse}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black/80 border border-gray-800 hover:border-amber-400 text-amber-400 flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow relative"
                title="Auktionshaus [T]"
              >
                <Coins className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onOpenParty}`;

code = code.replace(/            <button\n              onClick=\{onOpenParty\}/m, buttonPatch);

fs.writeFileSync('src/components/GameHUD.tsx', code);
