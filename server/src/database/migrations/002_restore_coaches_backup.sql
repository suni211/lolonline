-- Migration: Restore coaches backup data

-- 1. coaches_backup 테이블에서 데이터 복구
INSERT INTO coaches (id, name, nationality, role, scouting_ability, training_boost, salary, contract_expires_at, created_at, is_available)
SELECT id, name, nationality,
       CASE
           WHEN role = 'HEAD_COACH' THEN 'HEAD'
           WHEN role = 'ASSISTANT_COACH' THEN 'STRATEGY'
           ELSE COALESCE(role, 'HEAD')
       END as role,
       scouting_ability, training_boost, salary, contract_expires_at, created_at, 1 as is_available
FROM coaches_backup
WHERE id NOT IN (SELECT id FROM coaches);

-- 2. coach_ownership 백업이 있으면 복구 (이전에 저장된 ownership 데이터)
-- 참고: 기존 coach_ownership 데이터는 삭제되었으므로 필요시 수동으로 복구

-- 완료
SELECT CONCAT('복구된 코치 수: ', COUNT(*)) as status FROM coaches;
