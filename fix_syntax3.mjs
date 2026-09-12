import fs from 'fs';
let code = fs.readFileSync('src/engine/economy/AuctionHouseSystem.ts', 'utf8');

code = code.replace(/id: \\\`auction_\\\$\\{Date\.now\(\)\}_\\\$\\{Math\.floor\\(Math\.random\(\) \\* 1000\\)\}\\\`,/, "id: `auction_${Date.now()}_${Math.floor(Math.random() * 1000)}`,");
fs.writeFileSync('src/engine/economy/AuctionHouseSystem.ts', code);
