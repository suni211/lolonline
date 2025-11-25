import pool from '../database/db.js';

export class FinanceService {
  // 거래 기록
  static async logTransaction(
    teamId: number,
    transactionType: 'INCOME' | 'EXPENSE',
    category: string,
    amount: number,
    description?: string,
    referenceId?: number,
    referenceType?: string
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO financial_transactions (team_id, transaction_type, category, amount, description, reference_id, reference_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [teamId, transactionType, category, amount, description, referenceId, referenceType]
      );
    } catch (error) {
      console.error('Failed to log financial transaction:', error);
      // Don't throw - transaction logging shouldn't break the main flow
    }
  }

  // 골드 지급 (수입)
  static async addGold(
    teamId: number,
    amount: number,
    category: string,
    description?: string,
    referenceId?: number,
    referenceType?: string
  ): Promise<void> {
    await pool.query('UPDATE teams SET gold = gold + ? WHERE id = ?', [amount, teamId]);
    await this.logTransaction(teamId, 'INCOME', category, amount, description, referenceId, referenceType);
  }

  // 골드 차감 (지출)
  static async subtractGold(
    teamId: number,
    amount: number,
    category: string,
    description?: string,
    referenceId?: number,
    referenceType?: string
  ): Promise<void> {
    await pool.query('UPDATE teams SET gold = gold - ? WHERE id = ?', [amount, teamId]);
    await this.logTransaction(teamId, 'EXPENSE', category, amount, description, referenceId, referenceType);
  }

  // 경기 보상 지급 (승리)
  static async giveMatchReward(teamId: number, matchId: number, isWin: boolean, attendance: number): Promise<number> {
    const baseReward = isWin ? 5000000 : 1000000;
    const attendanceBonus = Math.floor(attendance * 100); // 관중 1명당 100골드
    const totalReward = baseReward + attendanceBonus;

    const description = isWin
      ? `경기 승리 보상 (관중 ${attendance.toLocaleString()}명)`
      : `경기 참가 보상 (관중 ${attendance.toLocaleString()}명)`;

    await this.addGold(teamId, totalReward, isWin ? 'MATCH_WIN' : 'MATCH_PARTICIPATION', description, matchId, 'match');

    return totalReward;
  }
}

export default FinanceService;
