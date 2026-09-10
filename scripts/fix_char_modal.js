import fs from 'fs';
const path = 'src/components/CharacterModal.tsx';
let code = fs.readFileSync(path, 'utf8');

const replacement = `  const [selectedWeaponTab, setSelectedWeaponTab] = useState<WeaponType>(stats.activeWeaponType);
  const [activeTab, setActiveTab] = useState<'stats' | 'mastery' | 'ascension'>('stats');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError: boolean } | null>(null);

  if (!isOpen) return null;

  const handleAllocate = (attr: keyof CharacterAttributes) => {
    if (onAllocateStatPoint) {
      const res = onAllocateStatPoint(attr);
      setFeedbackMessage({ text: res.message, isError: !res.success });
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  const handleUnlockSkill = (skill: MilestoneWeaponSkill) => {
    if (onUnlockMilestoneSkill) {
      const res = onUnlockMilestoneSkill(skill.id);
      setFeedbackMessage({ text: res.message, isError: !res.success });
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  const handleEquipSkill = (classSkill: ClassSkill) => {
    if (!onEquipSkill) return;
    onEquipSkill(0, classSkill); // Equip to primary slot 1
    setFeedbackMessage({ text: \`Equipped "\${classSkill.name}" to Hotbar Slot [1]!\`, isError: false });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const selectedMastery = stats.weaponMasteries?.[selectedWeaponTab] || stats.weaponMasteries?.blade;

  return (
    <div id="character-modal-overlay" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div
        id="character-dialog"
        className="w-full max-w-3xl bg-[#11141a] border border-[#b8860b]/40 rounded-2xl p-5 sm:p-6 text-gray-200 shadow-[0_0_40px_rgba(184,134,11,0.2)] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-black border border-gray-700 rounded-xl flex items-center justify-center text-xl shadow-inner">
              🧙‍♂️
            </div>
            <div>
              <h2 className="text-2xl font-bold font-serif text-[#fbbf24] uppercase tracking-wider">{stats.prestigeTitle || 'Aspirant'}</h2>
              <div className="text-sm text-gray-400 font-mono">
                Level <span className="text-white font-bold">{stats.level}</span> {MMORPG_CLASSES[currentClassId]?.name || 'Adventurer'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors border border-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Feedback Toast */}
        {feedbackMessage && (
          <div className={\`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm font-semibold \${feedbackMessage.isError ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'}\`}>
            {feedbackMessage.isError ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            {feedbackMessage.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-6 border-b border-gray-800 pb-2">
          <button
            onClick={() => setActiveTab('stats')}
            className={\`px-4 py-2 rounded-lg font-bold text-sm transition-all \${activeTab === 'stats' ? 'bg-[#b8860b]/20 text-[#fbbf24] border border-[#b8860b]/50' : 'bg-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}\`}
          >
            Attributes
          </button>
          <button
            onClick={() => setActiveTab('mastery')}
            className={\`px-4 py-2 rounded-lg font-bold text-sm transition-all \${activeTab === 'mastery' ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50' : 'bg-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}\`}
          >
            Classless Mastery
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mt-4 pr-2 custom-scrollbar">
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Stat Allocation */}
            </div>
          )}
          {activeTab === 'mastery' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-3">
                {Object.values(stats.weaponMasteries || {}).map((mastery) => {
                  const wep = mastery;
                  const isSelected = selectedWeaponTab === wep.type;
                  const rank = mastery?.level || 1;
                  return (
                    <button
                      key={wep.type}
                      onClick={() => setSelectedWeaponTab(wep.type as WeaponType)}
                      className={\`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer \${
                        isSelected
                          ? 'bg-black/90 border-[#fbbf24] shadow-[0_0_15px_rgba(251,191,36,0.25)] ring-1 ring-[#fbbf24]'
                          : 'bg-black/50 border-gray-800 hover:border-gray-700'
                      }\`}
                    >
`;

code = code.replace(/const[\s\S]*?className=\{`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer \$\{/, replacement + "className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${");

fs.writeFileSync(path, code);
