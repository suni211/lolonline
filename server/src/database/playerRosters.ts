// 2025 시즌 선수 로스터 데이터

export interface PlayerData {
  name: string;
  position: 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT';
  nationality: string;
  team: string;
  league: string;
  base_ovr: number;
}

// LCK 선수들
const lckPlayers: PlayerData[] = [
  // GEN.G
  { name: 'Kiin', position: 'TOP', nationality: 'KR', team: 'GEN.G', league: 'LCK', base_ovr: 92 },
  { name: 'Canyon', position: 'JUNGLE', nationality: 'KR', team: 'GEN.G', league: 'LCK', base_ovr: 88 },
  { name: 'Chovy', position: 'MID', nationality: 'KR', team: 'GEN.G', league: 'LCK', base_ovr: 93 },
  { name: 'Ruler', position: 'ADC', nationality: 'KR', team: 'GEN.G', league: 'LCK', base_ovr: 95 },
  { name: 'Duro', position: 'SUPPORT', nationality: 'KR', team: 'GEN.G', league: 'LCK', base_ovr: 88 },
  // HLE
  { name: 'Zeus', position: 'TOP', nationality: 'KR', team: 'HLE', league: 'LCK', base_ovr: 93 },
  { name: 'Peanut', position: 'JUNGLE', nationality: 'KR', team: 'HLE', league: 'LCK', base_ovr: 85 },
  { name: 'Zeka', position: 'MID', nationality: 'KR', team: 'HLE', league: 'LCK', base_ovr: 86 },
  { name: 'Viper', position: 'ADC', nationality: 'KR', team: 'HLE', league: 'LCK', base_ovr: 94 },
  { name: 'Delight', position: 'SUPPORT', nationality: 'KR', team: 'HLE', league: 'LCK', base_ovr: 83 },
  // KT
  { name: 'PerfecT', position: 'TOP', nationality: 'KR', team: 'KT', league: 'LCK', base_ovr: 82 },
  { name: 'Cuzz', position: 'JUNGLE', nationality: 'KR', team: 'KT', league: 'LCK', base_ovr: 82 },
  { name: 'Bdd', position: 'MID', nationality: 'KR', team: 'KT', league: 'LCK', base_ovr: 90 },
  { name: 'deokdam', position: 'ADC', nationality: 'KR', team: 'KT', league: 'LCK', base_ovr: 81 },
  { name: 'Peter', position: 'SUPPORT', nationality: 'KR', team: 'KT', league: 'LCK', base_ovr: 84 },
  // T1
  { name: 'Doran', position: 'TOP', nationality: 'KR', team: 'T1', league: 'LCK', base_ovr: 89 },
  { name: 'Oner', position: 'JUNGLE', nationality: 'KR', team: 'T1', league: 'LCK', base_ovr: 93 },
  { name: 'Faker', position: 'MID', nationality: 'KR', team: 'T1', league: 'LCK', base_ovr: 98 },
  { name: 'Gumayusi', position: 'ADC', nationality: 'KR', team: 'T1', league: 'LCK', base_ovr: 95 },
  { name: 'Keria', position: 'SUPPORT', nationality: 'KR', team: 'T1', league: 'LCK', base_ovr: 93 },
  // DK
  { name: 'Siwoo', position: 'TOP', nationality: 'KR', team: 'DK', league: 'LCK', base_ovr: 82 },
  { name: 'Lucid', position: 'JUNGLE', nationality: 'KR', team: 'DK', league: 'LCK', base_ovr: 85 },
  { name: 'ShowMaker', position: 'MID', nationality: 'KR', team: 'DK', league: 'LCK', base_ovr: 85 },
  { name: 'Aiming', position: 'ADC', nationality: 'KR', team: 'DK', league: 'LCK', base_ovr: 80 },
  { name: 'BeryL', position: 'SUPPORT', nationality: 'KR', team: 'DK', league: 'LCK', base_ovr: 84 },
  // BFX
  { name: 'Clear', position: 'TOP', nationality: 'KR', team: 'BFX', league: 'LCK', base_ovr: 74 },
  { name: 'raptor', position: 'JUNGLE', nationality: 'KR', team: 'BFX', league: 'LCK', base_ovr: 75 },
  { name: 'VicLa', position: 'MID', nationality: 'KR', team: 'BFX', league: 'LCK', base_ovr: 79 },
  { name: 'Daystar', position: 'MID', nationality: 'KR', team: 'BFX', league: 'LCK', base_ovr: 66 },
  { name: 'Diable', position: 'ADC', nationality: 'KR', team: 'BFX', league: 'LCK', base_ovr: 88 },
  { name: 'Kellin', position: 'SUPPORT', nationality: 'KR', team: 'BFX', league: 'LCK', base_ovr: 80 },
  // NS
  { name: 'Kingen', position: 'TOP', nationality: 'KR', team: 'NS', league: 'LCK', base_ovr: 85 },
  { name: 'GIDEON', position: 'JUNGLE', nationality: 'KR', team: 'NS', league: 'LCK', base_ovr: 77 },
  { name: 'Calix', position: 'MID', nationality: 'KR', team: 'NS', league: 'LCK', base_ovr: 80 },
  { name: 'Jiwoo', position: 'ADC', nationality: 'KR', team: 'NS', league: 'LCK', base_ovr: 79 },
  { name: 'Lehends', position: 'SUPPORT', nationality: 'KR', team: 'NS', league: 'LCK', base_ovr: 81 },
  // BRO
  { name: 'Morgan', position: 'TOP', nationality: 'KR', team: 'BRO', league: 'LCK', base_ovr: 80 },
  { name: 'Croco', position: 'JUNGLE', nationality: 'KR', team: 'BRO', league: 'LCK', base_ovr: 73 },
  { name: 'Clozer', position: 'MID', nationality: 'KR', team: 'BRO', league: 'LCK', base_ovr: 85 },
  { name: 'Hype', position: 'ADC', nationality: 'KR', team: 'BRO', league: 'LCK', base_ovr: 72 },
  { name: 'Pollu', position: 'SUPPORT', nationality: 'KR', team: 'BRO', league: 'LCK', base_ovr: 71 },
  // DRX
  { name: 'Rich', position: 'TOP', nationality: 'KR', team: 'DRX', league: 'LCK', base_ovr: 73 },
  { name: 'Sponge', position: 'JUNGLE', nationality: 'KR', team: 'DRX', league: 'LCK', base_ovr: 71 },
  { name: 'kyeahoo', position: 'MID', nationality: 'KR', team: 'DRX', league: 'LCK', base_ovr: 70 },
  { name: 'Teddy', position: 'ADC', nationality: 'KR', team: 'DRX', league: 'LCK', base_ovr: 77 },
  { name: 'Andil', position: 'SUPPORT', nationality: 'KR', team: 'DRX', league: 'LCK', base_ovr: 80 },
  // DNF
  { name: 'DuDu', position: 'TOP', nationality: 'KR', team: 'DNF', league: 'LCK', base_ovr: 68 },
  { name: 'Pyosik', position: 'JUNGLE', nationality: 'KR', team: 'DNF', league: 'LCK', base_ovr: 70 },
  { name: 'BuLLDoG', position: 'MID', nationality: 'KR', team: 'DNF', league: 'LCK', base_ovr: 71 },
  { name: 'Berserker', position: 'ADC', nationality: 'KR', team: 'DNF', league: 'LCK', base_ovr: 74 },
  { name: 'Life', position: 'SUPPORT', nationality: 'KR', team: 'DNF', league: 'LCK', base_ovr: 73 },
];

