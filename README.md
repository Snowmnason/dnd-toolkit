# 🎲 D&D Toolkit

<div align="center">

**A modern, cross-platform campaign management application for Dungeons & Dragons**

*Built with React Native, Expo Router, and Supabase*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)

[**Live Demo**](https://snowmnason.github.io/dnd-toolkit/) • [**Features**](#-features) • [**Tech Stack**](#-tech-stack) • [**Architecture**](#-architecture)

</div>

---

## 🌟 Overview

D&D Toolkit is a comprehensive campaign management solution that bridges the gap between digital convenience and tabletop tradition. Whether you're a Dungeon Master orchestrating epic adventures or a player tracking character progression, this app provides intuitive tools for collaborative storytelling.

**🎯 Key Highlights:**
- **Cross-platform compatibility** - Runs seamlessly on web, iOS, and Android
- **Real-time collaboration** - Share worlds, invite players, manage permissions
- **Enterprise-grade security** - Row-Level Security (RLS) with Supabase
- **Performance optimized** - Custom PostgreSQL indexes and efficient query patterns
- **Modern UX/UI** - Responsive design with platform-specific adaptations

---

## ✨ Features

### 🌍 **World Management**
- Create and organize multiple campaign worlds
- Rich world descriptions with system selection (D&D 5e, Pathfinder, etc.)
- Upload custom maps with fallback image support
- Real-time updates across all connected devices

### 👥 **Collaborative Access Control**
- **Owner** - Full world management and deletion rights
- **Dungeon Master** - Campaign management and player coordination
- **Player** - Character access and session participation
- Secure invite system with generated shareable links

### 🛡️ **Security & Performance**
- **Input validation** with SQL injection prevention
- **Row-Level Security** ensuring users only access authorized content
- **Optimized database queries** with strategic indexing
- **Cross-platform authentication** via Supabase Auth

### 📱 **Cross-Platform Experience**
- **Web** - Full desktop experience with keyboard shortcuts
- **Mobile** - Touch-optimized interface with gesture support
- **Responsive Design** - Adapts seamlessly between screen sizes
- **Offline-Ready** - Core features available without internet connection

---

## 🛠 Tech Stack

<div align="center">

| **Frontend** | **Backend** | **Database** | **Development** |
|:---:|:---:|:---:|:---:|
| React Native | Supabase | PostgreSQL | TypeScript |
| Expo Router | Node.js APIs | Real-time Subscriptions | Expo CLI |
| Custom Hooks | Authentication | Row-Level Security | Git Workflow |
| Theme System | File Storage | Query Optimization | GitHub Actions |

</div>

### **Core Technologies**

- **Frontend Framework**: React Native with Expo Router for universal app development
- **Backend-as-a-Service**: Supabase providing authentication, database, and real-time features
- **Database**: PostgreSQL with custom indexes and Row-Level Security policies
- **State Management**: Custom React hooks with optimized data fetching patterns
- **Styling**: Custom theme system with responsive design principles
- **Type Safety**: Full TypeScript implementation with strict typing

---

## 🏗 Architecture

### **Database Design**
```sql
-- Optimized with strategic indexes for performance
users(id, auth_id, username, display_name)
  ↓ (idx_users_auth_id)
worlds(world_id, owner_id, name, description, system)
  ↓ (idx_worlds_owner_id)
world_access(world_id, user_id, user_role, permissions)
  ↓ (idx_world_access_user_id, idx_world_access_world_user)
```

### **Security Model**
```typescript
// Row-Level Security Policies
CREATE POLICY "Users can read worlds they own or have access to"
  ON worlds FOR SELECT
  USING (
    owner_id = auth.uid() OR 
    world_id IN (
      SELECT world_id FROM world_access 
      WHERE user_id = auth.uid()
    )
  );
```

### **Component Architecture**
```
📦 Components
├── 🎨 Themed Components (ThemedView, ThemedText)
├── 🔧 Custom Components (AppButton, TextInput, Dropdown)
├── 🏠 Screen Components (WorldSelection, CreateWorld)
└── 🎯 Modal Components (EditWorldModal, ConfirmationModal)
```

---

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+
- Expo CLI
- Supabase account

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/Snowmnason/dnd-toolkit.git
   cd dnd-toolkit
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Add your Supabase URL and API key
   ```

4. **Start development server**
   ```bash
   npx expo start
   ```

5. **Choose your platform**
   - Press `w` for web development
   - Scan QR code with Expo Go for mobile
   - Press `i` for iOS simulator
   - Press `a` for Android emulator

---

## 📊 Performance Optimizations

### **Database Query Efficiency**
- **Parallel queries** for world access and ownership data
- **Set-based deduplication** to eliminate redundant database calls
- **Strategic indexing** on frequently queried columns
- **Database-level filtering** using `.neq()` and `.in()` operations

### **Frontend Optimizations**
- **Lazy loading** of non-critical components
- **Memoized computations** for expensive operations
- **Optimistic updates** for improved perceived performance
- **Platform-specific rendering** for optimal user experience

---

## 🔒 Security Features

### **Input Validation & Sanitization**
```typescript
// Comprehensive validation with SQL injection prevention
export function validateWorldName(name: string): WorldNameValidationResult {
  // Multi-layer validation including:
  // - Length constraints (2-50 characters)
  // - Character whitelisting (alphanumeric + safe punctuation)
  // - SQL injection pattern detection
  // - XSS prevention (HTML tag removal)
}
```

### **Authentication & Authorization**
- **Supabase Auth** with email verification
- **Row-Level Security** policies for data access control
- **Role-based permissions** (Owner, DM, Player)
- **Secure session management** with automatic token refresh

---

## 📂 Project Structure

```
dnd-toolkit/
├── app/                    # Expo Router pages
│   ├── index.tsx          # App entry point with authentication flow
│   ├── select/            # World selection and creation
│   ├── main/              # Campaign management interface
│   └── login/             # Authentication screens
├── components/            # Reusable UI components
│   ├── custom_components/ # Custom input and display components
│   ├── themed-*           # Theme-aware base components
│   └── create-world/      # World creation modal system
├── lib/                   # Core business logic
│   ├── database/          # Database interaction layer
│   ├── auth/              # Authentication and validation
│   └── supabase.ts        # Supabase client configuration
├── constants/             # Theme system and global constants
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript type definitions
```

---

## 🎯 Future Roadmap

### **Planned Features**
- [ ] **Character Sheet Management** - Integrated character creation and tracking
- [ ] **Session Notes & Logging** - Collaborative session documentation
- [ ] **Dice Rolling System** - Built-in dice mechanics with roll history
- [ ] **Combat Tracker** - Initiative tracking and combat management
- [ ] **Asset Library** - Shared repository of maps, tokens, and resources
- [ ] **Voice Integration** - Audio session recording and playback

### **Technical Improvements**
- [ ] **Offline-First Architecture** - Enhanced offline capability with sync
- [ ] **Real-time Collaboration** - Live session updates and notifications
- [ ] **Advanced Analytics** - Campaign insights and player engagement metrics
- [ ] **API Expansion** - RESTful API for third-party integrations
- [ ] **Mobile App Store** - Native app distribution

---

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### **How to Contribute**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Development Guidelines**
- Follow TypeScript best practices
- Maintain test coverage for new features
- Use the existing code style and formatting
- Update documentation for significant changes

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for the D&D community**

*Bringing digital tools to enhance tabletop adventures*

[⭐ Star this repo](https://github.com/Snowmnason/dnd-toolkit) • [🐛 Report Bug](https://github.com/Snowmnason/dnd-toolkit/issues) • [💡 Request Feature](https://github.com/Snowmnason/dnd-toolkit/issues)

</div>
