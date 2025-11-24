import pool from '../database/db.js';

export class YouthAcademyService {
  // 유스 아카데미 정보 조회
  static async getAcademy(teamId: number) {
    try {
      let academy = await pool.query(
        `SELECT * FROM youth_academy WHERE team_id = ?`,
        [teamId]
      );

      // 아카데미가 없으면 생성
      if (academy.length === 0) {
        await pool.query(
          `INSERT INTO youth_academy (team_id, level, capacity, training_quality, scouting_range)
           VALUES (?, 1, 5, 50, 1)`,
          [teamId]
        );
        academy = await pool.query(
          `SELECT * FROM youth_academy WHERE team_id = ?`,
          [teamId]
        );
      }

      // 유스 선수들 조회
      const youthPlayers = await pool.query(
        `SELECT * FROM youth_players WHERE team_id = ? ORDER BY potential DESC`,
        [teamId]
      );

      // 다음 레벨 업그레이드 비용 조회
      let nextUpgradeCost = null;
      if (academy[0].level < 5) {
        const costs = await pool.query(
          `SELECT upgrade_cost FROM facility_costs WHERE facility_type = 'ACADEMY' AND level = ?`,
          [academy[0].level + 1]
        );
        if (costs.length > 0) {
          nextUpgradeCost = costs[0].upgrade_cost;
        }
      }

      return {
        ...academy[0],
        players: youthPlayers,
        nextUpgradeCost
      };
    } catch (error) {
      console.error('Get academy error:', error);
      throw error;
    }
  }

