import pool from '../database/db.js';

export class RhythmGameService {
  // 리듬게임 곡 목록 조회
  static async getSongs(difficulty?: string) {
    try {
      let query = 'SELECT * FROM rhythm_songs WHERE 1=1';
      const params: any[] = [];

      if (difficulty) {
        query += ' AND difficulty = ?';
        params.push(difficulty);
      }

      query += ' ORDER BY created_at DESC';

      const songs = await pool.query(query, params);
      return songs;
    } catch (error) {
      console.error('Get songs error:', error);
      throw error;
    }
  }

  // 곡 상세 정보 + 악보 조회
  static async getSongWithCharts(songId: number) {
    try {
      const song = await pool.query(
        'SELECT * FROM rhythm_songs WHERE id = ?',
        [songId]
      );

      if (song.length === 0) {
        throw new Error('곡을 찾을 수 없습니다');
      }

      const charts = await pool.query(
        'SELECT * FROM rhythm_charts WHERE song_id = ? ORDER BY difficulty',
        [songId]
      );

      return {
        song: song[0],
        charts
      };
    } catch (error) {
      console.error('Get song with charts error:', error);
      throw error;
    }
  }

  // 악보의 노트 조회
  static async getChartNotes(chartId: number) {
    try {
      const notes = await pool.query(
        'SELECT * FROM rhythm_notes WHERE chart_id = ? ORDER BY timing ASC',
        [chartId]
      );

      return notes;
    } catch (error) {
      console.error('Get chart notes error:', error);
      throw error;
    }
  }