// LEC 선수들
const lecPlayers: PlayerData[] = [
  // G2
  { name: 'BrokenBlade', position: 'TOP', nationality: 'DE', team: 'G2', league: 'LEC', base_ovr: 77 },
  { name: 'SkewMond', position: 'JUNGLE', nationality: 'EU', team: 'G2', league: 'LEC', base_ovr: 77 },
  { name: 'Caps', position: 'MID', nationality: 'DK', team: 'G2', league: 'LEC', base_ovr: 83 },
  { name: 'Hans Sama', position: 'ADC', nationality: 'FR', team: 'G2', league: 'LEC', base_ovr: 76 },
  { name: 'Labrov', position: 'SUPPORT', nationality: 'EU', team: 'G2', league: 'LEC', base_ovr: 73 },
  // MKOI
  { name: 'Myrwn', position: 'TOP', nationality: 'EU', team: 'MKOI', league: 'LEC', base_ovr: 72 },
  { name: 'Elyoya', position: 'JUNGLE', nationality: 'ES', team: 'MKOI', league: 'LEC', base_ovr: 76 },
  { name: 'Jojopyun', position: 'MID', nationality: 'CA', team: 'MKOI', league: 'LEC', base_ovr: 76 },
  { name: 'Supa', position: 'ADC', nationality: 'EU', team: 'MKOI', league: 'LEC', base_ovr: 70 },
  { name: 'Alvaro', position: 'SUPPORT', nationality: 'ES', team: 'MKOI', league: 'LEC', base_ovr: 73 },
  // FNC
  { name: 'Oscarinin', position: 'TOP', nationality: 'ES', team: 'FNC', league: 'LEC', base_ovr: 72 },
  { name: 'Razork', position: 'JUNGLE', nationality: 'ES', team: 'FNC', league: 'LEC', base_ovr: 71 },
  { name: 'Poby', position: 'MID', nationality: 'EU', team: 'FNC', league: 'LEC', base_ovr: 81 },
  { name: 'Upset', position: 'ADC', nationality: 'DE', team: 'FNC', league: 'LEC', base_ovr: 75 },
  { name: 'Mikyx', position: 'SUPPORT', nationality: 'SI', team: 'FNC', league: 'LEC', base_ovr: 68 },
  // KC
  { name: 'Canna', position: 'TOP', nationality: 'KR', team: 'KC', league: 'LEC', base_ovr: 83 },
  { name: 'Yike', position: 'JUNGLE', nationality: 'EU', team: 'KC', league: 'LEC', base_ovr: 71 },
  { name: 'Vladi', position: 'MID', nationality: 'EU', team: 'KC', league: 'LEC', base_ovr: 72 },
  { name: 'Caliste', position: 'ADC', nationality: 'EU', team: 'KC', league: 'LEC', base_ovr: 79 },
  { name: 'Targamas', position: 'SUPPORT', nationality: 'BE', team: 'KC', league: 'LEC', base_ovr: 71 },
  // GX
  { name: 'Lot', position: 'TOP', nationality: 'EU', team: 'GX', league: 'LEC', base_ovr: 71 },
  { name: 'Isma', position: 'JUNGLE', nationality: 'EU', team: 'GX', league: 'LEC', base_ovr: 70 },
  { name: 'Jackies', position: 'MID', nationality: 'EU', team: 'GX', league: 'LEC', base_ovr: 72 },
  { name: 'Noah', position: 'ADC', nationality: 'KR', team: 'GX', league: 'LEC', base_ovr: 77 },
  { name: 'Jun', position: 'SUPPORT', nationality: 'KR', team: 'GX', league: 'LEC', base_ovr: 78 },
  // VIT
  { name: 'Naak Nako', position: 'TOP', nationality: 'EU', team: 'VIT', league: 'LEC', base_ovr: 64 },
  { name: 'Lyncas', position: 'JUNGLE', nationality: 'EU', team: 'VIT', league: 'LEC', base_ovr: 65 },
  { name: 'Czajek', position: 'MID', nationality: 'EU', team: 'VIT', league: 'LEC', base_ovr: 64 },
  { name: 'Carzzy', position: 'ADC', nationality: 'CZ', team: 'VIT', league: 'LEC', base_ovr: 65 },
  { name: 'Fleshy', position: 'SUPPORT', nationality: 'EU', team: 'VIT', league: 'LEC', base_ovr: 66 },
  // TH
  { name: 'Carlsen', position: 'TOP', nationality: 'EU', team: 'TH', league: 'LEC', base_ovr: 73 },
  { name: 'Sheo', position: 'JUNGLE', nationality: 'EU', team: 'TH', league: 'LEC', base_ovr: 70 },
  { name: 'Kamiloo', position: 'MID', nationality: 'EU', team: 'TH', league: 'LEC', base_ovr: 68 },
  { name: 'Flakked', position: 'ADC', nationality: 'ES', team: 'TH', league: 'LEC', base_ovr: 71 },
  { name: 'Stend', position: 'SUPPORT', nationality: 'EU', team: 'TH', league: 'LEC', base_ovr: 65 },
  // BDS
  { name: 'Rooster', position: 'TOP', nationality: 'EU', team: 'BDS', league: 'LEC', base_ovr: 68 },
  { name: 'Boukada', position: 'JUNGLE', nationality: 'EU', team: 'BDS', league: 'LEC', base_ovr: 67 },
  { name: 'nuc', position: 'MID', nationality: 'EU', team: 'BDS', league: 'LEC', base_ovr: 66 },
  { name: 'Ice', position: 'ADC', nationality: 'EU', team: 'BDS', league: 'LEC', base_ovr: 72 },
  { name: 'Parus', position: 'SUPPORT', nationality: 'EU', team: 'BDS', league: 'LEC', base_ovr: 70 },
  // SK
  { name: 'DnDn', position: 'TOP', nationality: 'EU', team: 'SK', league: 'LEC', base_ovr: 65 },
  { name: 'Skeanz', position: 'JUNGLE', nationality: 'EU', team: 'SK', league: 'LEC', base_ovr: 66 },
  { name: 'Abbedagge', position: 'MID', nationality: 'DE', team: 'SK', league: 'LEC', base_ovr: 65 },
  { name: 'Keduii', position: 'ADC', nationality: 'EU', team: 'SK', league: 'LEC', base_ovr: 68 },
  { name: 'Loopy', position: 'SUPPORT', nationality: 'EU', team: 'SK', league: 'LEC', base_ovr: 62 },
  // NAVI
  { name: 'Adam', position: 'TOP', nationality: 'FR', team: 'NAVI', league: 'LEC', base_ovr: 66 },
  { name: 'Thayger', position: 'JUNGLE', nationality: 'EU', team: 'NAVI', league: 'LEC', base_ovr: 65 },
  { name: 'Rhilech', position: 'JUNGLE', nationality: 'EU', team: 'NAVI', league: 'LEC', base_ovr: 63 },
  { name: 'Larssen', position: 'MID', nationality: 'SE', team: 'NAVI', league: 'LEC', base_ovr: 65 },
  { name: 'Hans SamD', position: 'ADC', nationality: 'EU', team: 'NAVI', league: 'LEC', base_ovr: 60 },
  { name: 'Malrang', position: 'SUPPORT', nationality: 'KR', team: 'NAVI', league: 'LEC', base_ovr: 70 },
];

