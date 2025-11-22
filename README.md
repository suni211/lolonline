# LOLPRO ONLINE

리그 오브 레전드 선수 관리 시뮬레이션 게임

## 개요

LOLPRO ONLINE은 피파온라인 2 스타일의 리그 오브 레전드 선수 관리 시뮬레이션 게임입니다. 자신만의 선수를 모으고 성장시켜 최고의 팀을 만들어보세요!

## 주요 기능

### 선수 시스템
- **선수 수집**: 최대 23명의 선수 보유 가능
- **선수 스카우팅**: 골드 또는 다이아몬드로 랜덤 선수 스카우팅
- **선수 검색**: 이름, 포지션, 오버롤로 선수 검색 및 영입
- **레벨업 시스템**: 경험치 획득 후 레벨업, 스탯 포인트 직접 분배
- **스탯 시스템**: 멘탈, 한타력, 집중력, 라인전 (각 1-300, 총 오버롤 최대 1200)
- **유니폼 강화**: 최대 10강까지 강화 가능, 성공 시 재계약비 무료 및 컨디션 증가
- **포지션 특화**: 포지션별 특화 스탯 시스템

### 장비 시스템
- 헤드셋, 키보드, 마우스, 장패드 장비
- 장비 등급: COMMON, RARE, EPIC, LEGENDARY
- 장비 강화 시스템
- 선수 스탯 증가 효과

### 리그 시스템
- **EAST LEAGUE / WEST LEAGUE**: 두 개의 리그
- **정규시즌**: 1월부터 11월까지 진행
- **플레이오프**: 상위 4팀 진출
- **월즈**: 플레이오프 우승팀 진출
- **스토브리그**: 11월부터 12월까지

### 시즌 시스템
- **자동 진행**: 6시간 = 1달
- **시즌 진행**: 1-11월 정규시즌, 11-12월 스토브리그
- **자동 시즌 종료 및 새 시즌 시작**

### 경기 시스템
- **실시간 경기**: 언제든지 경기 관전 가능
- **경기 나래이션**: 실시간 이벤트 및 나래이션
- **경기 통계**: 상세 경기 통계 제공
- **경기 보상**: 경기 승리 시 랜덤 선수 카드 획득

### 재화 시스템
- **골드**: 기본 재화
- **다이아몬드**: 프리미엄 재화
- **재계약비**: 선수 유지 비용
- **재화 교환소**: 골드 ↔ 다이아몬드 교환

### 이적 시장
- **선수 판매**: 내 선수를 시장에 등록
- **선수 구매**: 다른 팀의 선수 구매
- **경매 시스템**: 입찰 및 즉시 구매

### 미션 시스템
- **일일 미션**: 매일 새로운 미션
- **주간 미션**: 주간 미션 완료
- **출석 보상**: 연속 출석 보상

### 팀 관리
- **팀 시설**: 훈련 시설, 의료 시설, 스카우팅 시설
- **시설 업그레이드**: 골드로 시설 레벨업
- **팀 커스터마이징**: 팀 이름, 로고, 컬러 설정

### 기타 기능
- **리더보드**: 서버 전체 랭킹
- **선수 조합 보상**: 특정 선수 조합 완성 시 보상
- **선수 감정 시스템**: 만족도 관리
- **경기 실시간 이벤트**: 경기 중 랜덤 이벤트 발생

## 기술 스택

### Backend
- Node.js + Express
- TypeScript
- MariaDB
- Socket.IO (실시간 경기)
- JWT 인증

### Frontend
- React + TypeScript
- Vite
- React Router
- Socket.IO Client
- Axios

## 설치 및 실행

### 필수 요구사항
- Node.js 18+
- MariaDB 10.5+

### 설치

1. 저장소 클론
```bash
git clone <repository-url>
cd LOLONLINE
```

2. 루트 디렉토리에서 의존성 설치
```bash
npm install
```

3. 서버 의존성 설치
```bash
cd server
npm install
```

4. 클라이언트 의존성 설치
```bash
cd ../client
npm install
```

5. 환경 변수 설정
```bash
cd ../server
cp .env.example .env
```

`.env` 파일을 편집하여 데이터베이스 정보를 입력하세요:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=lolpro_online
JWT_SECRET=your-secret-key-here
```

6. 데이터베이스 생성
```sql
CREATE DATABASE lolpro_online;
```

### 실행

1. 개발 모드 (서버 + 클라이언트 동시 실행)
```bash
# 루트 디렉토리에서
npm run dev
```

2. 개별 실행
```bash
# 서버만 실행
npm run dev:server

