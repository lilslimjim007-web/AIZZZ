#!/bin/bash

echo "🚀 AIZZZ Setup Script"
echo "===================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"

# Backend setup
echo ""
echo -e "${YELLOW}📦 Setting up backend...${NC}"
cd backend
npm install
cp .env.example .env

echo -e "${GREEN}✅ Backend dependencies installed${NC}"
echo ""
echo -e "${YELLOW}⚠️  Edit backend/.env and add your ANTHROPIC_API_KEY${NC}"
echo "   Get a key at https://console.anthropic.com"

# Frontend setup
cd ../frontend
echo ""
echo -e "${YELLOW}📦 Setting up frontend...${NC}"
npm install
cp .env.example .env

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "   1. Edit backend/.env with your Anthropic API key"
echo "   2. Open two terminals:"
echo "      Terminal 1: cd backend && npm start"
echo "      Terminal 2: cd frontend && npm start"
echo "   3. Visit http://localhost:3000"
echo ""
echo -e "${GREEN}🎉 Ready to chat with Luna!${NC}"