// LPL 선수들
const lplPlayers: PlayerData[] = [
  // BLG
  { name: 'Bin', position: 'TOP', nationality: 'CN', team: 'BLG', league: 'LPL', base_ovr: 93 },
  { name: 'shad0w', position: 'JUNGLE', nationality: 'CN', team: 'BLG', league: 'LPL', base_ovr: 74 },
  { name: 'Beichuan', position: 'JUNGLE', nationality: 'CN', team: 'BLG', league: 'LPL', base_ovr: 75 },
  { name: 'Knight', position: 'MID', nationality: 'CN', team: 'BLG', league: 'LPL', base_ovr: 87 },
  { name: 'Elk', position: 'ADC', nationality: 'CN', team: 'BLG', league: 'LPL', base_ovr: 85 },
  { name: 'ON', position: 'SUPPORT', nationality: 'CN', team: 'BLG', league: 'LPL', base_ovr: 80 },
  // TES
  { name: '369', position: 'TOP', nationality: 'CN', team: 'TES', league: 'LPL', base_ovr: 83 },
  { name: 'Kanavi', position: 'JUNGLE', nationality: 'KR', team: 'TES', league: 'LPL', base_ovr: 80 },
  { name: 'Creme', position: 'MID', nationality: 'CN', team: 'TES', league: 'LPL', base_ovr: 81 },
  { name: 'JackeyLove', position: 'ADC', nationality: 'CN', team: 'TES', league: 'LPL', base_ovr: 86 },
  { name: 'Hang', position: 'SUPPORT', nationality: 'CN', team: 'TES', league: 'LPL', base_ovr: 80 },
  // AL
  { name: 'Flandre', position: 'TOP', nationality: 'CN', team: 'AL', league: 'LPL', base_ovr: 88 },
  { name: 'Tarzan', position: 'JUNGLE', nationality: 'KR', team: 'AL', league: 'LPL', base_ovr: 87 },
  { name: 'Shanks', position: 'MID', nationality: 'CN', team: 'AL', league: 'LPL', base_ovr: 88 },
  { name: 'Hope', position: 'ADC', nationality: 'CN', team: 'AL', league: 'LPL', base_ovr: 82 },
  { name: 'Kael', position: 'SUPPORT', nationality: 'CN', team: 'AL', league: 'LPL', base_ovr: 85 },
  // IG
  { name: 'TheShy', position: 'TOP', nationality: 'KR', team: 'IG', league: 'LPL', base_ovr: 80 },
  { name: 'Wei', position: 'JUNGLE', nationality: 'CN', team: 'IG', league: 'LPL', base_ovr: 80 },
  { name: 'Rookie', position: 'MID', nationality: 'KR', team: 'IG', league: 'LPL', base_ovr: 81 },
  { name: 'GALA', position: 'ADC', nationality: 'CN', team: 'IG', league: 'LPL', base_ovr: 82 },
  { name: 'Meiko', position: 'SUPPORT', nationality: 'CN', team: 'IG', league: 'LPL', base_ovr: 79 },
  // WBG
  { name: 'Breathe', position: 'TOP', nationality: 'CN', team: 'WBG', league: 'LPL', base_ovr: 80 },
  { name: 'Tian', position: 'JUNGLE', nationality: 'CN', team: 'WBG', league: 'LPL', base_ovr: 83 },
  { name: 'Xiaohu', position: 'MID', nationality: 'CN', team: 'WBG', league: 'LPL', base_ovr: 83 },
  { name: 'Light', position: 'ADC', nationality: 'CN', team: 'WBG', league: 'LPL', base_ovr: 83 },
  { name: 'Crisp', position: 'SUPPORT', nationality: 'CN', team: 'WBG', league: 'LPL', base_ovr: 81 },
  // NIP
  { name: 'Solokill', position: 'TOP', nationality: 'CN', team: 'NIP', league: 'LPL', base_ovr: 77 },
  { name: 'naiyou', position: 'JUNGLE', nationality: 'CN', team: 'NIP', league: 'LPL', base_ovr: 78 },
  { name: 'Doinb', position: 'MID', nationality: 'KR', team: 'NIP', league: 'LPL', base_ovr: 80 },
  { name: 'Leave', position: 'ADC', nationality: 'CN', team: 'NIP', league: 'LPL', base_ovr: 73 },
  { name: 'Niket', position: 'SUPPORT', nationality: 'CN', team: 'NIP', league: 'LPL', base_ovr: 71 },
  // WE
  { name: 'Cube', position: 'TOP', nationality: 'CN', team: 'WE', league: 'LPL', base_ovr: 75 },
  { name: 'Monki', position: 'JUNGLE', nationality: 'CN', team: 'WE', league: 'LPL', base_ovr: 73 },
  { name: 'Karis', position: 'MID', nationality: 'CN', team: 'WE', league: 'LPL', base_ovr: 76 },
  { name: 'Taeyoon', position: 'ADC', nationality: 'KR', team: 'WE', league: 'LPL', base_ovr: 80 },
  { name: 'Vampire', position: 'SUPPORT', nationality: 'CN', team: 'WE', league: 'LPL', base_ovr: 80 },
  // LGD
  { name: 'sasi', position: 'TOP', nationality: 'CN', team: 'LGD', league: 'LPL', base_ovr: 72 },
  { name: 'Meteor', position: 'JUNGLE', nationality: 'CN', team: 'LGD', league: 'LPL', base_ovr: 70 },
  { name: 'xqw', position: 'MID', nationality: 'CN', team: 'LGD', league: 'LPL', base_ovr: 70 },
  { name: 'Sav1or', position: 'ADC', nationality: 'CN', team: 'LGD', league: 'LPL', base_ovr: 68 },
  { name: 'Ycx', position: 'SUPPORT', nationality: 'CN', team: 'LGD', league: 'LPL', base_ovr: 70 },
  // CFO
  { name: 'Rest', position: 'TOP', nationality: 'CN', team: 'CFO', league: 'LPL', base_ovr: 71 },
  { name: 'Driver', position: 'TOP', nationality: 'CN', team: 'CFO', league: 'LPL', base_ovr: 72 },
  { name: 'JunJia', position: 'JUNGLE', nationality: 'CN', team: 'CFO', league: 'LPL', base_ovr: 75 },
  { name: 'HongQ', position: 'MID', nationality: 'CN', team: 'CFO', league: 'LPL', base_ovr: 70 },
  { name: 'Doggo', position: 'ADC', nationality: 'TW', team: 'CFO', league: 'LPL', base_ovr: 83 },
  { name: 'Kaiwing', position: 'SUPPORT', nationality: 'TW', team: 'CFO', league: 'LPL', base_ovr: 80 },
  // TSW
  { name: 'Pun', position: 'TOP', nationality: 'CN', team: 'TSW', league: 'LPL', base_ovr: 70 },
  { name: 'Hiro02', position: 'TOP', nationality: 'CN', team: 'TSW', league: 'LPL', base_ovr: 70 },
  { name: 'Hizto', position: 'JUNGLE', nationality: 'CN', team: 'TSW', league: 'LPL', base_ovr: 71 },
  { name: 'Dire', position: 'MID', nationality: 'CN', team: 'TSW', league: 'LPL', base_ovr: 68 },
  { name: 'Eddie', position: 'ADC', nationality: 'CN', team: 'TSW', league: 'LPL', base_ovr: 70 },
  { name: 'Taki', position: 'SUPPORT', nationality: 'CN', team: 'TSW', league: 'LPL', base_ovr: 67 },
];

