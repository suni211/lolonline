# 배포 및 업데이트 가이드

## 업데이트 및 빌드 방법

### 1. 코드 업데이트 (Git에서 가져오기)

```bash
# 저장소로 이동
cd ~/lolonline

# 최신 코드 가져오기
git pull origin main
# 또는
git pull origin master
```

### 2. 의존성 설치 (필요한 경우)

```bash
# 루트 디렉토리
npm install

# 서버 의존성
cd server
npm install

# 클라이언트 의존성
cd ../client
npm install
```

### 3. 빌드

#### 전체 빌드 (서버 + 클라이언트)
```bash
# 루트 디렉토리에서
npm run build
```

#### 서버만 빌드
```bash
cd server
npm run build
```

#### 클라이언트만 빌드
```bash
cd client
npm run build
```

### 4. PM2로 재시작

#### 모든 프로세스 재시작
```bash
# PM2 프로세스 확인
pm2 list

# 모든 프로세스 재시작
pm2 restart all

# 또는 특정 프로세스만 재시작
pm2 restart server
pm2 restart client
```

#### PM2로 새로 시작 (기존 프로세스 삭제 후)
```bash
# 모든 PM2 프로세스 삭제
pm2 delete all

# 서버 시작
cd ~/lolonline/server
pm2 start npm --name "server" -- start

# 클라이언트 시작
cd ~/lolonline/client
pm2 start npm --name "client" -- run preview

# 또는 ecosystem.config.js 사용 (있는 경우)
cd ~/lolonline
pm2 start ecosystem.config.js
```

### 5. 로그 확인

```bash
# 모든 로그
pm2 logs

# 서버 로그만
pm2 logs server

# 클라이언트 로그만
pm2 logs client

# 최근 50줄만 보기
pm2 logs --lines 50
```

### 6. 프로세스 상태 확인

```bash
# PM2 프로세스 목록
pm2 list

# 상세 정보
pm2 show server
pm2 show client

# 모니터링
pm2 monit
```

## 전체 업데이트 프로세스 (한 번에 실행)

```bash
# 1. 코드 업데이트
cd ~/lolonline
git pull origin main

# 2. 의존성 설치 (필요한 경우)
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. 빌드
npm run build

# 4. PM2 재시작
pm2 restart all

# 5. 로그 확인
pm2 logs --lines 30
```

## 빠른 업데이트 (의존성 변경 없을 때)

```bash
cd ~/lolonline
git pull origin main
npm run build
pm2 restart all
```

## 문제 해결

### 빌드 에러 발생 시
```bash
# 서버 빌드 에러
cd server
rm -rf dist node_modules
npm install
npm run build

# 클라이언트 빌드 에러
cd client
rm -rf dist node_modules .vite
npm install
npm run build
```

### PM2 프로세스가 안 켜질 때
```bash
# 모든 프로세스 삭제
pm2 delete all

# 수동으로 시작
cd ~/lolonline/server
npm run build
pm2 start npm --name "server" -- start

cd ~/lolonline/client
npm run build
pm2 start npm --name "client" -- run preview
```

### 포트가 이미 사용 중일 때
```bash
# 포트 사용 확인
sudo ss -tlnp | grep -E ':(4173|5000)'

# 프로세스 종료
pkill -f node
pkill -f vite

# PM2 재시작
pm2 restart all
```

## 데이터베이스 업데이트

데이터베이스 스키마가 변경된 경우:

```bash
# 서버 재시작 시 자동으로 스키마 업데이트됨
# 또는 수동으로 실행
cd ~/lolonline/server
node dist/database/init.js
```

## Nginx 재시작 (필요한 경우)

```bash
# Nginx 설정 확인
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx

# Nginx 상태 확인
sudo systemctl status nginx
```

