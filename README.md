# Conversa Clone - AI-Powered Marketing Automation Platform

A powerful, open-source marketing automation platform with WhatsApp/Instagram integration, AI-powered conversations, flow automation, and comprehensive analytics.

## ✨ Features

- 🤖 **AI-Powered Conversations** - Intelligent chatbot with OpenAI integration
- 💬 **Multi-Channel Support** - WhatsApp, Instagram, and Telegram
- 🎨 **Visual Flow Builder** - Drag-and-drop conversation designer
- 📊 **Analytics & A/B Testing** - Track performance and optimize conversions
- 👥 **CRM & Contact Management** - Organize and segment your contacts
- 🧠 **Marketing Brain** - AI-driven marketing insights
- 📚 **Media Library** - Manage images, videos, and documents
- 🔄 **Message Queue** - Anti-ban protection and rate limiting
- 🌐 **Multi-Chat Interface** - Handle multiple conversations simultaneously
- 📈 **Real-time Dashboard** - Monitor everything in real-time

## 🚀 Quick Start

### Option 1: Automated Setup (Linux) - Recommended

```bash
# Download the repository
git clone https://github.com/BaiseBaise886/conversa-clone.git
cd conversa-clone

# Run the automated setup script
chmod +x setup-local.sh
./setup-local.sh
```

The script will:
- Check system requirements
- Configure database
- Install dependencies
- Run migrations
- Create admin user
- Start the application

**See [LOCAL_SETUP.md](LOCAL_SETUP.md) for detailed Linux setup guide.**

### Option 2: Web-Based Setup

Start the application and use the web-based setup wizard:

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend (will show setup wizard if not configured)
cd backend && npm run dev

# In another terminal, start frontend
cd frontend && npm run dev
```

Open http://localhost:3000 and follow the setup wizard.

**See [FIRST_RUN_SETUP.md](FIRST_RUN_SETUP.md) for web-based setup guide.**

## 📋 Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **MySQL** 8.0+ or **MariaDB** 10.3+ ([MySQL](https://dev.mysql.com/downloads/) | [MariaDB](https://mariadb.org/download/))
- **npm** (comes with Node.js)

### Optional
- **Redis** - For better performance (optional)
- **OpenAI API Key** - For AI features (optional)

## 📖 Documentation

- [Local Setup Guide (Linux)](LOCAL_SETUP.md) - Automated setup script
- [First-Run Setup Guide](FIRST_RUN_SETUP.md) - Web-based setup wizard
- [Setup Guide](SETUP_GUIDE.md) - General setup instructions
- [AI Features](AI_SETUP_GUIDE.md) - Configure AI capabilities
- [Analytics & A/B Testing](AB_TESTING_ANALYTICS_GUIDE.md) - Advanced analytics
- [Multimedia Guide](MULTIMEDIA_GUIDE.md) - Media handling
- [Production Deployment](PRODUCTION_DEPLOYMENT_GUIDE.md) - Deploy to production
- [API Documentation](API_DOCUMENTATION.md) - API reference

## 🔧 Manual Setup

<details>
<summary>Click to expand manual setup instructions</summary>

### 1. Clone Repository
```bash
git clone https://github.com/BaiseBaise886/conversa-clone.git
cd conversa-clone
```

### 2. Create Database
```bash
mysql -u root -p
CREATE DATABASE conversa_clone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;
```

### 3. Configure Environment

**Backend (.env):**
```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials
```

**Frontend (.env):**
```bash
cd frontend
cp .env.example .env
# Edit .env with API URL
```

### 4. Install Dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Run Migrations
```bash
cd backend
npm run migrate
```

### 6. Start Services
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 7. Access Application
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

</details>

## 🎯 Usage

After setup, you can:

1. **Login** with your admin credentials
2. **Connect Channels** - Add WhatsApp or Instagram accounts
3. **Create Flows** - Design conversation automations
4. **Add Contacts** - Import or add contacts manually
5. **Start Conversations** - Use multi-chat interface
6. **View Analytics** - Monitor performance and insights

## 🏗️ Architecture

```
conversa-clone/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   ├── config/      # Configuration
│   │   ├── middleware/  # Express middleware
│   │   └── websocket/   # WebSocket handlers
│   └── migrations/      # Database schemas
│
├── frontend/            # React + Vite
│   └── src/
│       ├── components/  # React components
│       ├── store.js     # State management
│       └── styles.css   # Styling
│
└── docs/               # Documentation
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `GET /api/contacts/:id` - Get contact details

### Channels
- `GET /api/channels` - List channels
- `POST /api/channels/whatsapp` - Create WhatsApp channel
- `GET /api/channels/:id/qr` - Get QR code

### Flows
- `GET /api/flows` - List flows
- `POST /api/flows` - Create flow
- `PUT /api/flows/:id` - Update flow

### Messages
- `GET /api/messages` - List messages
- `POST /api/messages/send` - Send message

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for complete API reference.

## 🔐 Security

This project includes:
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ JWT authentication
- ✅ Password hashing (bcrypt)
- ✅ Input validation
- ✅ Security headers (helmet)

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Express.js, React, Socket.io
- Database: MySQL/MariaDB
- AI: OpenAI GPT
- Icons: Unicode emojis

## 📞 Support

- 📧 Email: support@conversa-clone.com
- 🐛 Issues: [GitHub Issues](https://github.com/BaiseBaise886/conversa-clone/issues)
- 📖 Docs: [Documentation](https://github.com/BaiseBaise886/conversa-clone/tree/main/docs)

## 🗺️ Roadmap

- [ ] Telegram integration
- [ ] SMS channel support
- [ ] Advanced AI training
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Advanced analytics dashboards
- [ ] Team collaboration features
- [ ] API rate limiting tiers

## ⭐ Star History

If you find this project useful, please consider giving it a star! ⭐

---

Made with ❤️ by [BaiseBaise886](https://github.com/BaiseBaise886)
