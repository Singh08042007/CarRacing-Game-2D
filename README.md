# 🏎️ Rally Drift 2D

A thrilling 2D physics-based racing game built with React and Matter.js, featuring multiple vehicles, dynamic terrain, manual transmission, and cloud save functionality.

![Rally Drift 2D](https://img.shields.io/badge/Game-Rally%20Drift%202D-orange?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.2-blue?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite)
![Matter.js](https://img.shields.io/badge/Matter.js-Physics-green?style=for-the-badge)

## 🎮 Features

### 🚗 Multiple Vehicles
- **Rally Car** (Free) - 6-speed manual, balanced performance, perfect for beginners
- **F1 Car** (10 coins) - 9-speed manual, 360 km/h max speed, aerodynamic downforce
- **Bullet Bike** (5 coins) - 5-speed manual, lightweight and agile

### 🏁 Three Unique Tracks
- **Hilly Climb** - Challenging terrain with extreme elevation changes
- **Highway** - Smooth high-speed gameplay with city skyline
- **Racing Track** - Professional circuit optimized for speed

### ⚙️ Gameplay Mechanics
- **Manual Transmission** - Realistic gear shifting (W/S keys)
- **Fuel System** - Collect fuel pickups to keep racing
- **Coin Collection** - Earn coins for distance and collectibles
- **Physics-Based** - Realistic suspension, terrain interaction, and aerodynamics
- **Mobile Touch Controls** - On-screen buttons for mobile/tablet devices

### 🎨 Visual Features
- **Cyberpunk Aesthetics** - Neon colors, dark themes, retro sun
- **Particle Effects** - Speed-based trail effects
- **Parallax Backgrounds** - Dynamic mountains, cities, and grandstands
- **Detailed Vehicle Models** - Hand-drawn F1 with wings, bike with rider

### ☁️ Cloud Features
- **Supabase Integration** - Cloud saving for progress
- **Authentication** - Secure user accounts
- **Persistent Data** - Coins, high scores, and unlocked cars saved

## 🛠️ Tech Stack

- **Frontend:** React 18.2
- **Build Tool:** Vite 5.0
- **Physics Engine:** Matter.js
- **Styling:** Tailwind CSS
- **Backend:** Supabase (Authentication & Database)
- **Deployment:** Vercel

## 📦 Installation

### Prerequisites
- Node.js 16+ installed
- npm or yarn package manager

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Singh08042007/CarRacing-Game-2D.git
   cd CarRacing-Game-2D
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (Optional - for Supabase features)
   
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   
   Navigate to `http://localhost:5173`

## 🎯 How to Play

### PC Controls
- **D / Arrow Right** - Gas (Accelerate)
- **A / Arrow Left** - Brake
- **W** - Shift Up
- **S** - Shift Down

### Mobile Controls
- Touch the on-screen buttons:
  - **Green button (right)** - Gas
  - **Red button (left)** - Brake
  - **Cyan button (top)** - Shift Up
  - **Orange button (bottom)** - Shift Down

### Gameplay Tips
- Shift gears at the right time to maximize speed
- Collect fuel cans to avoid running out
- Grab coins for currency to unlock new vehicles
- Don't flip over - keep your car balanced on hills!
- Earn distance rewards every 100 meters

## 🚀 Deployment

### Deploy to Vercel

1. **Push to GitHub** (already done)

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your repository
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`

3. **Add Environment Variables** (if using Supabase)
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

4. **Deploy!**

The game will be live at your Vercel URL.

## 🗄️ Database Setup (Optional)

If you want to use cloud save features, set up Supabase:

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Run this SQL in Supabase SQL Editor:
   ```sql
   CREATE TABLE profiles (
       id UUID PRIMARY KEY REFERENCES auth.users(id),
       coins INTEGER DEFAULT 0,
       high_score INTEGER DEFAULT 0,
       unlocked_cars TEXT[] DEFAULT ARRAY['rally'],
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

3. Add your Supabase URL and API key to environment variables

## 📁 Project Structure

```
rally-drift-game/
├── src/
│   ├── components/
│   │   ├── Game2D.jsx      # Main game component
│   │   └── Auth.jsx        # Authentication UI
│   ├── supabaseClient.js   # Supabase configuration
│   ├── App.jsx             # Root component
│   └── main.jsx            # Entry point
├── public/                 # Static assets
├── package.json
├── vite.config.js
├── tailwind.config.js
└── vercel.json            # Vercel deployment config
```

## 🎨 Game Physics

- **Engine:** Matter.js with 8 position iterations, 6 velocity iterations
- **Terrain:** 10,000 procedurally generated segments
- **Suspension:** Spring-damper system with configurable stiffness
- **Safety:** NaN checks, velocity caps, terrain bounds protection

## 🐛 Known Issues

- Mobile controls require touch-enabled device
- Best played in landscape mode on mobile

## 🔮 Future Enhancements

- [ ] Multiplayer racing
- [ ] More vehicles and tracks
- [ ] Sound effects and music
- [ ] Leaderboards
- [ ] Power-ups (nitro boost, shields)
- [ ] Achievements system

## 📝 License

This project is open source and available for educational purposes.

## 👨‍💻 Developer

Created by **Singh08042007**

## 🙏 Acknowledgments

- Matter.js for the physics engine
- Supabase for backend services
- React and Vite communities

---

**Enjoy the ride! 🏎️💨**
