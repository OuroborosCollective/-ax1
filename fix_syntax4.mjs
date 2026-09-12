import fs from 'fs';
let code = fs.readFileSync('src/components/AuctionHouseModal.tsx', 'utf8');

code = code.replace(/engine\.addChatMessage\('system', 'Auktionshaus', \\\`Du hast \\\$\\{res\.listing\.item\.name\\} für \\\$\\{listing\.buyoutPrice\\} Gold gekauft\.\\\`\);/g, "engine.addChatMessage('system', 'Auktionshaus', `Du hast ${res.listing.item.name} für ${listing.buyoutPrice} Gold gekauft.`);");

code = code.replace(/engine\.addChatMessage\('system', 'Auktionshaus', \\\`Du hast \\\$\\{bidAmount\\} Gold auf \\\$\\{listing\.item\.name\\} geboten\.\\\`\);/g, "engine.addChatMessage('system', 'Auktionshaus', `Du hast ${bidAmount} Gold auf ${listing.item.name} geboten.`);");

code = code.replace(/engine\.addChatMessage\('system', 'Auktionshaus', \\\`\\\$\\{itemId\\} erfolgreich im Auktionshaus eingestellt\.\\\`\);/g, "engine.addChatMessage('system', 'Auktionshaus', `${itemId} erfolgreich im Auktionshaus eingestellt.`);");

fs.writeFileSync('src/components/AuctionHouseModal.tsx', code);
