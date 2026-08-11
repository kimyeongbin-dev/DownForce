#!/bin/bash
# ── 약품 DB 덤프 스크립트 (팀원 공유용) ──────────────────────────────
# 사용법:
#   1. Docker 환경 실행:  docker compose up -d postgres
#   2. 동기화 먼저 실행:  python -m scripts.crawling.sync_medicine_data --full
#   3. 이 스크립트 실행:  bash scripts/crawling/dump_medicine_data.sh
#
# 결과물:
#   - scripts/crawling/medicine_data_dump.sql  (SQL INSERT문, 팀원 공유용)
#   - 팀원은 이 파일로 DB를 복원:
#     docker compose exec -T postgres psql -U doseph_admin -d doseph_db < medicine_data_dump.sql
# ─────────────────────────────────────────────────────────────────────

set -e

DUMP_FILE="scripts/crawling/medicine_data_dump.sql"
CONTAINER="final_project-postgres-1"
DB_USER="doseph_admin"
DB_NAME="doseph_db"

echo "[1/3] pg_trgm 확장 활성화..."
docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" \
  -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

echo "[2/3] medicine_info + data_sync_log 테이블 덤프 중..."
docker compose exec -T postgres pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --table=medicine_info \
  --table=data_sync_log \
  --data-only \
  --inserts \
  --no-owner \
  --no-privileges \
  > "$DUMP_FILE"

RECORD_COUNT=$(docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" \
  -t -c "SELECT count(*) FROM medicine_info;" | tr -d '[:space:]')

echo "[3/3] 덤프 완료!"
echo "  파일: $DUMP_FILE"
echo "  약품 데이터: ${RECORD_COUNT}건"
echo "  파일 크기: $(du -h "$DUMP_FILE" | cut -f1)"
echo ""
echo "팀원 복원 방법:"
echo "  docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME < $DUMP_FILE"
