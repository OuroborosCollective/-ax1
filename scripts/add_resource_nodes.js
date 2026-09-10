import fs from 'fs';

const typesPath = 'src/types.ts';
let typesCode = fs.readFileSync(typesPath, 'utf8');

if (!typesCode.includes('export interface ResourceNode')) {
  typesCode += `
export interface ResourceNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  z: number;
  resourceItemId: string;
  requiredProfession: GatheringProfessionId;
  requiredToolCategory: string; // e.g. 'Pickaxe'
  amount: number;
  respawnTimeSeconds: number;
  isDepleted: boolean;
  color: string;
}
`;
  fs.writeFileSync(typesPath, typesCode);
}