// PCS/LCP 선수들
const pcsPlayers: PlayerData[] = [
  // PSG
  { name: 'Azhi', position: 'TOP', nationality: 'TW', team: 'PSG', league: 'PCS', base_ovr: 65 },
  { name: 'Karsa', position: 'JUNGLE', nationality: 'TW', team: 'PSG', league: 'PCS', base_ovr: 77 },
  { name: 'Maple', position: 'MID', nationality: 'TW', team: 'PSG', league: 'PCS', base_ovr: 77 },
  { name: 'Betty', position: 'ADC', nationality: 'TW', team: 'PSG', league: 'PCS', base_ovr: 75 },
  { name: 'Woody', position: 'SUPPORT', nationality: 'TW', team: 'PSG', league: 'PCS', base_ovr: 71 },
];

// VCS 선수들
const vcsPlayers: PlayerData[] = [
  // GAM
  { name: 'Kiaya', position: 'TOP', nationality: 'VN', team: 'GAM', league: 'VCS', base_ovr: 75 },
  { name: 'Levi', position: 'JUNGLE', nationality: 'VN', team: 'GAM', league: 'VCS', base_ovr: 77 },
  { name: 'Aress', position: 'MID', nationality: 'VN', team: 'GAM', league: 'VCS', base_ovr: 68 },
  { name: 'Artemis', position: 'ADC', nationality: 'VN', team: 'GAM', league: 'VCS', base_ovr: 67 },
  { name: 'Elio', position: 'SUPPORT', nationality: 'VN', team: 'GAM', league: 'VCS', base_ovr: 66 },
  // VKE
  { name: 'Kratos', position: 'TOP', nationality: 'VN', team: 'VKE', league: 'VCS', base_ovr: 64 },
  { name: 'Gury', position: 'JUNGLE', nationality: 'VN', team: 'VKE', league: 'VCS', base_ovr: 63 },
  { name: 'Kati', position: 'MID', nationality: 'VN', team: 'VKE', league: 'VCS', base_ovr: 66 },
  { name: 'Sty1e', position: 'ADC', nationality: 'VN', team: 'VKE', league: 'VCS', base_ovr: 63 },
  { name: 'SiuLoong', position: 'SUPPORT', nationality: 'VN', team: 'VKE', league: 'VCS', base_ovr: 61 },
];

