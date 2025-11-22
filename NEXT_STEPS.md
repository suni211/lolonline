# 다음 단계 명령어

## 1. 로컬 개발 환경에서 테스트

```bash
# 프로젝트 루트에서
npm install

# 서버와 클라이언트 동시 실행
npm start

# 또는 개별 실행
cd server && npm run dev
cd client && npm run dev
```

## 2. 프로덕션 빌드

```bash
# 서버 빌드
cd server
npm run build

# 클라이언트 빌드
cd client
npm run build
```

## 3. 프로덕션 실행 (PM2 사용)

```bash
# PM2로 서버와 클라이언트 실행
pm2 start ecosystem.config.js

# 또는 개별 실행
cd server && pm2 start npm --name "server" -- start
cd client && pm2 start npm --name "client" -- run preview -- --host 0.0.0.0 --port 4173

# PM2 상태 확인
pm2 status

# PM2 로그 확인
pm2 logs

# PM2 재시작
pm2 restart all
```

## 4. Git 업데이트 및 배포

```bash
# 변경사항 확인
git status

# 변경사항 추가
git add .

# 커밋
git commit -m "프론트엔드 UI 개선 및 이적료 협상 시스템 완성"

# 푸시
git push origin main

# 서버에서 풀 받기
git pull origin main

# 서버 재시작
pm2 restart all
```

## 5. 데이터베이스 마이그레이션 (필요시)

```bash
# 서버 재시작 시 자동으로 마이그레이션됨
# 수동 마이그레이션이 필요한 경우:
cd server
npm run build
node dist/database/init.js
```

## 6. 포트 및 방화벽 확인

```bash
# 포트 리스닝 확인
sudo ss -tlnp | grep -E ':(4173|5000)'

# 방화벽 확인
sudo ufw status

# 방화벽 포트 열기 (필요시)
sudo ufw allow 4173/tcp
sudo ufw allow 5000/tcp
```

## 7. Nginx 설정 확인 (프로덕션)

```bash
# Nginx 설정 확인
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx

# Nginx 로그 확인
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## 8. 서버 로그 확인

```bash
# PM2 로그
pm2 logs server
pm2 logs client

# 서버 직접 로그 (개발 모드)
cd server && npm run dev

# 클라이언트 직접 로그 (개발 모드)
cd client && npm run dev
```

## 9. 완료된 기능 확인

✅ FA 선수 즉시 계약 시스템
✅ 유저끼리 이적료 협상 시스템
✅ 경기 통계 시스템 (KDA, CS, 딜량, 골드 등)
✅ 프론트엔드 경기 통계 표시 (시각적 개선)
✅ ContractNegotiationModal 이적료 입력 필드
✅ 프론트엔드 UI 대대적인 개선 (애니메이션, 그래프 등)

## 10. 문제 해결

### 502 Bad Gateway 오류
```bash
# PM2 프로세스 확인
pm2 status

# 서버 재시작
pm2 restart server

# 포트 확인
sudo ss -tlnp | grep 5000
```

### 빌드 오류
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install

# TypeScript 오류 확인
cd server && npm run build
cd client && npm run build
```

### 데이터베이스 연결 오류
```bash
# 데이터베이스 상태 확인
sudo systemctl status mariadb

# 데이터베이스 재시작
sudo systemctl restart mariadb
```

