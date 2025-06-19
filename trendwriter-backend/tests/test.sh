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

# Redactar un artículo usando el token obtenido

echo -e "\n== Redactando un artículo =="
REDACT_RESPONSE=$(curl -s -X POST "$API_URL/articles/redact" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tema": "Inteligencia Artificial en la educación",
    "contenido": "La IA está transformando el aprendizaje...",
    "categoria": "tecnología",
    "slug": "ia-en-educacion",
    "tono": "informativo",
    "longitud": "media",
    "formato": "articulo",
    "etiquetas": ["IA", "educación", "tecnología"]
  }' -v)

echo "$REDACT_RESPONSE"
