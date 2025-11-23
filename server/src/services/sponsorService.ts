import pool from '../database/db.js';

// 1부 리그 스페셜 스폰서 (대기업, prefix 있음)
const SPECIAL_SPONSORS = [
  { name: '삼성전자', prefix: 'SAMSUNG', gold: 100000000, diamond: 100 },
  { name: 'SK텔레콤', prefix: 'SK', gold: 80000000, diamond: 80 },
  { name: '현대자동차', prefix: 'HYUNDAI', gold: 90000000, diamond: 90 },
  { name: 'LG전자', prefix: 'LG', gold: 75000000, diamond: 75 },
  { name: '네이버', prefix: 'NAVER', gold: 70000000, diamond: 70 },
  { name: '카카오', prefix: 'KAKAO', gold: 65000000, diamond: 65 },
  { name: '라이엇 게임즈', prefix: 'RIOT', gold: 120000000, diamond: 150 }
];

// 2부/3부 일반 스폰서 (중소기업, prefix 없음, 팬수 기반)
const REGULAR_SPONSORS = [
  { name: '환성그룹', gold: 30000000, diamond: 30, minFans: 5000 },
  { name: '도도새 키즈토이', gold: 25000000, diamond: 25, minFans: 3000 },
  { name: '달링 웨딩스', gold: 28000000, diamond: 28, minFans: 4000 },
  { name: '찐하오 마라탕', gold: 20000000, diamond: 20, minFans: 2000 },
  { name: 'DOYOU', gold: 35000000, diamond: 35, minFans: 6000 },
  { name: 'TWITCH', gold: 40000000, diamond: 40, minFans: 8000 },
  { name: 'CHZZK', gold: 38000000, diamond: 38, minFans: 7000 },
  { name: '샤우베이야', gold: 22000000, diamond: 22, minFans: 2500 },
  { name: '도우미앙', gold: 24000000, diamond: 24, minFans: 3500 },
  { name: '준서오리고기', gold: 26000000, diamond: 26, minFans: 4500 },
  { name: '승진 병원', gold: 32000000, diamond: 32, minFans: 5500 },
  { name: '재훈 커머스', gold: 27000000, diamond: 27, minFans: 4000 }
];

export class SponsorService {
  // 스페셜 스폰서 확률 체크 (0.001% = 1/100000)
  static readonly SPECIAL_SPONSOR_CHANCE = 0.00001; // 0.001%

