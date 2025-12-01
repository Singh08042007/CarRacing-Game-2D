import React, { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import { supabase } from '../supabaseClient'
import Auth from './Auth'

// Car Data Configuration
const CARS = {
    RALLY: {
        id: 'rally',
        name: 'RALLY CAR',
        price: 0,
        maxSpeed: 170,
        gears: 6,
        color: '#D32F2F',
        wheelSpeedMultipliers: [0.3, 0.5, 0.7, 0.9, 1.2, 1.8], // 6 Gears
        speedRanges: [35, 55, 75, 95, 115, 175],
        density: 0.005, // Standard weight
        downforce: 0, // No extra downforce
        stiffness: 0.2 // Soft suspension
    },
    F1: {
        id: 'f1',
        name: 'REDBULL F1',
        price: 10,
        maxSpeed: 360, // Reduced from 454 as requested for stability
        gears: 9,
        color: '#1a237e', // Deep Blue
        // Tuned for stability: Gears 1-6 (0-140), 7 (140-200), 8 (200-280), 9 (280-360)
        wheelSpeedMultipliers: [0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 2.0, 3.0, 4.5], // Reduced top multipliers
        speedRanges: [40, 70, 90, 110, 130, 150, 210, 280, 360], // Capped at 360 km/h
        density: 0.005, // Standard weight
        downforce: 0.5, // Minimal downforce to prevent sticking
        stiffness: 0.6 // Stiffer to prevent bottoming out
    },
    BULLET: {
        id: 'bullet',
        name: 'BULLET BIKE',
        price: 5,
        maxSpeed: 110,
        gears: 5,
        color: '#263238', // Dark Blue Grey
        // Tuned for: 0-30, 30-50, 50-70, 70-90, 90-110
        wheelSpeedMultipliers: [0.25, 0.45, 0.65, 0.85, 1.1],
        speedRanges: [30, 50, 70, 90, 110],
        density: 0.008, // Heavier feel for a bike relative to size
        downforce: 0.1, // Low downforce
        stiffness: 0.4 // Softer suspension
    }
}

export default function Game2D() {
    const canvasRef = useRef(null)
    const engineRef = useRef(null)

    // UI Refs
    const scoreRef = useRef(null)
    const scoreRefGameOver = useRef(null) // New ref for Game Over screen
    const speedRef = useRef(null)
    const gearRefDisplay = useRef(null)
    const fuelRef = useRef(null)
    const fuelBarRef = useRef(null)
    const gameOverRef = useRef(null)
    const coinRefHUD = useRef(null)
    const coinRefGameOver = useRef(null)

    // Game State
    const [gameState, setGameState] = useState('menu') // 'menu', 'garage', 'playing', 'gameover'
    const [trackType, setTrackType] = useState('hilly')
    const [coins, setCoins] = useState(0)
    const [unlockedCars, setUnlockedCars] = useState(['rally'])
    const [selectedCarId, setSelectedCarId] = useState('rally')
    const [restartKey, setRestartKey] = useState(0)

    // High Score State
    const [highScore, setHighScore] = useState(0)
    const [session, setSession] = useState(null)
    const [loadingData, setLoadingData] = useState(false)

    // Mobile Detection - improved for landscape
    const [isMobile, setIsMobile] = useState(false)
    const [isLandscape, setIsLandscape] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            // Check for touch support OR small screen (handles landscape properly)
            const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
            const maxDimension = Math.max(window.innerWidth, window.innerHeight)
            const mobile = hasTouchScreen || maxDimension < 1024
            setIsMobile(mobile)
            setIsLandscape(window.innerWidth > window.innerHeight)
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        window.addEventListener('orientationchange', checkMobile)
        return () => {
            window.removeEventListener('resize', checkMobile)
            window.removeEventListener('orientationchange', checkMobile)
        }
    }, [])

    {
        session && loadingData && (
            <div className="absolute inset-0 flex items-center justify-center z-[60] bg-black/80 backdrop-blur-sm text-white font-orbitron text-2xl animate-pulse">
                SYNCING PROFILE DATA...
            </div>
        )
    }

    {/* MAIN MENU - Conditional Mobile/Desktop */ }
    {
        gameState === 'menu' && (
            isMobile ? (
                // MOBILE MENU - Simple & Clean
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-gradient-to-b from-gray-900 via-black to-gray-900 p-6">
                    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                        <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 font-orbitron mb-4">
                            RALLY DRIFT 2D
                        </h1>

                        {/* Stats - Compact */}
                        <div className="flex gap-4 text-white font-orbitron text-sm">
                            <div className="flex flex-col items-center">
                                <span className="text-yellow-400 font-bold text-lg">{coins}</span>
                                <span className="text-gray-400 text-xs">COINS</span>
                            </div>
                            <div className="w-px bg-white/20"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-white font-bold text-lg">{highScore}m</span>
                                <span className="text-gray-400 text-xs">BEST</span>
                            </div>
                        </div>

                        {/* Track Selection - Large Buttons */}
                        <div className="flex flex-col gap-3 w-full mt-4">
                            <button onClick={() => startGame('hilly')} className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 rounded-xl text-white font-black text-lg font-orbitron active:scale-95 transition-transform shadow-lg">
                                🏔️ HILLY CLIMB
                            </button>
                            <button onClick={() => startGame('racing')} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white font-black text-lg font-orbitron active:scale-95 transition-transform shadow-lg">
                                🏁 RACING TRACK
                            </button>
                            <button onClick={() => startGame('highway')} className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl text-white font-black text-lg font-orbitron active:scale-95 transition-transform shadow-lg">
                                🛣️ HIGHWAY
                            </button>
                        </div>

                        {/* Garage Button */}
                        <button onClick={() => setGameState('garage')} className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full text-white font-black text-base font-orbitron active:scale-95 transition-transform shadow-lg mt-2">
                            🏪 GARAGE
                        </button>
                    </div>
                </div>
            ) : (
                // DESKTOP MENU - Full Decorative Version
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[url('https://images.unsplash.com/photo-1541447270888-83e8494f9c06?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

                    {/* Dynamic Overlay Lines */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'repeating-linear-gradient(45deg, #000 0, #000 10px, #222 10px, #222 20px)' }}></div>

                    <div className="relative z-10 text-center flex flex-col items-center gap-10 animate-slide-up">
                        <h1 className="text-9xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 font-orbitron drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] tracking-tighter" style={{ textShadow: '0 0 30px rgba(255,165,0,0.5)' }}>
                            RALLY DRIFT <span className="text-white">2D</span>
                        </h1>

                        <div className="bg-black/80 p-6 rounded-2xl border border-yellow-500/30 flex items-center gap-8 shadow-2xl backdrop-blur-md">
                            <div className="text-yellow-400 font-bold text-3xl font-orbitron flex flex-col items-center">
                                <span className="text-sm text-gray-400 font-sans tracking-widest uppercase">Balance</span>
                                {coins} <span className="text-lg">COINS</span>
                            </div>
                            <div className="w-px h-12 bg-white/20"></div>
                            <div className="text-white font-bold text-2xl font-orbitron flex flex-col items-center">
                                <span className="text-sm text-gray-400 font-sans tracking-widest uppercase">Best Run</span>
                                {highScore}m
                            </div>
                        </div>

                        <div className="flex gap-6 mt-4">
                            <button onClick={() => startGame('hilly')} className="group relative px-8 py-6 bg-gradient-to-b from-green-600 to-green-800 rounded-xl border-b-4 border-green-900 text-white font-black text-2xl font-orbitron hover:translate-y-1 hover:border-b-0 transition-all shadow-[0_0_20px_rgba(76,175,80,0.4)] hover:shadow-[0_0_40px_rgba(76,175,80,0.6)] overflow-hidden">
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                HILLY CLIMB
                            </button>
                            <button onClick={() => startGame('racing')} className="group relative px-8 py-6 bg-gradient-to-b from-blue-600 to-blue-800 rounded-xl border-b-4 border-blue-900 text-white font-black text-2xl font-orbitron hover:translate-y-1 hover:border-b-0 transition-all shadow-[0_0_20px_rgba(33,150,243,0.4)] hover:shadow-[0_0_40px_rgba(33,150,243,0.6)] overflow-hidden">
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                RACING TRACK
                            </button>
                            <button onClick={() => startGame('highway')} className="group relative px-8 py-6 bg-gradient-to-b from-orange-600 to-orange-800 rounded-xl border-b-4 border-orange-900 text-white font-black text-2xl font-orbitron hover:translate-y-1 hover:border-b-0 transition-all shadow-[0_0_20px_rgba(255,152,0,0.4)] hover:shadow-[0_0_40px_rgba(255,152,0,0.6)] overflow-hidden">
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                HIGHWAY
                            </button>
                        </div>

                        <button onClick={() => setGameState('garage')} className="mt-4 px-16 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full border-4 border-purple-400/50 text-white font-black text-2xl font-orbitron animate-pulse-glow hover:scale-105 transition-transform shadow-[0_0_30px_rgba(147,51,234,0.5)]">
                            OPEN GARAGE
                        </button>
                    </div>
                </div>
            )
        )
    }

    {/* GARAGE */ }
    {
        gameState === 'garage' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-zinc-900 text-white bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-900 to-black">
                <h2 className="text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-12 font-orbitron drop-shadow-lg">GARAGE</h2>
                <div className="text-yellow-400 font-bold text-3xl mb-12 font-orbitron bg-black/50 px-8 py-4 rounded-full border border-yellow-500/30">
                    YOUR COINS: <span className="text-white">{coins}</span>
                </div>

                <div className="flex gap-8 overflow-x-auto p-8 max-w-full">
                    {Object.values(CARS).map(car => {
                        const isUnlocked = unlockedCars.includes(car.id)
                        const isSelected = selectedCarId === car.id

                        return (
                            <div key={car.id} className={`relative p - 8 rounded - 3xl border - 2 flex flex - col items - center gap - 6 transition - all duration - 300 w - 80 ${isSelected ? 'border-yellow-400 bg-white/5 scale-105 shadow-[0_0_30px_rgba(255,215,0,0.2)]' : 'border-white/10 bg-black/40 hover:bg-white/5'} `}>
                                {isSelected && <div className="absolute top-4 right-4 text-yellow-400 text-xs font-bold border border-yellow-400 px-2 py-1 rounded">EQUIPPED</div>}

                                <div className="text-3xl font-black italic font-orbitron text-center leading-tight">{car.name}</div>

                                <div className="w-full h-32 rounded-xl flex items-center justify-center bg-gradient-to-br from-gray-800 to-black border border-white/10 shadow-inner">
                                    <div className="w-16 h-16 rounded-full" style={{ backgroundColor: car.color, boxShadow: `0 0 20px ${car.color} ` }}></div>
                                </div>

                                <div className="w-full space-y-2">
                                    <div className="flex justify-between text-sm text-gray-400">
                                        <span>SPEED</span>
                                        <span className="text-white font-bold">{car.maxSpeed} km/h</span>
                                    </div>
                                    <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{ width: `${(car.maxSpeed / 460) * 100}% ` }}></div>
                                    </div>

                                    <div className="flex justify-between text-sm text-gray-400 mt-2">
                                        <span>GEARS</span>
                                        <span className="text-white font-bold">{car.gears}</span>
                                    </div>
                                </div>

                                {isUnlocked ? (
                                    <button
                                        onClick={() => setSelectedCarId(car.id)}
                                        className={`w - full py - 3 rounded - xl font - bold font - orbitron tracking - wider transition - all ${isSelected ? 'bg-yellow-400 text-black shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'} `}
                                    >
                                        {isSelected ? 'SELECTED' : 'SELECT'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => buyCar(car.id)}
                                        className="w-full py-3 rounded-xl font-bold font-orbitron tracking-wider bg-green-600 text-white hover:bg-green-500 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={coins < car.price}
                                    >
                                        BUY ({car.price})
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>

                <button onClick={() => setGameState('menu')} className="mt-12 px-8 py-3 text-gray-400 hover:text-white font-bold font-orbitron tracking-widest hover:tracking-[0.2em] transition-all">
                    ← BACK TO MENU
                </button>
            </div>
        )
    }

    {/* PLAYING UI */ }
    {
        gameState === 'playing' && (
            <>
                <canvas ref={canvasRef} className="block" />

                {/* UI Overlay - Conditional Mobile/Desktop */}
                {isMobile ? (
                    // MOBILE HUD - Simple single-line
                    <div className="absolute top-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 flex items-center justify-between text-white text-sm font-orbitron pointer-events-none z-10">
                        <div className="flex items-center gap-3">
                            <span ref={scoreRef} className="text-cyan-400 font-bold">0m</span>
                            <span ref={speedRef} className="text-purple-400 font-bold">0km/h</span>
                            <span ref={gearRefDisplay} className="text-orange-400 text-xs">G:1</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span ref={coinRefHUD} className="text-yellow-400 font-bold">💰0</span>
                            <div ref={fuelBarRef} className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 w-full transition-all"></div>
                            </div>
                            <button onClick={() => setGameState('menu')} className="px-2 py-1 bg-red-600 rounded text-xs pointer-events-auto">✕</button>
                        </div>
                    </div>
                ) : (
                    // DESKTOP HUD - Full detailed version
                    <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
                        {/* Left: Stats */}
                        <div className="flex flex-col gap-2">
                            <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 font-orbitron drop-shadow-[0_0_10px_rgba(255,165,0,0.5)]" style={{ textShadow: '0 0 20px rgba(255,165,0,0.5)' }}>RALLY CLIMB</h1>
                            <div className="bg-black/20 p-6 rounded-xl backdrop-blur-md border border-cyan-500/30 text-white font-orbitron shadow-[0_0_20px_rgba(0,255,255,0.1)]">
                                <div className="text-xl font-bold flex items-center gap-2">
                                    <span className="text-cyan-400 drop-shadow-[0_0_5px_rgba(0,255,255,0.8)]">DIST</span>
                                    <span ref={scoreRef} className="text-white text-2xl">0m</span>
                                </div>
                                <div className="text-xl font-bold flex items-center gap-2">
                                    <span className="text-purple-400 drop-shadow-[0_0_5px_rgba(192,38,211,0.8)]">SPD</span>
                                    <span ref={speedRef} className="text-white text-2xl">0 km/h</span>
                                </div>
                                <div className="text-xl font-bold flex items-center gap-2">
                                    <span className="text-orange-400 drop-shadow-[0_0_5px_rgba(251,146,60,0.8)]">GEAR</span>
                                    <span ref={gearRefDisplay} className="text-white text-2xl">1</span>
                                    <span className="text-xs text-gray-400 tracking-widest">MANUAL</span>
                                </div>
                                <div className="text-xl font-bold mt-2 flex items-center gap-2">
                                    <span className="text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]">COINS</span>
                                    <span ref={coinRefHUD} className="text-white text-2xl">0</span>
                                </div>

                                <div className="text-xs text-gray-500 mt-2 tracking-widest border-t border-white/10 pt-2">CONTROLS: W / S</div>

                                {/* Distance Bar */}
                                <div className="mt-3 w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                    <div id="dist-bar-fill" className="h-full bg-gradient-to-r from-cyan-400 to-blue-600 w-0 transition-all duration-200 shadow-[0_0_10px_rgba(0,255,255,0.5)]"></div>
                                </div>
                                <div className="text-[10px] text-cyan-500/70 text-center mt-1 tracking-widest">NEXT CHECKPOINT</div>
                            </div>
                        </div>

                        {/* Right: Fuel & Menu */}
                        <div className="flex flex-col gap-4 items-end pointer-events-auto">
                            <button onClick={() => setGameState('menu')} className="px-8 py-2 bg-red-600/80 text-white font-bold font-orbitron rounded-lg border border-red-500/50 hover:bg-red-500 transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] backdrop-blur-sm">
                                ABORT RUN
                            </button>

                            <div className="w-72 bg-black/20 p-4 rounded-xl backdrop-blur-md border border-red-500/30 pointer-events-none shadow-[0_0_20px_rgba(220,38,38,0.1)]">
                                <div className="text-red-400 font-bold mb-2 font-orbitron tracking-widest drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]">FUEL LEVEL</div>
                                <div className="w-full h-4 bg-gray-900/80 rounded-full overflow-hidden border border-white/10 relative">
                                    {/* Grid pattern overlay for fuel bar */}
                                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(90deg, transparent 50%, rgba(0,0,0,0.5) 50%)', backgroundSize: '10px 100%' }}></div>
                                    <div ref={fuelBarRef} className="h-full bg-gradient-to-r from-red-600 via-yellow-500 to-green-500 w-full transition-all duration-200 shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Game Over Screen */}
                <div ref={gameOverRef} className="absolute inset-0 bg-black/90 hidden flex-col items-center justify-center text-white z-50 backdrop-blur-lg">
                    <h2 className="text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-900 mb-8 font-orbitron drop-shadow-[0_0_20px_rgba(220,38,38,0.8)] animate-pulse">GAME OVER</h2>

                    <div className="bg-black/40 p-12 rounded-3xl border-2 border-red-500/50 shadow-[0_0_50px_rgba(220,38,38,0.2)] flex flex-col items-center gap-6 backdrop-blur-md">
                        <div className="text-3xl text-yellow-400 font-orbitron tracking-widest flex flex-col items-center">
                            <span className="text-sm text-gray-400 mb-1">TOTAL EARNINGS</span>
                            <span className="text-5xl drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">
                                <span ref={coinRefGameOver}>0</span> <span className="text-2xl">$</span>
                            </span>
                        </div>

                        <div className="w-full h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>

                        <div className="text-2xl text-cyan-400 font-orbitron tracking-widest flex flex-col items-center">
                            <span className="text-sm text-gray-400 mb-1">DISTANCE TRAVELED</span>
                            <span className="text-4xl drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                                <span ref={scoreRefGameOver}>0</span>m
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-6 mt-12 pointer-events-auto">
                        <button onClick={() => startGame(trackType)} className="group relative px-12 py-4 bg-yellow-500 text-black font-black text-2xl rounded-xl overflow-hidden shadow-[0_0_20px_rgba(234,179,8,0.5)] hover:scale-105 transition-transform">
                            <div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <span className="relative z-10 font-orbitron">RETRY RUN</span>
                        </button>
                        <button onClick={() => setGameState('menu')} className="group relative px-12 py-4 bg-transparent text-white border-2 border-white/20 font-black text-2xl rounded-xl overflow-hidden hover:bg-white/10 hover:border-white/50 transition-all">
                            <span className="relative z-10 font-orbitron">MAIN MENU</span>
                        </button>
                    </div>
                </div>
            </>
        )
    }
    {/* Mobile Touch Controls - Optimized for new mobile UI */ }
    {
        isMobile && (
            <div className={`absolute bottom - 0 left - 0 right - 0 pointer - events - none z - 40 px - 4 w - full ${isLandscape ? 'pb-8' : 'pb-8'} `}>
                <div className="flex justify-between items-end w-full pointer-events-auto gap-3">
                    {/* Left: Gear Shift */}
                    <div className="flex gap-2">
                        <button
                            onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyW') }}
                            onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyW') }}
                            className="w-14 h-14 rounded-lg bg-cyan-500/30 border border-cyan-400 backdrop-blur-sm flex items-center justify-center active:bg-cyan-500/60 active:scale-95 transition-all"
                        >
                            <span className="text-xl text-white font-black">▲</span>
                        </button>
                        <button
                            onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyS') }}
                            onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyS') }}
                            className="w-14 h-14 rounded-lg bg-purple-500/30 border border-purple-400 backdrop-blur-sm flex items-center justify-center active:bg-purple-500/60 active:scale-95 transition-all"
                        >
                            <span className="text-xl text-white font-black">▼</span>
                        </button>
                    </div>

                    {/* Center: Brake */}
                    <button
                        onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyA') }}
                        onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyA') }}
                        className="w-16 h-16 rounded-xl bg-red-500/30 border-2 border-red-400 backdrop-blur-sm flex items-center justify-center active:bg-red-500/60 active:scale-95 transition-all"
                    >
                        <span className="text-xs text-white font-black font-orbitron">BR</span>
                    </button>

                    {/* Right: Gas */}
                    <button
                        onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyD') }}
                        onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyD') }}
                        className="w-20 h-24 rounded-2xl bg-green-500/30 border-2 border-green-400 backdrop-blur-sm flex items-center justify-center active:bg-green-500/60 active:scale-95 transition-all"
                    >
                        <span className="text-base text-white font-black font-orbitron">GAS</span>
                    </button>
                </div>
            </div>
        )
    }
    </div >
)
}
