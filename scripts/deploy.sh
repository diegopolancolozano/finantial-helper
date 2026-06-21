#!/bin/bash
# deploy.sh — Build, push y despliega en Cloud Run sin necesidad de hacer push al repo.
# Uso: bash scripts/deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/gcp.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Falta $ENV_FILE. Copiá gcp.env.example y completá los valores."
  exit 1
fi

source "$ENV_FILE"

COMMIT=$(git -C "$ROOT_DIR" rev-parse --short HEAD)
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"
BACKEND_IMAGE="${REGISTRY}/backend:${COMMIT}"
FRONTEND_IMAGE="${REGISTRY}/frontend:${COMMIT}"
CLOUD_SQL_CONN="${PROJECT_ID}:${REGION}:${DB_INSTANCE}"

echo "=== Financial Helper — Deploy manual ==="
echo "Commit: $COMMIT | Región: $REGION"
echo

gcloud config set project "$PROJECT_ID"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ── Backend ──────────────────────────────────────────────────────────────────
echo "[1/5] Build backend..."
docker build -t "$BACKEND_IMAGE" "$ROOT_DIR/backend"
docker push "$BACKEND_IMAGE"

echo "[2/5] Deploy backend → Cloud Run..."
gcloud run deploy "$BACKEND_SERVICE" \
  --image "$BACKEND_IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --add-cloudsql-instances "$CLOUD_SQL_CONN" \
  --update-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest" \
  --set-env-vars="NODE_ENV=production,JWT_EXPIRES_IN=15m,JWT_REFRESH_EXPIRES_IN=7d,BCRYPT_ROUNDS=12" \
  --quiet

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
  --region "$REGION" --format='value(status.url)')

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "[3/5] Build frontend..."
docker build -t "$FRONTEND_IMAGE" "$ROOT_DIR/frontend"
docker push "$FRONTEND_IMAGE"

echo "[4/5] Deploy frontend → Cloud Run..."
gcloud run deploy "$FRONTEND_SERVICE" \
  --image "$FRONTEND_IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars="NEXT_PUBLIC_API_URL=${BACKEND_URL}" \
  --quiet

FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" \
  --region "$REGION" --format='value(status.url)')

# ── CORS ─────────────────────────────────────────────────────────────────────
echo "[5/5] Actualizando CORS del backend..."
gcloud run services update "$BACKEND_SERVICE" \
  --region "$REGION" \
  --update-env-vars="FRONTEND_URL=${FRONTEND_URL}" \
  --quiet

echo
echo "════════════════════════════════════════════"
echo " Deploy completo"
echo "════════════════════════════════════════════"
echo "  Backend:  $BACKEND_URL"
echo "  Frontend: $FRONTEND_URL"
echo
