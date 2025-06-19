#!/bin/bash

# URL base para auth (registro, login)
AUTH_URL="http://localhost:5000/api/auth"
# URL base para recursos protegidos (trends, articles)
API_URL="http://localhost:5000/api"

# 1. Registrar un usuario nuevo
echo "== Registrando usuario =="
curl -s -X POST "$AUTH_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "12345678",
    "name": "Test User"
  }'
echo -e "\n"

# 2. Iniciar sesión con el usuario creado
echo "== Iniciando sesión =="
LOGIN_RESPONSE=$(curl -s -X POST "$AUTH_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "12345678"
  }')
echo "$LOGIN_RESPONSE"
echo -e "\n"

# 3. Extraer el token JWT de la respuesta login
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Error: No se obtuvo token en el login."
  exit 1
fi

echo "Token JWT recibido:"
echo "$TOKEN"
echo -e "\n"

# 4. Verificar token con /verify-token (si tienes este endpoint)
echo "== Verificando token =="
curl -s -X POST "$AUTH_URL/verify-token" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\"}"
echo -e "\n"

# 5. Crear un trend manualmente
echo "== Creando un trend manualmente =="
CREATE_TREND_RESPONSE=$(curl -s -X POST "$API_URL/trends" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Trend on AI Tech",
    "description": "Description of the latest AI trend",
    "category": "technology"
  }')

echo "$CREATE_TREND_RESPONSE"
TREND_ID=$(echo "$CREATE_TREND_RESPONSE" | jq -r '._id // .id')
if [[ -z "$TREND_ID" || "$TREND_ID" == "null" ]]; then
  echo "Error: No se obtuvo ID del trend creado."
  exit 1
fi

echo -e "\n== Creando un artículo manualmente =="
CREATE_ARTICLE_RESPONSE=$(curl -s -X POST "$API_URL/articles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Article",
    "content": "This is the content of my first article on AI.",
    "category": "technology"
  }')

echo "$CREATE_ARTICLE_RESPONSE"
ARTICLE_ID=$(echo "$CREATE_ARTICLE_RESPONSE" | jq -r '._id // .id')
if [[ -z "$ARTICLE_ID" || "$ARTICLE_ID" == "null" ]]; then
  echo "Error: No se obtuvo ID del artículo creado."
  exit 1
fi

echo -e "\n== Procesando trend en artículo =="
PROCESS_RESPONSE=$(curl -s -X POST "$API_URL/trends/$TREND_ID/process" \
  -H "Authorization: Bearer $TOKEN")

echo "$PROCESS_RESPONSE"