  // 팀의 스페셜 스폰서 체크 (1부 전용, 3시즌 유지)
  static async checkSpecialSponsor(teamId: number, currentSeason: number = 1): Promise<boolean> {
    try {
      // 팀 리그 확인 (1부만 스페셜 스폰서 가능)
      const teams = await pool.query(
        'SELECT league FROM teams WHERE id = ?',
        [teamId]
      );

      if (teams.length === 0 || teams[0].league !== 'SUPER') {
        return false; // 1부가 아니면 스페셜 스폰서 불가
      }

      // 랜덤 확률 체크 (0.001%)
      const roll = Math.random();
      if (roll > this.SPECIAL_SPONSOR_CHANCE) {
        return false;
      }

      // 이미 활성화된 스페셜 스폰서가 있는지 확인
      const existing = await pool.query(
        `SELECT * FROM special_sponsors
         WHERE team_id = ? AND end_season >= ? AND claimed = false`,
        [teamId, currentSeason]
      );

      if (existing.length > 0) {
        return false; // 이미 있으면 추가 생성 안 함
      }

      // 랜덤 스폰서 선택
      const sponsor = SPECIAL_SPONSORS[Math.floor(Math.random() * SPECIAL_SPONSORS.length)];

      // 3시즌 유지
      const startSeason = currentSeason;
      const endSeason = currentSeason + 2;

      await pool.query(
        `INSERT INTO special_sponsors (team_id, sponsor_name, bonus_gold, bonus_diamond, start_season, end_season)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [teamId, sponsor.name, sponsor.gold, sponsor.diamond, startSeason, endSeason]
      );

      console.log(`Special sponsor ${sponsor.name} appeared for team ${teamId}! (Season ${startSeason}-${endSeason})`);
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
  static async getActiveSpecialSponsor(teamId: number, currentSeason: number = 1) {
    try {
      const sponsors = await pool.query(
        `SELECT * FROM special_sponsors
         WHERE team_id = ? AND start_season <= ? AND end_season >= ? AND claimed = false
         ORDER BY created_at DESC
         LIMIT 1`,
        [teamId, currentSeason, currentSeason]
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
  static async claimSpecialSponsor(teamId: number, sponsorId: number, currentSeason: number = 1) {
    try {
      // 스폰서 확인
      const sponsors = await pool.query(
        `SELECT * FROM special_sponsors
         WHERE id = ? AND team_id = ? AND start_season <= ? AND end_season >= ? AND claimed = false`,
        [sponsorId, teamId, currentSeason, currentSeason]
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

  // 만료된 스페셜 스폰서 정리 (시즌 종료 후)
  static async cleanupExpiredSponsors(currentSeason: number) {
    try {
      const result = await pool.query(
        'DELETE FROM special_sponsors WHERE end_season < ?',
        [currentSeason]
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

  // ========== 일반 스폰서 (2부/3부) ==========

  // 팬수 기반 일반 스폰서 체크 및 획득 (시즌 시작 시 호출)
  static async checkRegularSponsors(teamId: number, season: number) {
    try {
      // 팀 정보 조회
      const teams = await pool.query(
        'SELECT league, fan_count FROM teams WHERE id = ?',
        [teamId]
      );

      if (teams.length === 0) {
        return [];
      }

      const team = teams[0];

      // 1부는 일반 스폰서 불가
      if (team.league === 'SUPER') {
        return [];
      }

      // 현재 시즌 스폰서 개수 확인 (최대 2개)
      const currentSponsors = await pool.query(
        'SELECT * FROM regular_sponsors WHERE team_id = ? AND season = ?',
        [teamId, season]
      );

      if (currentSponsors.length >= 2) {
        return currentSponsors; // 이미 2개 있음
      }

      // 팬수에 맞는 스폰서 필터링
      const availableSponsors = REGULAR_SPONSORS.filter(s => s.minFans <= team.fan_count);

      if (availableSponsors.length === 0) {
        return currentSponsors;
      }

      // 이미 받은 스폰서 제외
      const currentNames = currentSponsors.map((s: any) => s.sponsor_name);
      const newSponsors = availableSponsors.filter(s => !currentNames.includes(s.name));

      // 필요한 만큼 랜덤 선택
      const needed = 2 - currentSponsors.length;
      const selected = this.shuffleArray(newSponsors).slice(0, needed);

      // 스폰서 등록 및 보상 지급
      for (const sponsor of selected) {
        await pool.query(
          `INSERT INTO regular_sponsors (team_id, sponsor_name, bonus_gold, bonus_diamond, season)
           VALUES (?, ?, ?, ?, ?)`,
          [teamId, sponsor.name, sponsor.gold, sponsor.diamond, season]
        );

        // 보상 지급
        await pool.query(
          'UPDATE teams SET gold = gold + ?, diamond = diamond + ? WHERE id = ?',
          [sponsor.gold, sponsor.diamond, teamId]
        );

        console.log(`Team ${teamId} got regular sponsor ${sponsor.name}: ${sponsor.gold} gold, ${sponsor.diamond} diamond`);
      }

      // 업데이트된 스폰서 목록 반환
      const updatedSponsors = await pool.query(
        'SELECT * FROM regular_sponsors WHERE team_id = ? AND season = ?',
        [teamId, season]
      );

      return updatedSponsors;

    } catch (error) {
      console.error('Failed to check regular sponsors:', error);
      throw error;
    }
  }

  // 팀의 일반 스폰서 목록 조회
  static async getRegularSponsors(teamId: number, season: number) {
    try {
      const sponsors = await pool.query(
        'SELECT * FROM regular_sponsors WHERE team_id = ? AND season = ?',
        [teamId, season]
      );

      return sponsors;

    } catch (error) {
      console.error('Failed to get regular sponsors:', error);
      throw error;
    }
  }

  // 배열 셔플
  static shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

export default SponsorService;
