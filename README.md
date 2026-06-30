# 💕 AIZZZ - AI Girlfriend App

A full-stack web application featuring an AI girlfriend with a coin-based economy system. Chat with your AI companion, earn experience, customize her personality, and spend coins on premium features.

## ✨ Features

- **💬 AI Chatbot** - Talk to Luna, your AI girlfriend powered by Claude
- **🪙 Coin System** - Earn coins through chatting and spend them for premium responses
- **👤 User Profiles** - Manage your account, track coins, and level up
- **💕 Customization** - Personalize Luna's name and personality traits
- **✨ Progression** - Earn experience points and level up as you chat
- **🎁 Daily Rewards** - Get free coins every day
- **💾 Chat History** - Keep track of all your conversations

## 🛠️ Tech Stack

**Backend:**
- Node.js & Express.js
- SQLite3 (database)
- Anthropic Claude API (AI)
- JWT Authentication
- bcryptjs (password hashing)

**Frontend:**
- React 18
- Axios (HTTP client)
- CSS3 (responsive design)

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Anthropic API Key (get one at https://console.anthropic.com)

### Installation

#### 1. Clone and Setup Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
JWT_SECRET=your-random-secret-key
PORT=5000
```

#### 2. Setup Frontend

```bash
cd ../frontend
npm install
cp .env.example .env
```

The `.env` file should already have the correct API URL for local development.

### Running the App

You'll need two terminal windows:

**Terminal 1 - Start Backend Server:**
```bash
cd backend
npm start
```
Server runs on http://localhost:5000

**Terminal 2 - Start Frontend Development Server:**
```bash
cd frontend
npm start
```
App opens on http://localhost:3000

## 📱 Usage

1. **Create Account** - Register with a username and password
2. **Start Chatting** - Say hello to Luna!
3. **Earn Coins** - Each message earns experience (50 messages = level up)
4. **Use Coins** - Check "Premium" to spend 5 coins for enhanced responses
5. **Customize** - Go to Profile and personalize Luna's name and personality
6. **Get Rewards** - Click "Get 50 Free Coins" daily in your profile

## 💰 Coin Economy

- **Starting Coins:** 100 per new account
- **Premium Chat Cost:** 5 coins per message
- **Daily Bonus:** 50 coins (unlimited)
- **Experience:** 1 XP per message
- **Level Up:** Every 50 XP gained

## 🎨 Customization

### Change Luna's Personality

Edit `backend/server.js` line ~196 to modify the system prompt. Examples:
- "sweet and affectionate" → more romantic
- "playful and teasing" → more flirty
- "intelligent and philosophical" → more deep conversations

### Modify Coin Values

In `backend/server.js`:
- Line 234: Change `coinsPerMessage = 5` to adjust premium chat cost
- Line 310: Modify the amount given in daily bonus

## 📁 Project Structure

```
AIZZZ/
├── backend/
│   ├── server.js           # Main Express server
│   ├── database.js         # SQLite setup
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js
│   │   ├── api.js          # API client
│   │   ├── components/
│   │   │   ├── Login.js
│   │   │   ├── Chat.js
│   │   │   ├── Profile.js
│   │   │   └── *.css
│   │   └── index.js
│   ├── package.json
│   └── .env.example
└── README.md
```

## 🔐 Security Notes

- Change `JWT_SECRET` in `.env` to a random string for production
- Never commit `.env` file to version control
- Implement rate limiting for production
- Add HTTPS for production deployment

## 🚀 Deployment

### Deploy Backend to Render/Heroku

1. Push to GitHub
2. Create account on Render/Heroku
3. Connect your GitHub repo
4. Set environment variables
5. Deploy

### Deploy Frontend to Vercel/Netlify

1. Build: `npm run build`
2. Deploy the `build/` folder
3. Set `REACT_APP_API_URL` to your backend URL

## 🐛 Troubleshooting

**"API connection failed"**
- Ensure backend is running on port 5000
- Check that `REACT_APP_API_URL` is correct
- Verify CORS is enabled in Express

**"Invalid API key"**
- Get a key from https://console.anthropic.com
- Make sure it's in `.env` as `ANTHROPIC_API_KEY`

**Database locked**
- Delete `backend/app.db` and restart server
- SQLite has issues with concurrent access in some setups

## 📝 API Endpoints

**Authentication:**
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login

**User:**
- `GET /api/user/profile` - Get profile info
- `GET /api/user/balance` - Get coin balance

**Chat:**
- `POST /api/chat` - Send message to AI
- `GET /api/chat/history` - Get chat history

**Coins:**
- `POST /api/coins/add` - Add coins
- `POST /api/coins/spend` - Spend coins

**Personality:**
- `GET /api/personality` - Get girlfriend info
- `PUT /api/personality` - Update girlfriend info

## 💡 Future Features

- [ ] Multiple AI characters to chat with
- [ ] Achievements and badges
- [ ] In-app currency store
- [ ] Voice chat support
- [ ] Mobile app (React Native)
- [ ] Image generation (DALL-E integration)
- [ ] Relationship progression system
- [ ] Multiplayer social features

## 📄 License

MIT

## 💬 Support

For issues or questions:
1. Check the Troubleshooting section
2. Review API endpoint docs
3. Check server console for error messages

---

**Made with ❤️ using Claude AI**