# 클라이언트만 실행
npm run dev:client
```

3. 프로덕션 빌드 및 실행
```bash
# 전체 빌드 (서버 + 클라이언트)
npm run build

# 서버와 클라이언트 동시 실행
npm start

# 또는 개별 실행
npm run start:server  # 서버만
npm run start:client  # 클라이언트만
```

## 도메인 설정 (Cloudflare)

### Nginx 리버스 프록시 설정

1. Nginx 설치:
```bash
sudo apt update
sudo apt install nginx
```

2. 설정 파일 복사:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/berrple.com
sudo ln -s /etc/nginx/sites-available/berrple.com /etc/nginx/sites-enabled/
```

3. Nginx 설정 테스트:
```bash
sudo nginx -t
```

4. Nginx 재시작:
```bash
sudo systemctl restart nginx
sudo systemctl enable nginx
```

5. GCP 방화벽에서 80, 443 포트 열기:
```bash
gcloud compute firewall-rules create allow-http \
    --allow tcp:80 \
    --source-ranges 0.0.0.0/0

gcloud compute firewall-rules create allow-https \
    --allow tcp:443 \
    --source-ranges 0.0.0.0/0
```

6. SSL 인증서 설정 (Let's Encrypt):
```bash
# Certbot 설치
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# SSL 인증서 발급
sudo certbot --nginx -d berrple.com -d www.berrple.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

7. Cloudflare 설정:
- DNS: A 레코드로 서버 IP (34.64.110.133) 추가
- SSL/TLS: Full (strict) 모드 (서버에 SSL 인증서가 있으므로)
- 프록시: 활성화 (주황색 구름)

## 데이터베이스 스키마

데이터베이스 스키마는 `server/src/database/schema.sql`에 정의되어 있으며, 서버 시작 시 자동으로 생성됩니다.

## API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/me` - 현재 유저 정보

### 팀
- `GET /api/teams` - 팀 정보
- `PUT /api/teams` - 팀 정보 업데이트
- `POST /api/teams/facilities/upgrade` - 시설 업그레이드

### 선수
- `GET /api/players/my` - 내 선수 목록
- `GET /api/players/search` - 선수 검색
- `POST /api/players/scout` - 선수 스카우팅
- `POST /api/players/:id/recruit` - 선수 영입
- `POST /api/players/:id/levelup` - 선수 레벨업
- `POST /api/players/:id/stats` - 스탯 분배
- `POST /api/players/:id/uniform/upgrade` - 유니폼 강화

### 경기
- `GET /api/matches` - 경기 목록
- `GET /api/matches/:id` - 경기 상세 정보

### 리그
- `GET /api/leagues` - 리그 목록
- `GET /api/leagues/:id` - 리그 상세 정보
- `GET /api/leagues/:id/playoff` - 플레이오프 브래킷
- `GET /api/leagues/:id/leaderboard` - 리더보드

### 이적 시장
- `GET /api/trades/market` - 이적 시장
- `GET /api/trades/my` - 내 거래
- `POST /api/trades/sell` - 선수 판매 등록
- `POST /api/trades/buy/:id` - 선수 구매
- `POST /api/trades/exchange` - 재화 교환

### 미션
- `GET /api/missions` - 미션 목록
- `POST /api/missions/:id/claim` - 보상 수령
- `GET /api/missions/attendance` - 출석 보상

## 게임 플레이 가이드

1. **회원가입 및 팀 생성**: 로그인 시 자동으로 팀이 생성됩니다.
2. **선수 스카우팅**: 골드 또는 다이아몬드를 사용하여 선수를 스카우팅하세요.
3. **선수 성장**: 경기를 통해 경험치를 획득하고 레벨업하여 스탯을 분배하세요.
4. **유니폼 강화**: 골드를 사용하여 선수의 유니폼을 강화하세요.
5. **경기 관전**: 리그 경기를 실시간으로 관전하세요.
6. **이적 시장**: 선수를 판매하거나 구매하여 팀을 강화하세요.
7. **미션 완료**: 일일/주간 미션을 완료하여 보상을 획득하세요.

## 라이선스

ISC

## 기여

이슈 및 풀 리퀘스트를 환영합니다!

