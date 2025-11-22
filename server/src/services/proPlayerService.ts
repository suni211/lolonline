import pool from '../database/db.js';

// 프로 선수 데이터
const PRO_PLAYERS_DATA = [
  // LCK - GEN.G
  { name: 'Kiin', team: 'GEN.G', position: 'TOP', league: 'LCK', nationality: 'KR', base_ovr: 92 },
  { name: 'Canyon', team: 'GEN.G', position: 'JUNGLE', league: 'LCK', nationality: 'KR', base_ovr: 88 },
  { name: 'Chovy', team: 'GEN.G', position: 'MID', league: 'LCK', nationality: 'KR', base_ovr: 93 },
  { name: 'Ruler', team: 'GEN.G', position: 'ADC', league: 'LCK', nationality: 'KR', base_ovr: 95 },
  { name: 'Duro', team: 'GEN.G', position: 'SUPPORT', league: 'LCK', nationality: 'KR', base_ovr: 88 },

  // LCK - HLE
  { name: 'Zeus', team: 'HLE', position: 'TOP', league: 'LCK', nationality: 'KR', base_ovr: 93 },
  { name: 'Peanut', team: 'HLE', position: 'JUNGLE', league: 'LCK', nationality: 'KR', base_ovr: 85 },
  { name: 'Zeka', team: 'HLE', position: 'MID', league: 'LCK', nationality: 'KR', base_ovr: 86 },
  { name: 'Viper', team: 'HLE', position: 'ADC', league: 'LCK', nationality: 'KR', base_ovr: 94 },
  { name: 'Delight', team: 'HLE', position: 'SUPPORT', league: 'LCK', nationality: 'KR', base_ovr: 83 },

  // LCK - KT
  { name: 'PerfecT', team: 'KT', position: 'TOP', league: 'LCK', nationality: 'KR', base_ovr: 82 },
  { name: 'Cuzz', team: 'KT', position: 'JUNGLE', league: 'LCK', nationality: 'KR', base_ovr: 82 },
  { name: 'Bdd', team: 'KT', position: 'MID', league: 'LCK', nationality: 'KR', base_ovr: 90 },
  { name: 'deokdam', team: 'KT', position: 'ADC', league: 'LCK', nationality: 'KR', base_ovr: 81 },
  { name: 'Peter', team: 'KT', position: 'SUPPORT', league: 'LCK', nationality: 'KR', base_ovr: 84 },

  // LCK - T1
  { name: 'Doran', team: 'T1', position: 'TOP', league: 'LCK', nationality: 'KR', base_ovr: 89 },
  { name: 'Oner', team: 'T1', position: 'JUNGLE', league: 'LCK', nationality: 'KR', base_ovr: 93 },
  { name: 'Faker', team: 'T1', position: 'MID', league: 'LCK', nationality: 'KR', base_ovr: 98 },
  { name: 'Gumayusi', team: 'T1', position: 'ADC', league: 'LCK', nationality: 'KR', base_ovr: 95 },
  { name: 'Keria', team: 'T1', position: 'SUPPORT', league: 'LCK', nationality: 'KR', base_ovr: 93 },

  // LCK - DK
  { name: 'Siwoo', team: 'DK', position: 'TOP', league: 'LCK', nationality: 'KR', base_ovr: 82 },
  { name: 'Lucid', team: 'DK', position: 'JUNGLE', league: 'LCK', nationality: 'KR', base_ovr: 85 },
  { name: 'ShowMaker', team: 'DK', position: 'MID', league: 'LCK', nationality: 'KR', base_ovr: 85 },
  { name: 'Aiming', team: 'DK', position: 'ADC', league: 'LCK', nationality: 'KR', base_ovr: 80 },
  { name: 'BeryL', team: 'DK', position: 'SUPPORT', league: 'LCK', nationality: 'KR', base_ovr: 84 },

  // LCK - BFX
  { name: 'Clear', team: 'BFX', position: 'TOP', league: 'LCK', nationality: 'KR', base_ovr: 74 },
  { name: 'raptor', team: 'BFX', position: 'JUNGLE', league: 'LCK', nationality: 'KR', base_ovr: 75 },
  { name: 'VicLa', team: 'BFX', position: 'MID', league: 'LCK', nationality: 'KR', base_ovr: 79 },
  { name: 'Diable', team: 'BFX', position: 'ADC', league: 'LCK', nationality: 'KR', base_ovr: 88 },
  { name: 'Kellin', team: 'BFX', position: 'SUPPORT', league: 'LCK', nationality: 'KR', base_ovr: 80 },

  // LCK - NS
  { name: 'Kingen', team: 'NS', position: 'TOP', league: 'LCK', nationality: 'KR', base_ovr: 85 },
  { name: 'GIDEON', team: 'NS', position: 'JUNGLE', league: 'LCK', nationality: 'KR', base_ovr: 77 },
  { name: 'Calix', team: 'NS', position: 'MID', league: 'LCK', nationality: 'KR', base_ovr: 80 },
  { name: 'Jiwoo', team: 'NS', position: 'ADC', league: 'LCK', nationality: 'KR', base_ovr: 79 },
  { name: 'Lehends', team: 'NS', position: 'SUPPORT', league: 'LCK', nationality: 'KR', base_ovr: 81 },

  // LCK - BRO
  { name: 'Morgan', team: 'BRO', position: 'TOP', league: 'LCK', nationality: 'KR', base_ovr: 80 },
  { name: 'Croco', team: 'BRO', position: 'JUNGLE', league: 'LCK', nationality: 'KR', base_ovr: 73 },
  { name: 'Clozer', team: 'BRO', position: 'MID', league: 'LCK', nationality: 'KR', base_ovr: 85 },
  { name: 'Hype', team: 'BRO', position: 'ADC', league: 'LCK', nationality: 'KR', base_ovr: 72 },
  { name: 'Pollu', team: 'BRO', position: 'SUPPORT', league: 'LCK', nationality: 'KR', base_ovr: 71 },

  // LCK - DRX
  { name: 'Rich', team: 'DRX', position: 'TOP', league: 'LCK', nationality: 'KR', base_ovr: 73 },
  { name: 'Sponge', team: 'DRX', position: 'JUNGLE', league: 'LCK', nationality: 'KR', base_ovr: 71 },
  { name: 'kyeahoo', team: 'DRX', position: 'MID', league: 'LCK', nationality: 'KR', base_ovr: 70 },
  { name: 'Teddy', team: 'DRX', position: 'ADC', league: 'LCK', nationality: 'KR', base_ovr: 77 },
  { name: 'Andil', team: 'DRX', position: 'SUPPORT', league: 'LCK', nationality: 'KR', base_ovr: 80 },

  // LCK - DNF
  { name: 'DuDu', team: 'DNF', position: 'TOP', league: 'LCK', nationality: 'KR', base_ovr: 68 },
  { name: 'Pyosik', team: 'DNF', position: 'JUNGLE', league: 'LCK', nationality: 'KR', base_ovr: 70 },
  { name: 'BuLLDoG', team: 'DNF', position: 'MID', league: 'LCK', nationality: 'KR', base_ovr: 71 },
  { name: 'Berserker', team: 'DNF', position: 'ADC', league: 'LCK', nationality: 'KR', base_ovr: 74 },
  { name: 'Life', team: 'DNF', position: 'SUPPORT', league: 'LCK', nationality: 'KR', base_ovr: 73 },

  // LEC - G2
  { name: 'BrokenBlade', team: 'G2', position: 'TOP', league: 'LEC', nationality: 'EU', base_ovr: 77 },
  { name: 'SkewMond', team: 'G2', position: 'JUNGLE', league: 'LEC', nationality: 'EU', base_ovr: 77 },
  { name: 'Caps', team: 'G2', position: 'MID', league: 'LEC', nationality: 'EU', base_ovr: 83 },
  { name: 'Hans Sama', team: 'G2', position: 'ADC', league: 'LEC', nationality: 'EU', base_ovr: 76 },
  { name: 'Labrov', team: 'G2', position: 'SUPPORT', league: 'LEC', nationality: 'EU', base_ovr: 73 },

  // LEC - MKOI
  { name: 'Myrwn', team: 'MKOI', position: 'TOP', league: 'LEC', nationality: 'EU', base_ovr: 72 },
  { name: 'Elyoya', team: 'MKOI', position: 'JUNGLE', league: 'LEC', nationality: 'EU', base_ovr: 76 },
  { name: 'Jojopyun', team: 'MKOI', position: 'MID', league: 'LEC', nationality: 'NA', base_ovr: 76 },
  { name: 'Supa', team: 'MKOI', position: 'ADC', league: 'LEC', nationality: 'EU', base_ovr: 70 },
  { name: 'Alvaro', team: 'MKOI', position: 'SUPPORT', league: 'LEC', nationality: 'EU', base_ovr: 73 },

  // LEC - FNC
  { name: 'Oscarinin', team: 'FNC', position: 'TOP', league: 'LEC', nationality: 'EU', base_ovr: 72 },
  { name: 'Razork', team: 'FNC', position: 'JUNGLE', league: 'LEC', nationality: 'EU', base_ovr: 71 },
  { name: 'Poby', team: 'FNC', position: 'MID', league: 'LEC', nationality: 'KR', base_ovr: 81 },
  { name: 'Upset', team: 'FNC', position: 'ADC', league: 'LEC', nationality: 'EU', base_ovr: 75 },
  { name: 'Mikyx', team: 'FNC', position: 'SUPPORT', league: 'LEC', nationality: 'EU', base_ovr: 68 },

  // LEC - KC
  { name: 'Canna', team: 'KC', position: 'TOP', league: 'LEC', nationality: 'KR', base_ovr: 83 },
  { name: 'Yike', team: 'KC', position: 'JUNGLE', league: 'LEC', nationality: 'EU', base_ovr: 71 },
  { name: 'Vladi', team: 'KC', position: 'MID', league: 'LEC', nationality: 'EU', base_ovr: 72 },
  { name: 'Caliste', team: 'KC', position: 'ADC', league: 'LEC', nationality: 'EU', base_ovr: 79 },
  { name: 'Targamas', team: 'KC', position: 'SUPPORT', league: 'LEC', nationality: 'EU', base_ovr: 71 },

  // LEC - GX
  { name: 'Lot', team: 'GX', position: 'TOP', league: 'LEC', nationality: 'EU', base_ovr: 71 },
  { name: 'Isma', team: 'GX', position: 'JUNGLE', league: 'LEC', nationality: 'EU', base_ovr: 70 },
  { name: 'Jackies', team: 'GX', position: 'MID', league: 'LEC', nationality: 'EU', base_ovr: 72 },
  { name: 'Noah', team: 'GX', position: 'ADC', league: 'LEC', nationality: 'EU', base_ovr: 77 },
  { name: 'Jun', team: 'GX', position: 'SUPPORT', league: 'LEC', nationality: 'KR', base_ovr: 78 },

  // LEC - VIT
  { name: 'Naak Nako', team: 'VIT', position: 'TOP', league: 'LEC', nationality: 'EU', base_ovr: 64 },
  { name: 'Lyncas', team: 'VIT', position: 'JUNGLE', league: 'LEC', nationality: 'EU', base_ovr: 65 },
  { name: 'Czajek', team: 'VIT', position: 'MID', league: 'LEC', nationality: 'EU', base_ovr: 64 },
  { name: 'Carzzy', team: 'VIT', position: 'ADC', league: 'LEC', nationality: 'EU', base_ovr: 65 },
  { name: 'Fleshy', team: 'VIT', position: 'SUPPORT', league: 'LEC', nationality: 'EU', base_ovr: 66 },

  // LEC - TH
  { name: 'Carlsen', team: 'TH', position: 'TOP', league: 'LEC', nationality: 'EU', base_ovr: 73 },
  { name: 'Sheo', team: 'TH', position: 'JUNGLE', league: 'LEC', nationality: 'EU', base_ovr: 70 },
  { name: 'Kamiloo', team: 'TH', position: 'MID', league: 'LEC', nationality: 'EU', base_ovr: 68 },
  { name: 'Flakked', team: 'TH', position: 'ADC', league: 'LEC', nationality: 'EU', base_ovr: 71 },
  { name: 'Stend', team: 'TH', position: 'SUPPORT', league: 'LEC', nationality: 'EU', base_ovr: 65 },

  // LEC - BDS
  { name: 'Rooster', team: 'BDS', position: 'TOP', league: 'LEC', nationality: 'EU', base_ovr: 68 },
  { name: 'Boukada', team: 'BDS', position: 'JUNGLE', league: 'LEC', nationality: 'EU', base_ovr: 67 },
  { name: 'nuc', team: 'BDS', position: 'MID', league: 'LEC', nationality: 'EU', base_ovr: 66 },
  { name: 'Ice', team: 'BDS', position: 'ADC', league: 'LEC', nationality: 'EU', base_ovr: 72 },
  { name: 'Parus', team: 'BDS', position: 'SUPPORT', league: 'LEC', nationality: 'EU', base_ovr: 70 },

  // LEC - SK
  { name: 'DnDn', team: 'SK', position: 'TOP', league: 'LEC', nationality: 'EU', base_ovr: 65 },
  { name: 'Skeanz', team: 'SK', position: 'JUNGLE', league: 'LEC', nationality: 'EU', base_ovr: 66 },
  { name: 'Abbedagge', team: 'SK', position: 'MID', league: 'LEC', nationality: 'EU', base_ovr: 65 },
  { name: 'Keduii', team: 'SK', position: 'ADC', league: 'LEC', nationality: 'EU', base_ovr: 68 },
  { name: 'Loopy', team: 'SK', position: 'SUPPORT', league: 'LEC', nationality: 'EU', base_ovr: 62 },

  // LEC - NAVI
  { name: 'Adam', team: 'NAVI', position: 'TOP', league: 'LEC', nationality: 'EU', base_ovr: 66 },
  { name: 'Thayger', team: 'NAVI', position: 'JUNGLE', league: 'LEC', nationality: 'EU', base_ovr: 65 },
  { name: 'Larssen', team: 'NAVI', position: 'MID', league: 'LEC', nationality: 'EU', base_ovr: 65 },
  { name: 'Hans SamD', team: 'NAVI', position: 'ADC', league: 'LEC', nationality: 'EU', base_ovr: 60 },
  { name: 'Malrang', team: 'NAVI', position: 'SUPPORT', league: 'LEC', nationality: 'KR', base_ovr: 70 },

  // LPL - BLG
  { name: 'Bin', team: 'BLG', position: 'TOP', league: 'LPL', nationality: 'CN', base_ovr: 93 },
  { name: 'shad0w', team: 'BLG', position: 'JUNGLE', league: 'LPL', nationality: 'CN', base_ovr: 74 },
  { name: 'Knight', team: 'BLG', position: 'MID', league: 'LPL', nationality: 'CN', base_ovr: 87 },
  { name: 'Elk', team: 'BLG', position: 'ADC', league: 'LPL', nationality: 'CN', base_ovr: 85 },
  { name: 'ON', team: 'BLG', position: 'SUPPORT', league: 'LPL', nationality: 'CN', base_ovr: 80 },

  // LPL - TES
  { name: '369', team: 'TES', position: 'TOP', league: 'LPL', nationality: 'CN', base_ovr: 83 },
  { name: 'Kanavi', team: 'TES', position: 'JUNGLE', league: 'LPL', nationality: 'KR', base_ovr: 80 },
  { name: 'Creme', team: 'TES', position: 'MID', league: 'LPL', nationality: 'CN', base_ovr: 81 },
  { name: 'JackeyLove', team: 'TES', position: 'ADC', league: 'LPL', nationality: 'CN', base_ovr: 86 },
  { name: 'Hang', team: 'TES', position: 'SUPPORT', league: 'LPL', nationality: 'CN', base_ovr: 80 },

  // LPL - AL
  { name: 'Flandre', team: 'AL', position: 'TOP', league: 'LPL', nationality: 'CN', base_ovr: 88 },
  { name: 'Tarzan', team: 'AL', position: 'JUNGLE', league: 'LPL', nationality: 'KR', base_ovr: 87 },
  { name: 'Shanks', team: 'AL', position: 'MID', league: 'LPL', nationality: 'CN', base_ovr: 88 },
  { name: 'Hope', team: 'AL', position: 'ADC', league: 'LPL', nationality: 'CN', base_ovr: 82 },
  { name: 'Kael', team: 'AL', position: 'SUPPORT', league: 'LPL', nationality: 'CN', base_ovr: 85 },

  // LPL - IG
  { name: 'TheShy', team: 'IG', position: 'TOP', league: 'LPL', nationality: 'KR', base_ovr: 80 },
  { name: 'Wei', team: 'IG', position: 'JUNGLE', league: 'LPL', nationality: 'CN', base_ovr: 80 },
  { name: 'Rookie', team: 'IG', position: 'MID', league: 'LPL', nationality: 'KR', base_ovr: 81 },
  { name: 'GALA', team: 'IG', position: 'ADC', league: 'LPL', nationality: 'CN', base_ovr: 82 },
  { name: 'Meiko', team: 'IG', position: 'SUPPORT', league: 'LPL', nationality: 'CN', base_ovr: 79 },

  // LPL - WBG
  { name: 'Breathe', team: 'WBG', position: 'TOP', league: 'LPL', nationality: 'CN', base_ovr: 80 },
  { name: 'Tian', team: 'WBG', position: 'JUNGLE', league: 'LPL', nationality: 'CN', base_ovr: 83 },
  { name: 'Xiaohu', team: 'WBG', position: 'MID', league: 'LPL', nationality: 'CN', base_ovr: 83 },
  { name: 'Light', team: 'WBG', position: 'ADC', league: 'LPL', nationality: 'CN', base_ovr: 83 },
  { name: 'Crisp', team: 'WBG', position: 'SUPPORT', league: 'LPL', nationality: 'CN', base_ovr: 81 },

  // LPL - NIP
  { name: 'Solokill', team: 'NIP', position: 'TOP', league: 'LPL', nationality: 'CN', base_ovr: 77 },
  { name: 'naiyou', team: 'NIP', position: 'JUNGLE', league: 'LPL', nationality: 'CN', base_ovr: 78 },
  { name: 'Doinb', team: 'NIP', position: 'MID', league: 'LPL', nationality: 'KR', base_ovr: 80 },
  { name: 'Leave', team: 'NIP', position: 'ADC', league: 'LPL', nationality: 'CN', base_ovr: 73 },
  { name: 'Niket', team: 'NIP', position: 'SUPPORT', league: 'LPL', nationality: 'CN', base_ovr: 71 },

  // LPL - WE
  { name: 'Cube', team: 'WE', position: 'TOP', league: 'LPL', nationality: 'CN', base_ovr: 75 },
  { name: 'Monki', team: 'WE', position: 'JUNGLE', league: 'LPL', nationality: 'CN', base_ovr: 73 },
  { name: 'Karis', team: 'WE', position: 'MID', league: 'LPL', nationality: 'CN', base_ovr: 76 },
  { name: 'Taeyoon', team: 'WE', position: 'ADC', league: 'LPL', nationality: 'KR', base_ovr: 80 },
  { name: 'Vampire', team: 'WE', position: 'SUPPORT', league: 'LPL', nationality: 'CN', base_ovr: 80 },

  // LPL - LGD
  { name: 'sasi', team: 'LGD', position: 'TOP', league: 'LPL', nationality: 'CN', base_ovr: 72 },
  { name: 'Meteor', team: 'LGD', position: 'JUNGLE', league: 'LPL', nationality: 'CN', base_ovr: 70 },
  { name: 'xqw', team: 'LGD', position: 'MID', league: 'LPL', nationality: 'CN', base_ovr: 70 },
  { name: 'Sav1or', team: 'LGD', position: 'ADC', league: 'LPL', nationality: 'CN', base_ovr: 68 },
  { name: 'Ycx', team: 'LGD', position: 'SUPPORT', league: 'LPL', nationality: 'CN', base_ovr: 70 },

  // LPL - CFO
  { name: 'Rest', team: 'CFO', position: 'TOP', league: 'LPL', nationality: 'CN', base_ovr: 71 },
  { name: 'JunJia', team: 'CFO', position: 'JUNGLE', league: 'LPL', nationality: 'CN', base_ovr: 75 },
  { name: 'HongQ', team: 'CFO', position: 'MID', league: 'LPL', nationality: 'CN', base_ovr: 70 },
  { name: 'Doggo', team: 'CFO', position: 'ADC', league: 'LPL', nationality: 'TW', base_ovr: 83 },
  { name: 'Kaiwing', team: 'CFO', position: 'SUPPORT', league: 'LPL', nationality: 'TW', base_ovr: 80 },

  // LPL - TSW
  { name: 'Pun', team: 'TSW', position: 'TOP', league: 'LPL', nationality: 'CN', base_ovr: 70 },
  { name: 'Hizto', team: 'TSW', position: 'JUNGLE', league: 'LPL', nationality: 'CN', base_ovr: 71 },
  { name: 'Dire', team: 'TSW', position: 'MID', league: 'LPL', nationality: 'CN', base_ovr: 68 },
  { name: 'Eddie', team: 'TSW', position: 'ADC', league: 'LPL', nationality: 'CN', base_ovr: 70 },
  { name: 'Taki', team: 'TSW', position: 'SUPPORT', league: 'LPL', nationality: 'CN', base_ovr: 67 },

  // PCS - PSG
  { name: 'Azhi', team: 'PSG', position: 'TOP', league: 'PCS', nationality: 'TW', base_ovr: 65 },
  { name: 'Karsa', team: 'PSG', position: 'JUNGLE', league: 'PCS', nationality: 'TW', base_ovr: 77 },
  { name: 'Maple', team: 'PSG', position: 'MID', league: 'PCS', nationality: 'TW', base_ovr: 77 },
  { name: 'Betty', team: 'PSG', position: 'ADC', league: 'PCS', nationality: 'TW', base_ovr: 75 },
  { name: 'Woody', team: 'PSG', position: 'SUPPORT', league: 'PCS', nationality: 'TW', base_ovr: 71 },

  // VCS - GAM
  { name: 'Kiaya', team: 'GAM', position: 'TOP', league: 'VCS', nationality: 'VN', base_ovr: 75 },
  { name: 'Levi', team: 'GAM', position: 'JUNGLE', league: 'VCS', nationality: 'VN', base_ovr: 77 },
  { name: 'Aress', team: 'GAM', position: 'MID', league: 'VCS', nationality: 'VN', base_ovr: 68 },
  { name: 'Artemis', team: 'GAM', position: 'ADC', league: 'VCS', nationality: 'VN', base_ovr: 67 },
  { name: 'Elio', team: 'GAM', position: 'SUPPORT', league: 'VCS', nationality: 'VN', base_ovr: 66 },

  // VCS - VKE
  { name: 'Kratos', team: 'VKE', position: 'TOP', league: 'VCS', nationality: 'VN', base_ovr: 64 },
  { name: 'Gury', team: 'VKE', position: 'JUNGLE', league: 'VCS', nationality: 'VN', base_ovr: 63 },
  { name: 'Kati', team: 'VKE', position: 'MID', league: 'VCS', nationality: 'VN', base_ovr: 66 },
  { name: 'Sty1e', team: 'VKE', position: 'ADC', league: 'VCS', nationality: 'VN', base_ovr: 63 },
  { name: 'SiuLoong', team: 'VKE', position: 'SUPPORT', league: 'VCS', nationality: 'VN', base_ovr: 61 },

  // LJL - DFM
  { name: 'RayFarky', team: 'DFM', position: 'TOP', league: 'LJL', nationality: 'JP', base_ovr: 70 },
  { name: 'Citrus', team: 'DFM', position: 'JUNGLE', league: 'LJL', nationality: 'JP', base_ovr: 65 },
  { name: 'Aria', team: 'DFM', position: 'MID', league: 'LJL', nationality: 'KR', base_ovr: 73 },
  { name: 'Kakkun', team: 'DFM', position: 'ADC', league: 'LJL', nationality: 'JP', base_ovr: 71 },
  { name: 'Harp', team: 'DFM', position: 'SUPPORT', league: 'LJL', nationality: 'KR', base_ovr: 70 },

  // LJL - SHG
  { name: 'Evi', team: 'SHG', position: 'TOP', league: 'LJL', nationality: 'JP', base_ovr: 70 },
  { name: 'Courge', team: 'SHG', position: 'JUNGLE', league: 'LJL', nationality: 'JP', base_ovr: 61 },
  { name: 'FATE', team: 'SHG', position: 'MID', league: 'LJL', nationality: 'KR', base_ovr: 67 },
  { name: 'Marble', team: 'SHG', position: 'ADC', league: 'LJL', nationality: 'JP', base_ovr: 66 },
  { name: 'Gaeng', team: 'SHG', position: 'SUPPORT', league: 'LJL', nationality: 'KR', base_ovr: 66 },

  // LJL - DCG
  { name: 'Flauren', team: 'DCG', position: 'TOP', league: 'LJL', nationality: 'JP', base_ovr: 60 },
  { name: '665', team: 'DCG', position: 'JUNGLE', league: 'LJL', nationality: 'JP', base_ovr: 60 },
  { name: 'Hongsuo', team: 'DCG', position: 'MID', league: 'LJL', nationality: 'KR', base_ovr: 61 },
  { name: 'Feng', team: 'DCG', position: 'ADC', league: 'LJL', nationality: 'TW', base_ovr: 62 },
  { name: 'ShiauC', team: 'DCG', position: 'SUPPORT', league: 'LJL', nationality: 'TW', base_ovr: 63 },

  // LCS - TL
  { name: 'Impact', team: 'TL', position: 'TOP', league: 'LCS', nationality: 'KR', base_ovr: 68 },
  { name: 'Yuuji', team: 'TL', position: 'JUNGLE', league: 'LCS', nationality: 'JP', base_ovr: 66 },
  { name: 'APA', team: 'TL', position: 'MID', league: 'LCS', nationality: 'NA', base_ovr: 73 },
  { name: 'Yeon', team: 'TL', position: 'ADC', league: 'LCS', nationality: 'NA', base_ovr: 75 },
  { name: 'CoreJJ', team: 'TL', position: 'SUPPORT', league: 'LCS', nationality: 'KR', base_ovr: 70 },

  // LCS - 100T
  { name: 'Sniper', team: '100T', position: 'TOP', league: 'LCS', nationality: 'KR', base_ovr: 70 },
  { name: 'River', team: '100T', position: 'JUNGLE', league: 'LCS', nationality: 'KR', base_ovr: 68 },
  { name: 'Quid', team: '100T', position: 'MID', league: 'LCS', nationality: 'NA', base_ovr: 73 },
  { name: 'FBI', team: '100T', position: 'ADC', league: 'LCS', nationality: 'OCE', base_ovr: 75 },
  { name: 'Eyla', team: '100T', position: 'SUPPORT', league: 'LCS', nationality: 'OCE', base_ovr: 70 },

  // LCS - C9
  { name: 'Thanatos', team: 'C9', position: 'TOP', league: 'LCS', nationality: 'KR', base_ovr: 73 },
  { name: 'Balber', team: 'C9', position: 'JUNGLE', league: 'LCS', nationality: 'NA', base_ovr: 72 },
  { name: 'Loki', team: 'C9', position: 'MID', league: 'LCS', nationality: 'NA', base_ovr: 75 },
  { name: 'Zven', team: 'C9', position: 'ADC', league: 'LCS', nationality: 'EU', base_ovr: 71 },
  { name: 'Vulcan', team: 'C9', position: 'SUPPORT', league: 'LCS', nationality: 'NA', base_ovr: 70 },

  // LCS - DIG
  { name: 'SRTTY', team: 'DIG', position: 'TOP', league: 'LCS', nationality: 'NA', base_ovr: 61 },
  { name: 'LIRA', team: 'DIG', position: 'JUNGLE', league: 'LCS', nationality: 'KR', base_ovr: 64 },
  { name: 'KEINE', team: 'DIG', position: 'MID', league: 'LCS', nationality: 'NA', base_ovr: 62 },
  { name: 'TOMO', team: 'DIG', position: 'ADC', league: 'LCS', nationality: 'NA', base_ovr: 63 },
  { name: 'ISLES', team: 'DIG', position: 'SUPPORT', league: 'LCS', nationality: 'OCE', base_ovr: 66 },

  // LCS - SR
  { name: 'Fudge', team: 'SR', position: 'TOP', league: 'LCS', nationality: 'OCE', base_ovr: 68 },
  { name: 'Contractz', team: 'SR', position: 'JUNGLE', league: 'LCS', nationality: 'NA', base_ovr: 70 },
  { name: 'PALAFOX', team: 'SR', position: 'MID', league: 'LCS', nationality: 'NA', base_ovr: 63 },
  { name: 'BVOY', team: 'SR', position: 'ADC', league: 'LCS', nationality: 'NA', base_ovr: 63 },
  { name: 'CEOS', team: 'SR', position: 'SUPPORT', league: 'LCS', nationality: 'NA', base_ovr: 64 },

  // LLA - LYON
  { name: 'LICORICE', team: 'LYON', position: 'TOP', league: 'LLA', nationality: 'NA', base_ovr: 66 },
  { name: 'ODDIELAN', team: 'LYON', position: 'JUNGLE', league: 'LLA', nationality: 'LAN', base_ovr: 65 },
  { name: 'SAINT', team: 'LYON', position: 'MID', league: 'LLA', nationality: 'LAN', base_ovr: 61 },
  { name: 'HENA', team: 'LYON', position: 'ADC', league: 'LLA', nationality: 'LAN', base_ovr: 66 },
  { name: 'LYONZ', team: 'LYON', position: 'SUPPORT', league: 'LLA', nationality: 'LAN', base_ovr: 64 },

  // LLA - DSG
  { name: 'Castle', team: 'DSG', position: 'TOP', league: 'LLA', nationality: 'LAN', base_ovr: 66 },
  { name: 'Exyu', team: 'DSG', position: 'JUNGLE', league: 'LLA', nationality: 'LAN', base_ovr: 66 },
  { name: 'DARKWINGS', team: 'DSG', position: 'MID', league: 'LLA', nationality: 'LAN', base_ovr: 64 },
  { name: 'Rahel', team: 'DSG', position: 'ADC', league: 'LLA', nationality: 'LAN', base_ovr: 72 },
  { name: 'Huhu', team: 'DSG', position: 'SUPPORT', league: 'LLA', nationality: 'LAN', base_ovr: 70 },

  // LLA - PNG
  { name: 'Wizer', team: 'PNG', position: 'TOP', league: 'LLA', nationality: 'LAN', base_ovr: 61 },
  { name: 'CarioK', team: 'PNG', position: 'JUNGLE', league: 'LLA', nationality: 'LAN', base_ovr: 63 },
  { name: 'Roamer', team: 'PNG', position: 'MID', league: 'LLA', nationality: 'LAN', base_ovr: 63 },
  { name: 'TitaN', team: 'PNG', position: 'ADC', league: 'LLA', nationality: 'LAN', base_ovr: 62 },
  { name: 'Kuri', team: 'PNG', position: 'SUPPORT', league: 'LLA', nationality: 'LAN', base_ovr: 61 },

  // LLA - VKS
  { name: 'Boal', team: 'VKS', position: 'TOP', league: 'LLA', nationality: 'LAN', base_ovr: 61 },
  { name: 'Disamis', team: 'VKS', position: 'JUNGLE', league: 'LLA', nationality: 'LAN', base_ovr: 62 },
  { name: 'Mireu', team: 'VKS', position: 'MID', league: 'LLA', nationality: 'KR', base_ovr: 65 },
  { name: 'Morttheus', team: 'VKS', position: 'ADC', league: 'LLA', nationality: 'LAN', base_ovr: 62 },
  { name: 'Trymbi', team: 'VKS', position: 'SUPPORT', league: 'LLA', nationality: 'EU', base_ovr: 63 },

  // CBLOL - RED
  { name: 'fNb', team: 'RED', position: 'TOP', league: 'CBLOL', nationality: 'BR', base_ovr: 58 },
  { name: 'DOOM', team: 'RED', position: 'JUNGLE', league: 'CBLOL', nationality: 'BR', base_ovr: 63 },
  { name: 'Kaze', team: 'RED', position: 'MID', league: 'CBLOL', nationality: 'BR', base_ovr: 61 },
  { name: 'Rabelo', team: 'RED', position: 'ADC', league: 'CBLOL', nationality: 'BR', base_ovr: 62 },
  { name: 'Frosty', team: 'RED', position: 'SUPPORT', league: 'CBLOL', nationality: 'BR', base_ovr: 61 },

  // CBLOL - LOUD
  { name: 'Robo', team: 'LOUD', position: 'TOP', league: 'CBLOL', nationality: 'BR', base_ovr: 61 },
  { name: 'Gryffinn', team: 'LOUD', position: 'JUNGLE', league: 'CBLOL', nationality: 'BR', base_ovr: 65 },
  { name: 'Jool', team: 'LOUD', position: 'MID', league: 'CBLOL', nationality: 'BR', base_ovr: 65 },
  { name: 'Route', team: 'LOUD', position: 'ADC', league: 'CBLOL', nationality: 'KR', base_ovr: 66 },
  { name: 'RedBert', team: 'LOUD', position: 'SUPPORT', league: 'CBLOL', nationality: 'BR', base_ovr: 61 },

  // CBLOL - FUR
  { name: 'Guigo', team: 'FUR', position: 'TOP', league: 'CBLOL', nationality: 'BR', base_ovr: 58 },
  { name: 'Tatu', team: 'FUR', position: 'JUNGLE', league: 'CBLOL', nationality: 'BR', base_ovr: 60 },
  { name: 'Tutsz', team: 'FUR', position: 'MID', league: 'CBLOL', nationality: 'BR', base_ovr: 57 },
  { name: 'Ayu', team: 'FUR', position: 'ADC', league: 'CBLOL', nationality: 'BR', base_ovr: 58 },
  { name: 'JoJo', team: 'FUR', position: 'SUPPORT', league: 'CBLOL', nationality: 'BR', base_ovr: 57 },

  // CBLOL - FXW7
  { name: 'curty', team: 'FXW7', position: 'TOP', league: 'CBLOL', nationality: 'BR', base_ovr: 57 },
  { name: 'Yampi', team: 'FXW7', position: 'JUNGLE', league: 'CBLOL', nationality: 'BR', base_ovr: 60 },
  { name: 'Fuuu', team: 'FXW7', position: 'MID', league: 'CBLOL', nationality: 'BR', base_ovr: 63 },
  { name: 'Marvin', team: 'FXW7', position: 'ADC', league: 'CBLOL', nationality: 'BR', base_ovr: 62 },
  { name: 'ProDelta', team: 'FXW7', position: 'SUPPORT', league: 'CBLOL', nationality: 'BR', base_ovr: 61 },

  // LLA - ISG
  { name: 'ZOEN', team: 'ISG', position: 'TOP', league: 'LLA', nationality: 'LAN', base_ovr: 61 },
  { name: 'Josedeodo', team: 'ISG', position: 'JUNGLE', league: 'LLA', nationality: 'LAN', base_ovr: 55 },
  { name: 'Leza', team: 'ISG', position: 'MID', league: 'LLA', nationality: 'LAN', base_ovr: 55 },
  { name: 'Snaker', team: 'ISG', position: 'ADC', league: 'LLA', nationality: 'LAN', base_ovr: 56 },
  { name: 'Ackerman', team: 'ISG', position: 'SUPPORT', league: 'LLA', nationality: 'LAN', base_ovr: 57 },

  // LLA - LEV
  { name: 'Zothve', team: 'LEV', position: 'TOP', league: 'LLA', nationality: 'LAN', base_ovr: 56 },
  { name: 'SCARY', team: 'LEV', position: 'JUNGLE', league: 'LLA', nationality: 'LAN', base_ovr: 51 },
  { name: 'Hauz', team: 'LEV', position: 'MID', league: 'LLA', nationality: 'LAN', base_ovr: 56 },
  { name: 'ceo', team: 'LEV', position: 'ADC', league: 'LLA', nationality: 'LAN', base_ovr: 57 },
  { name: 'TopLop', team: 'LEV', position: 'SUPPORT', league: 'LLA', nationality: 'LAN', base_ovr: 55 },
];

