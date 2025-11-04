#!/bin/bash
# Test API endpoints

echo "Testing MoMe 2.0 Backend API"
echo "=============================="

echo -e "\n1. Health Check:"
curl -s http://localhost:8000/health | python3 -m json.tool

echo -e "\n\n2. Available Records:"
curl -s http://localhost:8000/api/records | python3 -m json.tool

echo -e "\n\n3. Get Context for Record 107 (fast, no AI):"
curl -s http://localhost:8000/api/context/107 | python3 -m json.tool | head -30

echo -e "\n\n4. API Documentation:"
echo "Swagger UI: http://localhost:8000/docs"
echo "ReDoc: http://localhost:8000/redoc"

echo -e "\n\nAPI server is ready!"
echo "To test full analysis (uses OpenAI credits):"
echo "curl -X POST http://localhost:8000/api/analyze -H 'Content-Type: application/json' -d '{\"record_id\": \"107\"}'"