  // 리듬게임 플레이 결과 저장
  static async submitRecord(
    teamId: number,
    playerCardId: number,
    chartId: number,
    judgments: {
      perfect: number;
      good: number;
      bad: number;
      miss: number;
    },
    maxCombo: number,
    score: number,
    accuracy: number
  ) {
    try {
      // 차트 정보 조회
      const chart = await pool.query(
        'SELECT note_count FROM rhythm_charts WHERE id = ?',
        [chartId]
      );

      if (chart.length === 0) {
        throw new Error('악보를 찾을 수 없습니다');
      }

      const totalNotes = chart[0].note_count;

      // 점수 기반 보상 계산
      const accuracyPercent = Math.min(accuracy, 100);

      // 경험치: 정확도 기반 (80% 이상: 최대 보상)
      const baseExp = Math.floor(totalNotes * 5);
      const expGained = Math.floor(baseExp * (accuracyPercent / 100));

      // 골드: 점수와 정확도 기반 (1점 = 1원)
      const goldGained = Math.floor(score * (accuracyPercent / 100) * 10);

      // 팬: 1~50명 (정확도에 따라 다름)
      // 100% = 50명, 50% = 25명, 0% = 0명
      const fansGained = Math.floor(50 * (accuracyPercent / 100));

      // 플레이 기록 저장
      const result = await pool.query(
        `INSERT INTO rhythm_records
         (team_id, player_card_id, chart_id, score, accuracy, max_combo,
          perfect_count, good_count, bad_count, miss_count, exp_gained, gold_gained, fans_gained)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          teamId,
          playerCardId,
          chartId,
          score,
          accuracy,
          maxCombo,
          judgments.perfect,
          judgments.good,
          judgments.bad,
          judgments.miss,
          expGained,
          goldGained,
          fansGained
        ]
      );

      // 팀 골드 및 팬 증가
      await pool.query(
        'UPDATE teams SET gold = gold + ?, fan_count = fan_count + ? WHERE id = ?',
        [goldGained, fansGained, teamId]
      );

      // 선수 경험치 증가
      if (playerCardId) {
        await pool.query(
          'UPDATE player_cards SET exp = exp + ? WHERE id = ?',
          [expGained, playerCardId]
        );
      }

      // 재정 기록
      await pool.query(
        `INSERT INTO financial_records (team_id, record_type, category, amount, description)
         VALUES (?, 'INCOME', 'OTHER', ?, ?)`,
        [teamId, goldGained, `리듬게임 플레이 보상 (정확도: ${accuracy.toFixed(1)}%)`]
      );

      return {
        success: true,
        recordId: result.insertId,
        expGained,
        goldGained,
        fansGained,
        message: `플레이 완료! 경험치 +${expGained}, 골드 +${goldGained.toLocaleString()}, 팬 +${fansGained}명`
      };
    } catch (error) {
      console.error('Submit record error:', error);
      throw error;
    }
  }

  // 플레이 기록 조회
  static async getRecords(teamId: number, limit: number = 50) {
    try {
      const records = await pool.query(
        `SELECT rr.*, rs.title as song_title, rc.difficulty as chart_difficulty,
                COALESCE(pp.name, pc.ai_player_name) as player_name
         FROM rhythm_records rr
         JOIN rhythm_charts rc ON rr.chart_id = rc.id
         JOIN rhythm_songs rs ON rc.song_id = rs.id
         LEFT JOIN player_cards pc ON rr.player_card_id = pc.id
         LEFT JOIN pro_players pp ON pc.pro_player_id = pp.id
         WHERE rr.team_id = ?
         ORDER BY rr.created_at DESC
         LIMIT ?`,
        [teamId, limit]
      );

      return records;
    } catch (error) {
      console.error('Get records error:', error);
      throw error;
    }
  }

  // 팀 리듬게임 통계
  static async getTeamStats(teamId: number) {
    try {
      const stats = await pool.query(
        `SELECT
           COUNT(*) as total_plays,
           AVG(accuracy) as avg_accuracy,
           MAX(score) as best_score,
           SUM(exp_gained) as total_exp,
           SUM(gold_gained) as total_gold,
           SUM(fans_gained) as total_fans
         FROM rhythm_records
         WHERE team_id = ?`,
        [teamId]
      );

      return stats[0];
    } catch (error) {
      console.error('Get team stats error:', error);
      throw error;
    }
  }

  // 악보 생성 또는 업데이트 (관리자용)
  static async createChart(
    songId: number,
    difficulty: string,
    creatorId: number | null,
    notes: Array<{ key_index: number; timing: number; duration?: number }>
  ) {
    try {
      // 기존 악보 확인
      const existingCharts = await pool.query(
        `SELECT id FROM rhythm_charts WHERE song_id = ? AND difficulty = ?`,
        [songId, difficulty]
      );

      let chartId: number;

      if (existingCharts.length > 0) {
        // 기존 악보 업데이트
        chartId = existingCharts[0].id;

        // 기존 노트 삭제
        await pool.query(
          `DELETE FROM rhythm_notes WHERE chart_id = ?`,
          [chartId]
        );

        // 악보 정보 업데이트
        await pool.query(
          `UPDATE rhythm_charts SET creator_id = ?, note_count = ? WHERE id = ?`,
          [creatorId, notes.length, chartId]
        );
      } else {
        // 새 악보 생성
        const chartResult = await pool.query(
          `INSERT INTO rhythm_charts (song_id, difficulty, creator_id, note_count)
           VALUES (?, ?, ?, ?)`,
          [songId, difficulty, creatorId, notes.length]
        );
        chartId = chartResult.insertId;
      }

      // 노트 추가
      for (const note of notes) {
        await pool.query(
          'INSERT INTO rhythm_notes (chart_id, key_index, timing, duration, type, slide_path) VALUES (?, ?, ?, ?, ?, ?)',
          [
            chartId,
            note.key_index,
            note.timing,
            note.duration || 0,
            note.type || 'NORMAL',
            note.slide_path ? JSON.stringify(note.slide_path) : null
          ]
        );
      }

      return {
        success: true,
        chartId,
        noteCount: notes.length,
        message: `악보 ${existingCharts.length > 0 ? '업데이트' : '생성'} 완료 (노트: ${notes.length}개)`
      };
    } catch (error) {
      console.error('Create chart error:', error);
      throw error;
    }
  }

  // 악보 삭제 (관리자용)
  static async deleteChart(chartId: number) {
    try {
      await pool.query('DELETE FROM rhythm_charts WHERE id = ?', [chartId]);

      return {
        success: true,
        message: '악보가 삭제되었습니다'
      };
    } catch (error) {
      console.error('Delete chart error:', error);
      throw error;
    }
  }
}

export default RhythmGameService;
