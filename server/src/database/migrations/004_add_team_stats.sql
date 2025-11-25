-- 팀 스탯 추가 (케미스트리, 사기, 스트레스)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_chemistry INT DEFAULT 50 CHECK (team_chemistry >= 0 AND team_chemistry <= 100);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_morale INT DEFAULT 70 CHECK (team_morale >= 0 AND team_morale <= 100);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_stress INT DEFAULT 30 CHECK (team_stress >= 0 AND team_stress <= 100);