export class ProPlayerService {
  // 프로 선수 데이터 초기화
  static async initializeProPlayers() {
    try {
      console.log('Initializing pro players data...');

      // 기존 데이터 확인
      const existing = await pool.query('SELECT COUNT(*) as count FROM pro_players');
      if (existing[0].count > 0) {
        console.log(`Pro players already initialized (${existing[0].count} players)`);
        return;
      }

      // 선수 데이터 삽입
      for (const player of PRO_PLAYERS_DATA) {
        await pool.query(
          `INSERT INTO pro_players (name, team, position, league, nationality, base_ovr)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [player.name, player.team, player.position, player.league, player.nationality, player.base_ovr]
        );
      }

      console.log(`Initialized ${PRO_PLAYERS_DATA.length} pro players`);
    } catch (error) {
      console.error('Failed to initialize pro players:', error);
      throw error;
    }
  }

  // 선수팩 초기화
  static async initializePlayerPacks() {
    try {
      const existing = await pool.query('SELECT COUNT(*) as count FROM player_packs');
      if (existing[0].count > 0) {
        return;
      }

      // 일반 선수팩
      await pool.query(
        `INSERT INTO player_packs (name, price_gold, description, pack_type)
         VALUES ('일반 선수팩', 10000, '랜덤 선수 1명 획득', 'NORMAL')`
      );

      console.log('Initialized player packs');
    } catch (error) {
      console.error('Failed to initialize player packs:', error);
      throw error;
    }
  }

  // 선수팩 개봉
  static async openPack(teamId: number, packId: number) {
    try {
      // 팩 정보 확인
      const packs = await pool.query('SELECT * FROM player_packs WHERE id = ?', [packId]);
      if (packs.length === 0) {
        throw new Error('Pack not found');
      }
      const pack = packs[0];

      // 팀 골드 확인
      const teams = await pool.query('SELECT gold FROM teams WHERE id = ?', [teamId]);
      if (teams.length === 0) {
        throw new Error('Team not found');
      }
      if (teams[0].gold < pack.price_gold) {
        throw new Error('Not enough gold');
      }

      // 골드 차감
      await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [pack.price_gold, teamId]);

      // 랜덤 선수 선택
      const proPlayers = await pool.query('SELECT * FROM pro_players WHERE is_active = true');
      const randomPlayer = proPlayers[Math.floor(Math.random() * proPlayers.length)];

      // 스탯 생성 (기준 OVR ±15 범위)
      const baseOvr = randomPlayer.base_ovr;
      const mental = Math.max(1, Math.min(200, baseOvr + Math.floor(Math.random() * 31) - 15));
      const teamfight = Math.max(1, Math.min(200, baseOvr + Math.floor(Math.random() * 31) - 15));
      const focus = Math.max(1, Math.min(200, baseOvr + Math.floor(Math.random() * 31) - 15));
      const laning = Math.max(1, Math.min(200, baseOvr + Math.floor(Math.random() * 31) - 15));
      const ovr = Math.round((mental + teamfight + focus + laning) / 4);

      // 카드 생성
      const cardResult = await pool.query(
        `INSERT INTO player_cards (pro_player_id, team_id, card_type, mental, teamfight, focus, laning, ovr)
         VALUES (?, ?, 'NORMAL', ?, ?, ?, ?, ?)`,
        [randomPlayer.id, teamId, mental, teamfight, focus, laning, ovr]
      );

      // 개봉 기록
      await pool.query(
        `INSERT INTO pack_openings (team_id, pack_id, player_card_id)
         VALUES (?, ?, ?)`,
        [teamId, packId, cardResult.insertId]
      );

      // 결과 반환
      return {
        card_id: cardResult.insertId,
        player: {
          name: randomPlayer.name,
          team: randomPlayer.team,
          position: randomPlayer.position,
          league: randomPlayer.league,
          nationality: randomPlayer.nationality,
        },
        stats: {
          mental,
          teamfight,
          focus,
          laning,
          ovr,
        },
        card_type: 'NORMAL',
      };
    } catch (error) {
      console.error('Failed to open pack:', error);
      throw error;
    }
  }

  // 팀의 선수 카드 목록 조회
  static async getTeamCards(teamId: number) {
    try {
      const cards = await pool.query(
        `SELECT pc.*, pp.name, pp.team as pro_team, pp.position, pp.league, pp.nationality
         FROM player_cards pc
         JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE pc.team_id = ?
         ORDER BY pc.ovr DESC`,
        [teamId]
      );
      return cards;
    } catch (error) {
      console.error('Failed to get team cards:', error);
      throw error;
    }
  }

  // 케미스트리 계산
  static calculateChemistry(cards: any[]) {
    if (cards.length < 5) return 0;

    let chemistryBonus = 0;

    // 스타터 카드만 필터
    const starters = cards.filter(c => c.is_starter);
    if (starters.length < 5) return 0;

    // 같은 리그 5명 체크
    const leagues = starters.map(c => c.league);
    const leagueCounts: { [key: string]: number } = {};
    leagues.forEach(l => {
      leagueCounts[l] = (leagueCounts[l] || 0) + 1;
    });
    if (Object.values(leagueCounts).some(count => count >= 5)) {
      chemistryBonus += 5;
    }

    // 같은 국적 5명 체크
    const nationalities = starters.map(c => c.nationality);
    const natCounts: { [key: string]: number } = {};
    nationalities.forEach(n => {
      natCounts[n] = (natCounts[n] || 0) + 1;
    });
    if (Object.values(natCounts).some(count => count >= 5)) {
      chemistryBonus += 3;
    }

    return chemistryBonus;
  }
}
