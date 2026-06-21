#!/bin/bash
# teardown.sh — Elimina todos los recursos GCP del proyecto.
# Uso: bash scripts/teardown.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/gcp.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Falta $ENV_FILE."
  exit 1
fi

source "$ENV_FILE"

echo "=== Financial Helper — Teardown ==="
echo
echo "Se eliminarán los siguientes recursos:"
echo "  Cloud Run:        $BACKEND_SERVICE, $FRONTEND_SERVICE (región: $REGION)"
echo "  Cloud SQL:        $DB_INSTANCE"
echo "  Artifact Registry: $AR_REPO (región: $REGION)"
echo "  Secrets:          DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET"
echo
read -rp "¿Confirmar? Escribí 'si' para continuar: " CONFIRM
if [ "$CONFIRM" != "si" ]; then
  echo "Cancelado."
  exit 0
fi

gcloud config set project "$PROJECT_ID"

echo
echo "[1/4] Eliminando servicios Cloud Run..."
gcloud run services delete "$BACKEND_SERVICE"  --region "$REGION" --quiet 2>/dev/null && echo "  $BACKEND_SERVICE eliminado"  || echo "  $BACKEND_SERVICE no existía"
gcloud run services delete "$FRONTEND_SERVICE" --region "$REGION" --quiet 2>/dev/null && echo "  $FRONTEND_SERVICE eliminado" || echo "  $FRONTEND_SERVICE no existía"

echo "[2/4] Eliminando Cloud SQL..."
gcloud sql instances delete "$DB_INSTANCE" --quiet 2>/dev/null && echo "  $DB_INSTANCE eliminado" || echo "  $DB_INSTANCE no existía"

echo "[3/4] Eliminando Artifact Registry..."
gcloud artifacts repositories delete "$AR_REPO" \
  --location "$REGION" --quiet 2>/dev/null && echo "  $AR_REPO eliminado" || echo "  $AR_REPO no existía"

echo "[4/4] Eliminando Secrets..."
for SECRET in DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET; do
  gcloud secrets delete "$SECRET" --quiet 2>/dev/null && echo "  $SECRET eliminado" || echo "  $SECRET no existía"
done

echo
echo "════════════════════════════════════════════"
echo " Teardown completo."
echo " El Service Account '$SA_NAME' NO fue eliminado."
echo " Si querés eliminarlo también:"
echo "   gcloud iam service-accounts delete ${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "════════════════════════════════════════════"
echo
