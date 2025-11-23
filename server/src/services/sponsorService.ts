import pool from '../database/db.js';

// 스페셜 스폰서 목록 (prefix: 팀 이름 앞에 붙는 이름)
const SPECIAL_SPONSORS = [
  { name: '삼성전자', prefix: 'SAMSUNG', gold: 100000000, diamond: 100 },
  { name: 'SK텔레콤', prefix: 'SK', gold: 80000000, diamond: 80 },
  { name: '현대자동차', prefix: 'HYUNDAI', gold: 90000000, diamond: 90 },
  { name: 'LG전자', prefix: 'LG', gold: 75000000, diamond: 75 },
  { name: '네이버', prefix: 'NAVER', gold: 70000000, diamond: 70 },
  { name: '카카오', prefix: 'KAKAO', gold: 65000000, diamond: 65 },
  { name: '라이엇 게임즈', prefix: 'RIOT', gold: 120000000, diamond: 150 }
];

export class SponsorService {
  // 스페셜 스폰서 확률 체크 (0.001% = 1/100000)
  static readonly SPECIAL_SPONSOR_CHANCE = 0.00001; // 0.001%

  // 팀의 스페셜 스폰서 체크 (1시간마다 호출)
  static async checkSpecialSponsor(teamId: number): Promise<boolean> {
    try {
      // 랜덤 확률 체크 (0.001%)
      const roll = Math.random();
      if (roll > this.SPECIAL_SPONSOR_CHANCE) {
        return false;
      }

      // 이미 활성화된 스페셜 스폰서가 있는지 확인
      const existing = await pool.query(
        `SELECT * FROM special_sponsors
         WHERE team_id = ? AND expires_at > NOW() AND claimed = false`,
        [teamId]
      );

      if (existing.length > 0) {
        return false; // 이미 있으면 추가 생성 안 함
      }

      // 랜덤 스폰서 선택
      const sponsor = SPECIAL_SPONSORS[Math.floor(Math.random() * SPECIAL_SPONSORS.length)];

      // 1시간 후 만료
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const year = expiresAt.getFullYear();
      const month = String(expiresAt.getMonth() + 1).padStart(2, '0');
      const day = String(expiresAt.getDate()).padStart(2, '0');
      const hours = String(expiresAt.getHours()).padStart(2, '0');
      const minutes = String(expiresAt.getMinutes()).padStart(2, '0');
      const seconds = String(expiresAt.getSeconds()).padStart(2, '0');
      const expiresAtStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

      await pool.query(
        `INSERT INTO special_sponsors (team_id, sponsor_name, bonus_gold, bonus_diamond, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [teamId, sponsor.name, sponsor.gold, sponsor.diamond, expiresAtStr]
      );

      console.log(`Special sponsor ${sponsor.name} appeared for team ${teamId}!`);
      return true;

    } catch (error) {
      console.error('Failed to check special sponsor:', error);
      return false;
    }
  }

  // 모든 팀에 대해 스페셜 스폰서 체크 (1시간마다 cron에서 호출)
  static async checkAllTeamsForSpecialSponsor() {
    try {
      const teams = await pool.query('SELECT id FROM teams WHERE user_id IS NOT NULL');

      let spawned = 0;
      for (const team of teams) {
        const result = await this.checkSpecialSponsor(team.id);
        if (result) spawned++;
      }

      console.log(`Special sponsor check completed. Spawned: ${spawned}/${teams.length}`);
      return spawned;

    } catch (error) {
      console.error('Failed to check all teams for special sponsor:', error);
      throw error;
    }
  }

  // 팀의 활성 스페셜 스폰서 조회
  static async getActiveSpecialSponsor(teamId: number) {
    try {
      const sponsors = await pool.query(
        `SELECT * FROM special_sponsors
         WHERE team_id = ? AND expires_at > NOW() AND claimed = false
         ORDER BY created_at DESC
         LIMIT 1`,
        [teamId]
      );

      if (sponsors.length === 0) {
        return null;
      }

      return sponsors[0];

    } catch (error) {
      console.error('Failed to get active special sponsor:', error);
      throw error;
    }
  }

  // 스페셜 스폰서 보상 수령
  static async claimSpecialSponsor(teamId: number, sponsorId: number) {
    try {
      // 스폰서 확인
      const sponsors = await pool.query(
        `SELECT * FROM special_sponsors
         WHERE id = ? AND team_id = ? AND expires_at > NOW() AND claimed = false`,
        [sponsorId, teamId]
      );

      if (sponsors.length === 0) {
        throw new Error('스페셜 스폰서를 찾을 수 없거나 이미 수령했습니다');
      }

      const sponsor = sponsors[0];

      // 스폰서 정보에서 prefix 찾기
      const sponsorInfo = SPECIAL_SPONSORS.find(s => s.name === sponsor.sponsor_name);
      const prefix = sponsorInfo?.prefix || '';

      // 팀 이름 조회
      const teams = await pool.query('SELECT name FROM teams WHERE id = ?', [teamId]);
      if (teams.length === 0) {
        throw new Error('팀을 찾을 수 없습니다');
      }

      let teamName = teams[0].name;

      // 기존 스폰서 prefix 제거 (다른 스폰서가 있었을 경우)
      for (const s of SPECIAL_SPONSORS) {
        if (teamName.startsWith(s.prefix + ' ')) {
          teamName = teamName.substring(s.prefix.length + 1);
          break;
        }
      }

      // 새 스폰서 prefix 추가
      const newTeamName = prefix ? `${prefix} ${teamName}` : teamName;

      // 보상 지급 및 팀 이름 변경
      await pool.query(
        'UPDATE teams SET gold = gold + ?, diamond = diamond + ?, name = ? WHERE id = ?',
        [sponsor.bonus_gold, sponsor.bonus_diamond, newTeamName, teamId]
      );

      // 수령 완료 처리
      await pool.query(
        'UPDATE special_sponsors SET claimed = true WHERE id = ?',
        [sponsorId]
      );

      console.log(`Team ${teamId} claimed special sponsor ${sponsor.sponsor_name}: ${sponsor.bonus_gold} gold, ${sponsor.bonus_diamond} diamond. New name: ${newTeamName}`);

      return {
        sponsor_name: sponsor.sponsor_name,
        gold: sponsor.bonus_gold,
        diamond: sponsor.bonus_diamond,
        new_team_name: newTeamName
      };

    } catch (error) {
      console.error('Failed to claim special sponsor:', error);
      throw error;
    }
  }

  // 만료된 스페셜 스폰서 정리
  static async cleanupExpiredSponsors() {
    try {
      const result = await pool.query(
        'DELETE FROM special_sponsors WHERE expires_at < NOW()'
      );

      if (result.affectedRows > 0) {
        console.log(`Cleaned up ${result.affectedRows} expired special sponsors`);
      }

      return result.affectedRows;

    } catch (error) {
      console.error('Failed to cleanup expired sponsors:', error);
      throw error;
    }
  }
}

export default SponsorService;