// LJL 선수들
const ljlPlayers: PlayerData[] = [
  // DFM
  { name: 'RayFarky', position: 'TOP', nationality: 'JP', team: 'DFM', league: 'LJL', base_ovr: 70 },
  { name: 'Momo', position: 'TOP', nationality: 'JP', team: 'DFM', league: 'LJL', base_ovr: 66 },
  { name: 'Citrus', position: 'JUNGLE', nationality: 'JP', team: 'DFM', league: 'LJL', base_ovr: 65 },
  { name: 'Aria', position: 'MID', nationality: 'KR', team: 'DFM', league: 'LJL', base_ovr: 73 },
  { name: 'Kakkun', position: 'ADC', nationality: 'JP', team: 'DFM', league: 'LJL', base_ovr: 71 },
  { name: 'Harp', position: 'SUPPORT', nationality: 'JP', team: 'DFM', league: 'LJL', base_ovr: 70 },
  // SHG
  { name: 'Evi', position: 'TOP', nationality: 'JP', team: 'SHG', league: 'LJL', base_ovr: 70 },
  { name: 'YellowYoshi', position: 'TOP', nationality: 'JP', team: 'SHG', league: 'LJL', base_ovr: 65 },
  { name: 'Courge', position: 'JUNGLE', nationality: 'JP', team: 'SHG', league: 'LJL', base_ovr: 61 },
  { name: 'Yohan', position: 'JUNGLE', nationality: 'JP', team: 'SHG', league: 'LJL', base_ovr: 62 },
  { name: 'FATE', position: 'MID', nationality: 'KR', team: 'SHG', league: 'LJL', base_ovr: 67 },
  { name: 'Marble', position: 'ADC', nationality: 'JP', team: 'SHG', league: 'LJL', base_ovr: 66 },
  { name: 'Gaeng', position: 'SUPPORT', nationality: 'KR', team: 'SHG', league: 'LJL', base_ovr: 66 },
  // DCG
  { name: 'Flauren', position: 'TOP', nationality: 'JP', team: 'DCG', league: 'LJL', base_ovr: 60 },
  { name: '665', position: 'JUNGLE', nationality: 'JP', team: 'DCG', league: 'LJL', base_ovr: 60 },
  { name: 'Hongsuo', position: 'MID', nationality: 'JP', team: 'DCG', league: 'LJL', base_ovr: 61 },
  { name: 'Feng', position: 'ADC', nationality: 'JP', team: 'DCG', league: 'LJL', base_ovr: 62 },
  { name: 'ShiauC', position: 'SUPPORT', nationality: 'JP', team: 'DCG', league: 'LJL', base_ovr: 63 },
];

