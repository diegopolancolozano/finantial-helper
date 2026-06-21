#!/bin/bash
# setup.sh — Crea todos los recursos GCP necesarios (se ejecuta una sola vez).
# Requiere: gcloud autenticado con una cuenta que tenga roles/owner o equivalente.
# Uso: bash scripts/setup.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/gcp.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Creá $ENV_FILE copiando scripts/gcp.env.example y completando los valores."
  exit 1
fi

source "$ENV_FILE"

CLOUD_SQL_CONN="${PROJECT_ID}:${REGION}:${DB_INSTANCE}"
DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_CONN}"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== Financial Helper — Setup en GCP ==="
echo "Proyecto: $PROJECT_ID | Región: $REGION"
echo

gcloud config set project "$PROJECT_ID"

# ── APIs ────────────────────────────────────────────────────────────────────
echo "[1/6] Habilitando APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --quiet

# ── Artifact Registry ────────────────────────────────────────────────────────
echo "[2/6] Artifact Registry..."
gcloud artifacts repositories describe "$AR_REPO" \
  --location="$REGION" --quiet 2>/dev/null \
  || gcloud artifacts repositories create "$AR_REPO" \
       --repository-format=docker \
       --location="$REGION" \
       --description="Financial Helper — imágenes Docker"

# ── Cloud SQL ────────────────────────────────────────────────────────────────
echo "[3/6] Cloud SQL (db-f1-micro Enterprise, PostgreSQL 16)..."
gcloud sql instances describe "$DB_INSTANCE" --quiet 2>/dev/null \
  || gcloud sql instances create "$DB_INSTANCE" \
       --database-version=POSTGRES_16 \
       --tier=db-f1-micro \
       --edition=ENTERPRISE \
       --region="$REGION" \
       --quiet

gcloud sql databases describe "$DB_NAME" --instance="$DB_INSTANCE" --quiet 2>/dev/null \
  || gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE" --quiet

gcloud sql users describe "$DB_USER" --instance="$DB_INSTANCE" --quiet 2>/dev/null \
  || gcloud sql users create "$DB_USER" \
       --instance="$DB_INSTANCE" \
       --password="$DB_PASS" \
       --quiet

# ── Secret Manager ───────────────────────────────────────────────────────────
echo "[4/6] Secrets..."

create_or_update_secret() {
  local NAME="$1"
  local VALUE="$2"
  if gcloud secrets describe "$NAME" --quiet 2>/dev/null; then
    echo "  $NAME ya existe — actualizando versión..."
    echo -n "$VALUE" | gcloud secrets versions add "$NAME" --data-file=-
  else
    echo -n "$VALUE" | gcloud secrets create "$NAME" --data-file=-
  fi
}

create_or_update_secret "DATABASE_URL" "$DB_URL"
create_or_update_secret "JWT_SECRET"   "$(openssl rand -hex 32)"
create_or_update_secret "JWT_REFRESH_SECRET" "$(openssl rand -hex 32)"

# ── Service Account para Cloud Run ───────────────────────────────────────────
# Cloud Run necesita su propia SA con acceso a Secret Manager y Cloud SQL.
# (La SA de GitHub Actions solo se usa para desplegar, no para ejecutar el servicio.)
echo "[5/7] Service Account para Cloud Run (cloudrun-runner)..."
CR_SA_NAME="cloudrun-runner"
CR_SA_EMAIL="${CR_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts describe "$CR_SA_EMAIL" --quiet 2>/dev/null \
  || gcloud iam service-accounts create "$CR_SA_NAME" \
       --display-name="Cloud Run Service Account" \
       --quiet

for ROLE in \
  roles/secretmanager.secretAccessor \
  roles/cloudsql.client; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$CR_SA_EMAIL" \
    --role="$ROLE" \
    --condition=None \
    --quiet
done

# ── Service Account para GitHub Actions ──────────────────────────────────────
echo "[6/7] Service Account para GitHub Actions (${SA_NAME})..."
gcloud iam service-accounts describe "$SA_EMAIL" --quiet 2>/dev/null \
  || gcloud iam service-accounts create "$SA_NAME" \
       --display-name="GitHub Actions Deployer" \
       --quiet

for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" \
    --condition=None \
    --quiet
done

# ── Clave JSON ───────────────────────────────────────────────────────────────
echo "[7/7] Generando clave JSON..."
KEY_FILE="$SCRIPT_DIR/../gcp-key.json"
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL" --quiet

echo
echo "════════════════════════════════════════════"
echo " Setup completo. Próximos pasos:"
echo "════════════════════════════════════════════"
echo
echo " Agregá estos GitHub Secrets en:"
echo " https://github.com/TU_USUARIO/TU_REPO/settings/secrets/actions"
echo
echo "   GCP_PROJECT_ID          = $PROJECT_ID"
echo "   GCP_REGION              = $REGION"
echo "   GCP_AR_REPO             = $AR_REPO"
echo "   GCP_CLOUD_SQL_INSTANCE  = $CLOUD_SQL_CONN"
echo "   GCP_SA_KEY              = (contenido de gcp-key.json)"
echo
echo " Luego eliminá el archivo de clave:"
echo "   rm gcp-key.json"
echo
