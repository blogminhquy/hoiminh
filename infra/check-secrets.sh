#!/usr/bin/env bash
# Chặn deploy khi Worker thiếu secret bắt buộc: API sẽ dừng khởi động (xem assertProductionSecrets).
# hoiminh-jobs không cần kiểm tra: nó đọc secret của hoiminh-api qua service binding SharedEnv.
# Dùng: infra/check-secrets.sh <tên-worker>
set -euo pipefail
worker="$1"
required=(AUTH_JWT_SECRET ENCRYPTION_KEY)
if ! list=$(pnpm --filter @hoiminh/api exec wrangler secret list --name "$worker" --format json 2>/dev/null); then
  echo "::error::Không đọc được secret của Worker $worker (chưa có Worker này?). Tạo và đặt secret theo README, mục \"Hai Worker\"."
  exit 1
fi
missing=()
for s in "${required[@]}"; do
  grep -q "\"name\": *\"$s\"" <<<"$list" || missing+=("$s")
done
if ((${#missing[@]})); then
  echo "::error::Worker $worker thiếu secret: ${missing[*]}. Đặt bằng: cd apps/api && npx wrangler secret put <TÊN> --name $worker"
  exit 1
fi
echo "Worker $worker đủ secret bắt buộc."
