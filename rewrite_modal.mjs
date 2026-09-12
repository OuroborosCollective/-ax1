import fs from 'fs';
let code = fs.readFileSync('src/components/AuctionHouseModal.tsx', 'utf8');

// Simply remove the escaped backslashes from className
code = code.replace(/className=\{\\\`/g, "className={`");
code = code.replace(/\\\`\}/g, "`}");

fs.writeFileSync('src/components/AuctionHouseModal.tsx', code);
