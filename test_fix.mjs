import fs from 'fs';
let code1 = fs.readFileSync('src/engine/economy/AuctionHouseSystem.ts', 'utf8');
console.log(code1.substring(code1.indexOf('id:'), code1.indexOf('sellerId:')));

let code2 = fs.readFileSync('src/components/AuctionHouseModal.tsx', 'utf8');
console.log(code2.substring(code2.indexOf('Du hast '), code2.indexOf(' Gold gekauft.')));