// LCS 선수들
const lcsPlayers: PlayerData[] = [
  // TL
  { name: 'Impact', position: 'TOP', nationality: 'KR', team: 'TL', league: 'LCS', base_ovr: 68 },
  { name: 'Yuuji', position: 'JUNGLE', nationality: 'NA', team: 'TL', league: 'LCS', base_ovr: 66 },
  { name: 'APA', position: 'MID', nationality: 'NA', team: 'TL', league: 'LCS', base_ovr: 73 },
  { name: 'Yeon', position: 'ADC', nationality: 'KR', team: 'TL', league: 'LCS', base_ovr: 75 },
  { name: 'CoreJJ', position: 'SUPPORT', nationality: 'KR', team: 'TL', league: 'LCS', base_ovr: 70 },
  // 100T
  { name: 'Sniper', position: 'TOP', nationality: 'NA', team: '100T', league: 'LCS', base_ovr: 70 },
  { name: 'Dhokla', position: 'TOP', nationality: 'NA', team: '100T', league: 'LCS', base_ovr: 71 },
  { name: 'River', position: 'JUNGLE', nationality: 'KR', team: '100T', league: 'LCS', base_ovr: 68 },
  { name: 'Quid', position: 'MID', nationality: 'KR', team: '100T', league: 'LCS', base_ovr: 73 },
  { name: 'FBI', position: 'ADC', nationality: 'AU', team: '100T', league: 'LCS', base_ovr: 75 },
  { name: 'Eyla', position: 'SUPPORT', nationality: 'AU', team: '100T', league: 'LCS', base_ovr: 70 },
  // C9
  { name: 'Thanatos', position: 'TOP', nationality: 'KR', team: 'C9', league: 'LCS', base_ovr: 73 },
  { name: 'Balber', position: 'JUNGLE', nationality: 'NA', team: 'C9', league: 'LCS', base_ovr: 72 },
  { name: 'Loki', position: 'MID', nationality: 'NA', team: 'C9', league: 'LCS', base_ovr: 75 },
  { name: 'Zven', position: 'ADC', nationality: 'DK', team: 'C9', league: 'LCS', base_ovr: 71 },
  { name: 'Vulcan', position: 'SUPPORT', nationality: 'CA', team: 'C9', league: 'LCS', base_ovr: 70 },
  // DIG
  { name: 'SRTTY', position: 'TOP', nationality: 'NA', team: 'DIG', league: 'LCS', base_ovr: 61 },
  { name: 'LIRA', position: 'JUNGLE', nationality: 'KR', team: 'DIG', league: 'LCS', base_ovr: 64 },
  { name: 'KEINE', position: 'MID', nationality: 'NA', team: 'DIG', league: 'LCS', base_ovr: 62 },
  { name: 'TOMO', position: 'ADC', nationality: 'NA', team: 'DIG', league: 'LCS', base_ovr: 63 },
  { name: 'ISLES', position: 'SUPPORT', nationality: 'NA', team: 'DIG', league: 'LCS', base_ovr: 66 },
  // SR
  { name: 'Fudge', position: 'TOP', nationality: 'AU', team: 'SR', league: 'LCS', base_ovr: 68 },
  { name: 'Contractz', position: 'JUNGLE', nationality: 'NA', team: 'SR', league: 'LCS', base_ovr: 70 },
  { name: 'PALAFOX', position: 'MID', nationality: 'NA', team: 'SR', league: 'LCS', base_ovr: 63 },
  { name: 'BVOY', position: 'ADC', nationality: 'NA', team: 'SR', league: 'LCS', base_ovr: 63 },
  { name: 'CEOS', position: 'SUPPORT', nationality: 'NA', team: 'SR', league: 'LCS', base_ovr: 64 },
  // LYON
  { name: 'LICORICE', position: 'TOP', nationality: 'NA', team: 'LYON', league: 'LCS', base_ovr: 66 },
  { name: 'ODDIELAN', position: 'JUNGLE', nationality: 'NA', team: 'LYON', league: 'LCS', base_ovr: 65 },
  { name: 'SAINT', position: 'MID', nationality: 'NA', team: 'LYON', league: 'LCS', base_ovr: 61 },
  { name: 'HENA', position: 'ADC', nationality: 'NA', team: 'LYON', league: 'LCS', base_ovr: 66 },
  { name: 'LYONZ', position: 'SUPPORT', nationality: 'NA', team: 'LYON', league: 'LCS', base_ovr: 64 },
  // DSG
  { name: 'Castle', position: 'TOP', nationality: 'NA', team: 'DSG', league: 'LCS', base_ovr: 66 },
  { name: 'Exyu', position: 'JUNGLE', nationality: 'NA', team: 'DSG', league: 'LCS', base_ovr: 66 },
  { name: 'DARKWINGS', position: 'MID', nationality: 'NA', team: 'DSG', league: 'LCS', base_ovr: 64 },
  { name: 'Rahel', position: 'ADC', nationality: 'NA', team: 'DSG', league: 'LCS', base_ovr: 72 },
  { name: 'Huhu', position: 'SUPPORT', nationality: 'NA', team: 'DSG', league: 'LCS', base_ovr: 70 },
  // PNG
  { name: 'Wizer', position: 'TOP', nationality: 'NA', team: 'PNG', league: 'LCS', base_ovr: 61 },
  { name: 'CarioK', position: 'JUNGLE', nationality: 'NA', team: 'PNG', league: 'LCS', base_ovr: 63 },
  { name: 'Roamer', position: 'MID', nationality: 'NA', team: 'PNG', league: 'LCS', base_ovr: 63 },
  { name: 'TitaN', position: 'ADC', nationality: 'NA', team: 'PNG', league: 'LCS', base_ovr: 62 },
  { name: 'Kuri', position: 'SUPPORT', nationality: 'NA', team: 'PNG', league: 'LCS', base_ovr: 61 },
  // VKS
  { name: 'Boal', position: 'TOP', nationality: 'NA', team: 'VKS', league: 'LCS', base_ovr: 61 },
  { name: 'Disamis', position: 'JUNGLE', nationality: 'NA', team: 'VKS', league: 'LCS', base_ovr: 62 },
  { name: 'Mireu', position: 'MID', nationality: 'NA', team: 'VKS', league: 'LCS', base_ovr: 65 },
  { name: 'Morttheus', position: 'ADC', nationality: 'NA', team: 'VKS', league: 'LCS', base_ovr: 62 },
  { name: 'Trymbi', position: 'SUPPORT', nationality: 'PL', team: 'VKS', league: 'LCS', base_ovr: 63 },
];

