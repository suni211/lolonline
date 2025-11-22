# 502 Bad Gateway 에러 해결 가이드

## 문제 진단

502 Bad Gateway는 Nginx가 백엔드 서버(Express)에 연결할 수 없을 때 발생합니다.

## 해결 방법

### 1. 서버 프로세스 확인

```bash
# PM2 프로세스 확인
pm2 list

# 서버가 실행 중인지 확인
pm2 show server
```

### 2. 포트 리스닝 확인

```bash
# 포트 5000이 열려있는지 확인
sudo ss -tlnp | grep 5000

# 또는
sudo netstat -tlnp | grep 5000
```

### 3. 서버 재시작

```bash
# 서버 빌드
cd ~/lolonline/server
npm run build

# PM2로 서버 재시작
pm2 restart server

# 또는 수동으로 시작
pm2 delete server
cd ~/lolonline/server
pm2 start npm --name "server" -- start
```

### 4. 서버 로그 확인

```bash
# 서버 로그 확인
pm2 logs server --lines 50

# 에러 확인
pm2 logs server --err --lines 50
```

### 5. Nginx 설정 확인

```bash
# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx

# Nginx 로그 확인
sudo tail -f /var/log/nginx/error.log
```

### 6. 방화벽 확인

```bash
# UFW 상태 확인
sudo ufw status

# 포트 5000이 열려있는지 확인
sudo ufw allow 5000/tcp
```

### 7. 데이터베이스 연결 확인

```bash
# MariaDB 연결 테스트
mysql -u root -p -e "USE lolpro_online; SELECT 1;"
```

### 8. 환경 변수 확인

```bash
# 서버 .env 파일 확인
cat ~/lolonline/server/.env

# 필수 변수 확인
# DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET
```

## 빠른 해결 명령어

```bash
# 1. 모든 프로세스 확인
pm2 list
sudo ss -tlnp | grep -E ':(4173|5000)'

# 2. 서버 재시작
cd ~/lolonline/server
npm run build
pm2 restart server

# 3. 로그 확인
pm2 logs server --lines 30

# 4. Nginx 재시작
sudo systemctl restart nginx
```

## 일반적인 원인

1. **서버가 실행되지 않음**: PM2 프로세스가 중지됨
2. **포트 충돌**: 다른 프로세스가 5000 포트 사용 중
3. **빌드 실패**: TypeScript 컴파일 에러
4. **데이터베이스 연결 실패**: DB 접속 정보 오류
5. **Nginx 설정 오류**: proxy_pass 설정이 잘못됨