  // 아카데미 업그레이드
  static async upgradeAcademy(teamId: number) {
    try {
      const academy = await pool.query(
        `SELECT * FROM youth_academy WHERE team_id = ?`,
        [teamId]
      );

      if (academy.length === 0) {
        throw new Error('아카데미를 찾을 수 없습니다');
      }

      const current = academy[0];
      if (current.level >= 5) {
        throw new Error('이미 최대 레벨입니다');
      }

      // 업그레이드 비용
      const costs = await pool.query(
        `SELECT upgrade_cost FROM facility_costs WHERE facility_type = 'ACADEMY' AND level = ?`,
        [current.level + 1]
      );

      if (costs.length === 0) {
        throw new Error('업그레이드 정보를 찾을 수 없습니다');
      }

      const upgradeCost = costs[0].upgrade_cost;

      // 골드 확인
      const team = await pool.query('SELECT gold FROM teams WHERE id = ?', [teamId]);
      if (team.length === 0 || team[0].gold < upgradeCost) {
        throw new Error('골드가 부족합니다');
      }

      // 골드 차감
      await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [upgradeCost, teamId]);

      // 아카데미 업그레이드
      await pool.query(
        `UPDATE youth_academy SET
          level = level + 1,
          capacity = capacity + 2,
          training_quality = training_quality + 10,
          scouting_range = LEAST(3, scouting_range + 1)
         WHERE team_id = ?`,
        [teamId]
      );

      // 재정 기록
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'EXPENSE', 'FACILITY', ?, ?)`,
        [teamId, upgradeCost, `아카데미 레벨 ${current.level + 1} 업그레이드`]
      );

      return {
        success: true,
        newLevel: current.level + 1,
        cost: upgradeCost
      };
    } catch (error) {
      console.error('Upgrade academy error:', error);
      throw error;
    }
  }

  // 유스 선수 스카우트
  static async scoutYouth(teamId: number) {
    try {
      const academy = await pool.query(
        `SELECT * FROM youth_academy WHERE team_id = ?`,
        [teamId]
      );

      if (academy.length === 0) {
        throw new Error('아카데미를 찾을 수 없습니다');
      }

      // 현재 유스 선수 수 확인
      const currentPlayers = await pool.query(
        `SELECT COUNT(*) as count FROM youth_players WHERE team_id = ?`,
        [teamId]
      );

      if (currentPlayers[0].count >= academy[0].capacity) {
        throw new Error('아카데미 수용 인원을 초과했습니다');
      }

      // 스카우트 비용
      const scoutCost = 1000000 * academy[0].scouting_range;

      // 골드 확인
      const team = await pool.query('SELECT gold FROM teams WHERE id = ?', [teamId]);
      if (team.length === 0 || team[0].gold < scoutCost) {
        throw new Error('골드가 부족합니다');
      }

      // 골드 차감
      await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [scoutCost, teamId]);

      // 유스 선수 생성
      const positions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
      const position = positions[Math.floor(Math.random() * positions.length)];

      // 잠재력 계산 (스카우팅 범위와 아카데미 레벨 영향)
      const basePotential = 40 + Math.floor(Math.random() * 30);
      const bonusPotential = academy[0].scouting_range * 5 + academy[0].level * 3;
      const potential = Math.min(99, basePotential + bonusPotential);

      // 현재 능력치 (잠재력의 30~50%)
      const currentOverall = Math.floor(potential * (0.3 + Math.random() * 0.2));

      // 이름 생성
      const firstNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
      const lastNames = ['민준', '서준', '도윤', '예준', '시우', '하준', '지호', '준서', '건우', '현우'];
      const name = firstNames[Math.floor(Math.random() * firstNames.length)] +
                   lastNames[Math.floor(Math.random() * lastNames.length)];

      await pool.query(
        `INSERT INTO youth_players
         (team_id, name, position, age, potential, current_overall, mental, teamfight, focus, laning)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [teamId, name, position, 16, potential, currentOverall,
         currentOverall, currentOverall, currentOverall, currentOverall]
      );

      // 재정 기록
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'EXPENSE', 'SCOUTING', ?, ?)`,
        [teamId, scoutCost, `유스 선수 스카우트: ${name}`]
      );

      return {
        success: true,
        player: { name, position, potential, currentOverall },
        cost: scoutCost
      };
    } catch (error) {
      console.error('Scout youth error:', error);
      throw error;
    }
  }

  // 유스 선수 훈련
  static async trainYouth(teamId: number, youthPlayerId: number) {
    try {
      const player = await pool.query(
        `SELECT * FROM youth_players WHERE id = ? AND team_id = ?`,
        [youthPlayerId, teamId]
      );

      if (player.length === 0) {
        throw new Error('유스 선수를 찾을 수 없습니다');
      }

      const youth = player[0];

      // 아카데미 정보
      const academy = await pool.query(
        `SELECT training_quality FROM youth_academy WHERE team_id = ?`,
        [teamId]
      );

      // 훈련 효과 계산
      const trainingQuality = academy[0]?.training_quality || 50;
      const growthRate = trainingQuality / 100;

      // 각 스탯 증가 (0~2)
      const mentalGrowth = Math.floor(Math.random() * 3 * growthRate);
      const teamfightGrowth = Math.floor(Math.random() * 3 * growthRate);
      const focusGrowth = Math.floor(Math.random() * 3 * growthRate);
      const laningGrowth = Math.floor(Math.random() * 3 * growthRate);

      // 현재 오버롤 계산
      const newMental = Math.min(youth.potential, youth.mental + mentalGrowth);
      const newTeamfight = Math.min(youth.potential, youth.teamfight + teamfightGrowth);
      const newFocus = Math.min(youth.potential, youth.focus + focusGrowth);
      const newLaning = Math.min(youth.potential, youth.laning + laningGrowth);
      const newOverall = Math.floor((newMental + newTeamfight + newFocus + newLaning) / 4);

      // 훈련 진행도 증가
      const progressGain = Math.floor(10 * growthRate);
      const newProgress = youth.training_progress + progressGain;

      // 졸업 준비 확인 (진행도 100% 이상 + 오버롤이 잠재력의 80% 이상)
      const graduationReady = newProgress >= 100 && newOverall >= youth.potential * 0.8;

      await pool.query(
        `UPDATE youth_players SET
          mental = ?, teamfight = ?, focus = ?, laning = ?,
          current_overall = ?, training_progress = ?, graduation_ready = ?
         WHERE id = ?`,
        [newMental, newTeamfight, newFocus, newLaning,
         newOverall, newProgress, graduationReady, youthPlayerId]
      );

      return {
        success: true,
        growth: {
          mental: mentalGrowth,
          teamfight: teamfightGrowth,
          focus: focusGrowth,
          laning: laningGrowth
        },
        newOverall,
        progress: newProgress,
        graduationReady
      };
    } catch (error) {
      console.error('Train youth error:', error);
      throw error;
    }
  }

  // 유스 선수 1군 승격
  static async promoteYouth(teamId: number, youthPlayerId: number) {
    try {
      const youth = await pool.query(
        `SELECT * FROM youth_players WHERE id = ? AND team_id = ?`,
        [youthPlayerId, teamId]
      );

      if (youth.length === 0) {
        throw new Error('유스 선수를 찾을 수 없습니다');
      }

      const player = youth[0];

      if (!player.graduation_ready) {
        throw new Error('아직 졸업 준비가 되지 않았습니다');
      }

      // 선수 카드 생성을 위해 players 테이블에 먼저 등록
      const playerResult = await pool.query(
        `INSERT INTO players (name, nationality, position, age, overall, popularity, salary, is_available)
         VALUES (?, 'KR', ?, ?, ?, 1, ?, false)`,
        [player.name, player.position, player.age, player.current_overall,
         Math.floor(player.current_overall * 50000)]
      );

      const playerId = playerResult.insertId;

      // 선수 카드 생성
      await pool.query(
        `INSERT INTO player_cards
         (player_id, team_id, level, mental, teamfight, focus, laning, overall, \`condition\`, is_starter)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, 100, false)`,
        [playerId, teamId, player.mental, player.teamfight, player.focus,
         player.laning, player.current_overall]
      );

      // 유스 선수 삭제
      await pool.query('DELETE FROM youth_players WHERE id = ?', [youthPlayerId]);

      return {
        success: true,
        message: `${player.name} 선수가 1군에 승격되었습니다`,
        player: {
          name: player.name,
          position: player.position,
          overall: player.current_overall
        }
      };
    } catch (error) {
      console.error('Promote youth error:', error);
      throw error;
    }
  }

  // 유스 선수 방출
  static async releaseYouth(teamId: number, youthPlayerId: number) {
    try {
      const result = await pool.query(
        `DELETE FROM youth_players WHERE id = ? AND team_id = ?`,
        [youthPlayerId, teamId]
      );

      if (result.affectedRows === 0) {
        throw new Error('유스 선수를 찾을 수 없습니다');
      }

      return { success: true, message: '유스 선수를 방출했습니다' };
    } catch (error) {
      console.error('Release youth error:', error);
      throw error;
    }
  }
}

export default YouthAcademyService;