// CBLOL 선수들
const cblolPlayers: PlayerData[] = [
  // RED
  { name: 'fNb', position: 'TOP', nationality: 'BR', team: 'RED', league: 'CBLOL', base_ovr: 58 },
  { name: 'DOOM', position: 'JUNGLE', nationality: 'BR', team: 'RED', league: 'CBLOL', base_ovr: 63 },
  { name: 'Kaze', position: 'MID', nationality: 'BR', team: 'RED', league: 'CBLOL', base_ovr: 61 },
  { name: 'Rabelo', position: 'ADC', nationality: 'BR', team: 'RED', league: 'CBLOL', base_ovr: 62 },
  { name: 'Frosty', position: 'SUPPORT', nationality: 'BR', team: 'RED', league: 'CBLOL', base_ovr: 61 },
  // LOUD
  { name: 'Robo', position: 'TOP', nationality: 'BR', team: 'LOUD', league: 'CBLOL', base_ovr: 61 },
  { name: 'Gryffinn', position: 'JUNGLE', nationality: 'BR', team: 'LOUD', league: 'CBLOL', base_ovr: 65 },
  { name: 'Jool', position: 'MID', nationality: 'BR', team: 'LOUD', league: 'CBLOL', base_ovr: 65 },
  { name: 'Route', position: 'ADC', nationality: 'BR', team: 'LOUD', league: 'CBLOL', base_ovr: 66 },
  { name: 'RedBert', position: 'SUPPORT', nationality: 'BR', team: 'LOUD', league: 'CBLOL', base_ovr: 61 },
  // FUR
  { name: 'Guigo', position: 'TOP', nationality: 'BR', team: 'FUR', league: 'CBLOL', base_ovr: 58 },
  { name: 'Tatu', position: 'JUNGLE', nationality: 'BR', team: 'FUR', league: 'CBLOL', base_ovr: 60 },
  { name: 'Tutsz', position: 'MID', nationality: 'BR', team: 'FUR', league: 'CBLOL', base_ovr: 57 },
  { name: 'Ayu', position: 'ADC', nationality: 'BR', team: 'FUR', league: 'CBLOL', base_ovr: 58 },
  { name: 'JoJo', position: 'SUPPORT', nationality: 'BR', team: 'FUR', league: 'CBLOL', base_ovr: 57 },
  // FXW7
  { name: 'curty', position: 'TOP', nationality: 'BR', team: 'FXW7', league: 'CBLOL', base_ovr: 57 },
  { name: 'Yampi', position: 'JUNGLE', nationality: 'BR', team: 'FXW7', league: 'CBLOL', base_ovr: 60 },
  { name: 'Fuuu', position: 'MID', nationality: 'BR', team: 'FXW7', league: 'CBLOL', base_ovr: 63 },
  { name: 'Marvin', position: 'ADC', nationality: 'BR', team: 'FXW7', league: 'CBLOL', base_ovr: 62 },
  { name: 'ProDelta', position: 'SUPPORT', nationality: 'BR', team: 'FXW7', league: 'CBLOL', base_ovr: 61 },
  // ISG
  { name: 'ZOEN', position: 'TOP', nationality: 'BR', team: 'ISG', league: 'CBLOL', base_ovr: 61 },
  { name: 'Josedeodo', position: 'JUNGLE', nationality: 'AR', team: 'ISG', league: 'CBLOL', base_ovr: 55 },
  { name: 'Leza', position: 'MID', nationality: 'BR', team: 'ISG', league: 'CBLOL', base_ovr: 55 },
  { name: 'Snaker', position: 'ADC', nationality: 'BR', team: 'ISG', league: 'CBLOL', base_ovr: 56 },
  { name: 'Ackerman', position: 'SUPPORT', nationality: 'BR', team: 'ISG', league: 'CBLOL', base_ovr: 57 },
  // LEV
  { name: 'Zothve', position: 'TOP', nationality: 'BR', team: 'LEV', league: 'CBLOL', base_ovr: 56 },
  { name: 'SCARY', position: 'JUNGLE', nationality: 'BR', team: 'LEV', league: 'CBLOL', base_ovr: 51 },
  { name: 'Hauz', position: 'MID', nationality: 'BR', team: 'LEV', league: 'CBLOL', base_ovr: 56 },
  { name: 'ceo', position: 'ADC', nationality: 'BR', team: 'LEV', league: 'CBLOL', base_ovr: 57 },
  { name: 'TopLop', position: 'SUPPORT', nationality: 'BR', team: 'LEV', league: 'CBLOL', base_ovr: 55 },
];

// 모든 선수 합치기
export function getAllPlayers(): PlayerData[] {
  return [
    ...lckPlayers,
    ...lecPlayers,
    ...lplPlayers,
    ...pcsPlayers,
    ...vcsPlayers,
    ...ljlPlayers,
    ...lcsPlayers,
    ...cblolPlayers,
  ];
}

// 선수 데이터를 DB 형식으로 변환
export function getPlayersForDB() {
  return getAllPlayers().map(p => ({
    name: p.name,
    position: p.position,
    nationality: p.nationality,
    team: p.team,
    league: p.league,
    base_ovr: p.base_ovr
  }));
}
