#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"

echo "This script will create/update $ENV_FILE without echoing secrets."

read -rp "S3_BUCKET [AI-Image-Gen-3]: " S3_BUCKET
S3_BUCKET=${S3_BUCKET:-AI-Image-Gen-3}
read -rp "S3_REGION [us-east-005]: " S3_REGION
S3_REGION=${S3_REGION:-us-east-005}
read -rp "S3_ENDPOINT [https://s3.us-east-005.backblazeb2.com]: " S3_ENDPOINT
S3_ENDPOINT=${S3_ENDPOINT:-https://s3.us-east-005.backblazeb2.com}
read -rp "S3_FORCE_PATH_STYLE [true]: " S3_FORCE
S3_FORCE=${S3_FORCE:-true}
read -rp "NEXT_PUBLIC_SUPABASE_URL: " SUPA_URL
read -rp "NEXT_PUBLIC_SUPABASE_ANON_KEY (paste, will not echo): " -s SUPA_ANON
printf "\n"
read -rp "GOOGLE_API_KEY (paste, will not echo): " -s GOOGLE
printf "\n"
read -rp "S3_ACCESS_KEY_ID (paste, will not echo): " -s S3_ID
printf "\n"
read -rp "S3_SECRET_ACCESS_KEY (paste, will not echo): " -s S3_SECRET
printf "\n\nWriting $ENV_FILE ...\n"

# Write atomically
TMP="$(mktemp)"
{
  echo "S3_BUCKET=$S3_BUCKET"
  echo "S3_REGION=$S3_REGION"
  echo "S3_ENDPOINT=$S3_ENDPOINT"
  echo "S3_FORCE_PATH_STYLE=$S3_FORCE"
  echo "S3_ACCESS_KEY_ID=$S3_ID"
  echo "S3_SECRET_ACCESS_KEY=$S3_SECRET"
  echo "NEXT_PUBLIC_SUPABASE_URL=$SUPA_URL"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPA_ANON"
  echo "GOOGLE_API_KEY=$GOOGLE"
} > "$TMP"

mv "$TMP" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "Done. Created $ENV_FILE (600). Do not commit this file."
