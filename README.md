# D8-LPA Community Platform

A modern dating and community platform built for the LPA (Little People of America) community. Connect, browse profiles, message, and attend events with real-time updates.

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) - React framework with server-side rendering and API routes
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) - Utility-first CSS framework
- **State Management**: [Zustand](https://zustand-demo.vercel.app/) - Lightweight state management
- **Real-time Communication**: [Socket.io Client](https://socket.io/) - WebSocket communication for messaging and notifications
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) - Form management and validation
- **UI Components**: [Radix UI](https://www.radix-ui.com/) - Unstyled, accessible component primitives
- **Icons**: [Lucide React](https://lucide.dev/) - Clean, consistent icon library
- **Animations**: [Tailwind CSS Animate](https://github.com/jamiebuilds/tailwindcss-animate) - Animation utilities
- **Charts**: [Recharts](https://recharts.org/) - React charting library
- **Toasts/Notifications**: [Sonner](https://sonner.emilkowal.ski/) - Toast notifications
- **Date Picker**: [React Day Picker](https://react-day-picker.js.org/) - Flexible date picker
- **Carousel**: [Embla Carousel](https://www.emblacarousel.com/) - Responsive carousel library
- **Theme Support**: [Next Themes](https://github.com/pacocoursey/next-themes) - Dark/light mode support

### Backend
- **Database**: [MongoDB](https://www.mongodb.com/) - NoSQL document database
- **ODM**: [Mongoose](https://mongoosejs.com/) - MongoDB object modeling
- **Runtime**: [Node.js](https://nodejs.org/) - JavaScript runtime
- **Server Framework**: [Express](https://expressjs.com/) - Web server framework
- **Authentication**: [JWT](https://jwt.io/) - JSON Web Tokens
- **Password Hashing**: [bcryptjs](https://www.npmjs.com/package/bcryptjs) - Secure password hashing

### External Services & Tools
- **AWS S3**: Photo storage and CDN delivery for user profile images
- **Railway**: Hosting and deployment platform for backend services
- **Mailgun**: Email delivery service for password resets and verification codes (optional)

---

## 📁 Project Structure

```
client/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── auth/                # Authentication endpoints
│   │   ├── users/               # User management
│   │   ├── messages/            # Messaging system
│   │   ├── matches/             # Matching logic
│   │   ├── events/              # Event management
│   │   ├── notifications/       # Notification system
│   │   ├── browse/              # Browse profiles
│   │   └── settings/            # Settings endpoints
│   ├── admin/                    # Admin dashboard
│   ├── login/                    # Login page
│   ├── signup/                   # Registration page
│   ├── onboarding/              # Multi-step onboarding flow
│   ├── browse/                   # Browse profiles
│   ├── matches/                  # View matches
│   ├── messages/                 # Messaging interface
│   ├── events/                   # Events page
│   ├── notifications/            # Notifications center
│   ├── profile/                  # User profile
│   ├── settings/                 # User settings
│   ├── forgot-password/          # Password recovery
│   ├── reset-password/           # Password reset
│   └── layout.tsx                # Root layout
├── components/                   # Reusable components
│   ├── ui/                       # Radix UI based components
│   ├── app-layout.tsx            # Main app layout wrapper
│   ├── app-sidebar.tsx           # Sidebar navigation
│   ├── mobile-nav.tsx            # Mobile navigation
│   ├── protected-route.tsx        # Auth protected routes
│   ├── theme-provider.tsx        # Theme provider
│   └── dev-banner.tsx            # Development banner
├── hooks/                        # Custom React hooks
│   ├── use-mobile.tsx            # Mobile viewport detection
│   └── use-toast.ts              # Toast notifications hook
├── lib/                          # Utility functions & logic
│   ├── api.ts                    # API client wrapper
│   ├── db.ts                     # MongoDB connection
│   ├── logger.ts                 # Logging utility
│   ├── socket.ts                 # WebSocket client
│   ├── utils.ts                  # General utilities
│   ├── models/                   # Mongoose models
│   │   ├── User.ts              # User model
│   │   ├── Profile.ts           # Profile model
│   │   ├── Event.ts             # Event model
│   │   └── UserNotificationSettings.ts
│   └── store/                    # Zustand stores
│       └── auth-store.ts        # Authentication state
├── public/                       # Static assets
└── server/                       # Backend server
    ├── src/                      # Backend source code
    └── package.json              # Backend dependencies
```

---

## 🎯 Major Features & Components

### Authentication & Onboarding
- **Login/Signup**: Email-based authentication with JWT tokens
- **Multi-Step Onboarding**: Guided user setup with:
  - Personal Information (Name, age, location, district)
  - Profile Setup (Bio, interests, photos)
  - Get to Know Me (Personality prompts, preferences)
- **Password Recovery**: Forgot password and secure reset flow
- **Email Verification**: Email confirmation for new accounts

### User Profiles
- **Profile Management**: Edit personal info, bio, interests, and preferences
- **Photo Gallery**: Upload and manage profile photos via AWS S3
- **Profile Card Component**: Reusable profile display component
- **Activity Tracking**: Last active, member since, and engagement stats

### Browse & Matching
- **Profile Browsing**: Swipe-style or list view to discover matches
- **Smart Matching**: Find compatible profiles based on interests and preferences
- **Match History**: View and manage your matches

### Messaging & Real-time Communication
- **Direct Messaging**: One-on-one conversations with Socket.io
- **Message History**: Persistent message storage with MongoDB
- **Real-time Updates**: Instant notifications when receiving messages
- **Conversation List**: View all active conversations

### Events
- **Event Discovery**: Browse upcoming LPA community events
- **Event Participation**: RSVP and manage event attendance
- **Event Details**: Location, date, time, and description

### Notifications
- **Notification Center**: Centralized notification management
- **Real-time Alerts**: Real-time updates for matches, messages, and events
- **User Preferences**: Customizable notification settings
- **Toast Notifications**: Quick feedback for user actions

### Admin Dashboard
- **User Management**: View and manage user accounts
- **Content Moderation**: Moderate profiles and reported content
- **Analytics**: Platform statistics and engagement metrics
- **Account Controls**: Ban/suspend users, reset passwords

### Settings
- **Account Settings**: Email, password, and account preferences
- **Privacy Controls**: Profile visibility and blocking
- **Notification Preferences**: Manage notification channels and types
- **Theme Selection**: Dark/light mode and color preferences

---

## 🚀 External Services

### AWS S3
- **Purpose**: Store and serve user profile photos
- **Setup**: Configure AWS credentials and S3 bucket in `.env`
- **Benefits**: Scalable, fast CDN delivery, reliable storage

### Railway
- **Purpose**: Deploy and host the Next.js application and backend API
- **Setup**: Connect GitHub repository and configure environment variables
- **Features**: Auto-deploy on push, environment management, monitoring

### Database: MongoDB
- **Purpose**: Store all application data (users, profiles, messages, events)
- **Connection**: Via Mongoose ODM
- **Setup**: Configure MongoDB connection string in `.env`

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ 
- MongoDB instance (local or Atlas)
- AWS S3 bucket (for photo storage)
- Railway account (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Whroach/d8-lpa-community.git
   cd client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env.local` file with:
   ```
   NEXT_PUBLIC_API_URL=/api
   JWT_SECRET=your_jwt_secret_key
   MONGODB_URI=your_mongodb_connection_string
   AWS_ACCESS_KEY_ID=your_aws_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret
   AWS_S3_BUCKET_NAME=your_s3_bucket
   AWS_REGION=us-east-1
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

---

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs for secure password storage
- **CORS Protection**: Configured CORS for API security
- **Input Validation**: Zod validation on all forms
- **Environment Variables**: Sensitive data in `.env` files
- **Protected Routes**: Authentication checks on protected pages

---

## 📝 Key Files

| File | Purpose |
|------|---------|
| `app/login/page.tsx` | Login page with credentials validation |
| `app/onboarding/page.tsx` | Multi-step onboarding flow |
| `lib/api.ts` | Centralized API client and request handling |
| `lib/store/auth-store.ts` | Authentication state management |
| `lib/socket.ts` | WebSocket connection for real-time features |
| `lib/models/User.ts` | User database model |
| `lib/models/Profile.ts` | Profile database model |

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes and commit: `git commit -m "feat: description"`
3. Push to your fork: `git push origin feature/your-feature`
4. Open a pull request

---

## 📄 License

This project is private and maintained by the LPA community team.

---

## 📞 Support

For issues, questions, or feature requests, please open an issue in the GitHub repository.

---

**Built with ❤️ for the LPA Community**
