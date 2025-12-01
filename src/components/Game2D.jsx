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


    // Physics State Refs (for loop access)
    const fuel = useRef(100)
    const isGameOver = useRef(false)
    const carBodyRef = useRef(null)
    const gearRef = useRef(1)
    const lastShiftTime = useRef(0)
    const currentCarConfig = useRef(CARS.RALLY)
    const collectedCoinsSession = useRef(0)
    const lastRewardDist = useRef(0) // Track distance for rewards
    const keys = useRef({}) // Keyboard/touch input state

    // Camera State
    const cameraPos = useRef({ x: 0, y: 0 })

    // Cleanup function
    const cleanupEngine = () => {
        if (engineRef.current) {
            Matter.World.clear(engineRef.current.world)
            Matter.Engine.clear(engineRef.current)
            engineRef.current = null
        }
    }



    // Supabase Auth & Data Sync
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            if (session) fetchProfile(session.user.id)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            if (session) fetchProfile(session.user.id)
        })

        return () => subscription.unsubscribe()
    }, [])

    const fetchProfile = async (userId) => {
        setLoadingData(true)
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile:', error)
            } else if (data) {
                setCoins(data.coins || 0)
                setHighScore(data.high_score || 0)
                setUnlockedCars(data.unlocked_cars || ['rally'])
            } else {
                // Create profile if not exists
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert([{ id: userId, coins: 0, high_score: 0, unlocked_cars: ['rally'] }])

                if (insertError) console.error('Error creating profile:', insertError)
            }
        } catch (error) {
            console.error('Unexpected error:', error)
        } finally {
            setLoadingData(false)
        }
    }

    const updateProfile = async (newCoins, newHighScore, newUnlockedCars) => {
        if (!session) return

        const updates = {
            id: session.user.id,
            coins: newCoins !== undefined ? newCoins : coins,
            high_score: newHighScore !== undefined ? newHighScore : highScore,
            unlocked_cars: newUnlockedCars !== undefined ? newUnlockedCars : unlockedCars,
            updated_at: new Date(),
        }

        const { error } = await supabase.from('profiles').upsert(updates)
        if (error) console.error('Error updating profile:', error)
    }

    const startGame = (type) => {
        setTrackType(type)
        setGameState('playing')
        setRestartKey(prev => prev + 1)

        // Update car config based on selected car
        currentCarConfig.current = CARS[selectedCarId.toUpperCase()] || CARS.RALLY

        // Request fullscreen on mobile to hide browser chrome
        if (isMobile && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Fullscreen request failed:', err)
            })
        }
    }

    const buyCar = (carId) => {
        const car = CARS[carId.toUpperCase()]
        if (coins >= car.price && !unlockedCars.includes(carId)) {
            const newCoins = coins - car.price
            const newUnlocked = [...unlockedCars, carId]
            setCoins(newCoins)
            setUnlockedCars(newUnlocked)
            updateProfile(newCoins, undefined, newUnlocked)
        }
    }

    const handleGameOver = (reason, dist) => {
        isGameOver.current = true
        if (dist > highScore) {
            setHighScore(dist)
            localStorage.setItem('highScore', dist)
            updateProfile(coins, dist, undefined)
        } else {
            updateProfile(coins, undefined, undefined)
        }
        if (gameOverRef.current) {
            gameOverRef.current.style.display = 'flex'
            const title = gameOverRef.current.querySelector('h2')
            if (title) title.innerText = reason

            // Update Game Over Score
            if (scoreRefGameOver.current) {
                scoreRefGameOver.current.innerText = `${dist}m`
            }
        }
    }

    // Touch handlers for mobile controls (defined at component level)
    const handleTouchStart = (code) => {
        keys.current[code] = true
        // Handle gear shifts immediately
        if (code === 'KeyW' && gearRef.current < currentCarConfig.current.gears) {
            const now = Date.now()
            if (now - lastShiftTime.current > 250) {
                gearRef.current++
                lastShiftTime.current = now
            }
        }
        if (code === 'KeyS' && gearRef.current > 1) {
            const now = Date.now()
            if (now - lastShiftTime.current > 250) {
                gearRef.current--
                lastShiftTime.current = now
            }
        }
    }

    const handleTouchEnd = (code) => {
        keys.current[code] = false
    }

    useEffect(() => {
        if (gameState !== 'playing') return

        cleanupEngine()

        // 1. Setup Matter.js Engine
        const Engine = Matter.Engine,
            Runner = Matter.Runner,
            Composite = Matter.Composite,
            Bodies = Matter.Bodies,
            Body = Matter.Body,
            Events = Matter.Events

        const engine = Engine.create({
            gravity: { x: 0, y: 1 },
            positionIterations: 8, // Increased for stability
            velocityIterations: 6  // Increased for stability
        })
        engineRef.current = engine
        const world = engine.world

        // 2. Terrain Logic
        const segmentWidth = 40
        const totalSegments = 10000

        const getTerrainHeight = (x) => {
            if (trackType === 'racing') {
                return Math.sin(x * 0.0005) * 20 + 500
            } else if (trackType === 'highway') {
                // Smooth, gentle waves
                return Math.sin(x * 0.001) * 30 + 500
            } else {
                return Math.sin(x * 0.002) * 100 + Math.sin(x * 0.01) * 20 + 500
            }
        }

        const terrainBodies = []
        for (let i = 0; i < totalSegments; i++) {
            const x1 = i * segmentWidth
            const x2 = (i + 1) * segmentWidth
            const y1 = getTerrainHeight(x1)
            const y2 = getTerrainHeight(x2)
            const angle = Math.atan2(y2 - y1, x2 - x1)
            const cx = (x1 + x2) / 2
            const cy = (y1 + y2) / 2

            const ground = Bodies.rectangle(cx, cy + 200, segmentWidth + 2, 400, {
                isStatic: true,
                friction: 0.8,
                restitution: 0.0,
                angle: angle,
                label: 'ground',
                chamfer: { radius: 0 }
            })
            terrainBodies.push(ground)
        }
        Composite.add(world, terrainBodies)

        // 3. Spawners (Fuel & Coins)
        const sensors = []
        for (let i = 1; i < 400; i++) {
            const x = i * 1500 + 500
            const y = getTerrainHeight(x) - 50

            // Fuel
            sensors.push(Bodies.circle(x, y, 20, {
                isStatic: true, isSensor: true, label: 'fuel'
            }))

            // Coins (More frequent)
            if (i % 1 === 0) { // Every interval
                // Lowered to -30 to ensure car hits it, Radius increased to 20
                sensors.push(Bodies.circle(x + 750, getTerrainHeight(x + 750) - 30, 20, {
                    isStatic: true, isSensor: true, label: 'coin'
                }))
            }
        }
        Composite.add(world, sensors)

        // 4. Create Car
        const group = Body.nextGroup(true)
        const startX = 300
        const startY = getTerrainHeight(300) - 100
        const carConfig = currentCarConfig.current

        const carBody = Bodies.rectangle(startX, startY, 140, 40, {
            collisionFilter: { group: group },
            density: carConfig.density || 0.005, // Use config density
            friction: 0.0, // Frictionless body to prevent sticking
            label: 'carBody',
            chamfer: { radius: 20 } // Max radius (Capsule shape) for smooth sliding
        })
        carBodyRef.current = carBody

        const wheelOptions = {
            collisionFilter: { group: group },
            friction: 0.9,
            density: 0.01,
            restitution: 0.0,
            label: 'wheel'
        }

        // Increased wheel size (32) for better clearance
        const wheelA = Bodies.circle(startX - 55, startY + 30, 32, wheelOptions)
        const wheelB = Bodies.circle(startX + 55, startY + 30, 32, wheelOptions)

        const suspensionOptions = {
            bodyA: carBody,
            stiffness: carConfig.stiffness || 0.2, // Configurable stiffness
            damping: 0.15,
            length: 0
        }

        const axelA = Matter.Constraint.create({ ...suspensionOptions, bodyB: wheelA, pointA: { x: -50, y: 30 } })
        const axelB = Matter.Constraint.create({ ...suspensionOptions, bodyB: wheelB, pointA: { x: 50, y: 30 } })

        Composite.add(world, [carBody, wheelA, wheelB, axelA, axelB])

        // 5. Collision Handling
        Events.on(engine, 'collisionStart', (event) => {
            event.pairs.forEach((pair) => {
                const bodyA = pair.bodyA
                const bodyB = pair.bodyB

                // Identify if one body is part of the car
                const isCarA = bodyA.label === 'carBody' || bodyA.label === 'wheel'
                const isCarB = bodyB.label === 'carBody' || bodyB.label === 'wheel'

                if (isCarA || isCarB) {
                    const otherBody = isCarA ? bodyB : bodyA

                    if (otherBody.label === 'fuel') {
                        fuel.current = Math.min(fuel.current + 25, 100)
                        Composite.remove(world, otherBody) // Remove from world
                    } else if (otherBody.label === 'coin') {
                        collectedCoinsSession.current += 1
                        setCoins(prev => prev + 1)
                        Composite.remove(world, otherBody) // Remove from world
                    }
                }
                if (keys.current['KeyA'] || keys.current['ArrowLeft']) {
                    Body.setAngularVelocity(wheelA, -0.3)
                    Body.setAngularVelocity(wheelB, -0.3)
                    fuel.current -= 0.05
                }
            })
        })

        // 6. Input Handling
        const handleKeyDown = (e) => {
            keys.current[e.code] = true
            handleShift(e.code)
        }
        const handleKeyUp = (e) => keys.current[e.code] = false

        const handleShift = (code) => {
            const now = Date.now()
            if (now - lastShiftTime.current > 250) {
                if (code === 'KeyW') { // Shift Up
                    if (gearRef.current < currentCarConfig.current.gears) {
                        gearRef.current++
                        lastShiftTime.current = now
                    }
                }
                if (code === 'KeyS') { // Shift Down
                    if (gearRef.current > 1) {
                        gearRef.current--
                        lastShiftTime.current = now
                    }
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        // 7. Physics Loop
        Events.on(engine, 'beforeUpdate', () => {
            if (isGameOver.current) return

            // --- SAFETY CHECKS ---

            // 1. NaN / Invalid Position Check
            if (!carBody.position || isNaN(carBody.position.x) || isNaN(carBody.position.y) || isNaN(carBody.speed)) {
                console.warn("Physics instability detected (NaN)! Resetting car.")
                Body.setPosition(carBody, { x: 300, y: getTerrainHeight(300) - 100 })
                Body.setVelocity(carBody, { x: 0, y: 0 })
                Body.setAngularVelocity(carBody, 0)
                Body.setAngle(carBody, 0)
                return
            }

            // 2. Velocity Cap (Prevents 50,000 km/h glitches)
            const MAX_PHYSICS_SPEED = 100; // Approx 500 km/h
            if (carBody.speed > MAX_PHYSICS_SPEED) {
                const ratio = MAX_PHYSICS_SPEED / carBody.speed;
                Body.setVelocity(carBody, {
                    x: carBody.velocity.x * ratio,
                    y: carBody.velocity.y * ratio
                });
            }

            // 3. World Bounds Check (Prevents falling through ground)
            const terrainY = getTerrainHeight(carBody.position.x);
            if (carBody.position.y > terrainY + 500) { // If fallen way below terrain
                console.warn("Car fell through world! Resetting.");
                Body.setPosition(carBody, { x: carBody.position.x, y: terrainY - 100 });
                Body.setVelocity(carBody, { x: 0, y: 0 });
                Body.setAngle(carBody, 0);
            }

            const speed = Math.round(carBody.speed * 5)
            const dist = Math.floor(carBody.position.x / 100)
            const currentGear = gearRef.current
            const config = currentCarConfig.current

            // --- GAMEPLAY LOGIC ---

            // 1. Flip Death
            if (Math.abs(carBody.angle) > 2.0) {
                if (carBody.position.y > terrainY - 60) {
                    handleGameOver("CAR FLIPPED!", dist)
                    return
                }
            }

            // 2. Distance Rewards
            if (dist > lastRewardDist.current + 100) {
                lastRewardDist.current = Math.floor(dist / 100) * 100
                setCoins(prev => prev + 10)
                collectedCoinsSession.current += 10
            }

            // Apply Downforce
            if (config.downforce) {
                const downforceForce = carBody.mass * (speed / 1000) * config.downforce
                const maxDownforce = carBody.mass * 2
                const clampedForce = Math.min(downforceForce, maxDownforce)
                Body.applyForce(carBody, carBody.position, { x: 0, y: clampedForce })
            }

            // Gear Logic
            const gearIndex = currentGear - 1
            const wheelSpeed = config.wheelSpeedMultipliers[gearIndex] || 0.3
            const maxSpeedForGear = config.speedRanges[gearIndex] || 30

            if (fuel.current > 0) {
                if (keys.current['KeyD'] || keys.current['ArrowRight']) {
                    if (speed < maxSpeedForGear) {
                        Body.setAngularVelocity(wheelA, wheelSpeed)
                        Body.setAngularVelocity(wheelB, wheelSpeed)
                        fuel.current -= 0.05
                    }
                }
                if (keys.current['KeyA'] || keys.current['ArrowLeft']) {
                    Body.setAngularVelocity(wheelA, -0.3)
                    Body.setAngularVelocity(wheelB, -0.3)
                    fuel.current -= 0.05
                }
            }

            // UI Updates
            if (scoreRef.current) {
                scoreRef.current.innerText = `${dist}m`
            }

            if (speedRef.current) speedRef.current.innerText = `${speed} km/h`
            if (gearRefDisplay.current) gearRefDisplay.current.innerText = `${currentGear}/${config.gears}`
            if (fuelBarRef.current) fuelBarRef.current.style.width = `${fuel.current}%`

            // Update both coin refs if they exist
            if (coinRefHUD.current) coinRefHUD.current.innerText = `${collectedCoinsSession.current}`
            if (coinRefGameOver.current) coinRefGameOver.current.innerText = `${collectedCoinsSession.current}`

            // Distance Bar Update (Progress to next 100m)
            const progress = (dist % 100) / 100 * 100
            const distBar = document.getElementById('dist-bar-fill')
            if (distBar) distBar.style.width = `${progress}%`

            if (fuel.current <= 0 && Math.abs(carBody.speed) < 0.1) {
                handleGameOver("OUT OF FUEL!", dist)
            }
        })

        // 8. Render Loop
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let animationFrameId

        // Particle System
        let particles = []

        const render = () => {
            const width = canvas.width = window.innerWidth
            const height = canvas.height = window.innerHeight

            const targetCamX = -carBody.position.x + width * 0.3
            const targetCamY = -carBody.position.y + height * 0.6

            cameraPos.current.x += (targetCamX - cameraPos.current.x) * 0.1
            cameraPos.current.y += (targetCamY - cameraPos.current.y) * 0.1

            ctx.save()

            // Sky
            const gradient = ctx.createLinearGradient(0, 0, 0, height)
            if (trackType === 'highway') {
                gradient.addColorStop(0, '#0f0c29')
                gradient.addColorStop(0.5, '#302b63')
                gradient.addColorStop(1, '#24243e')
            } else {
                gradient.addColorStop(0, '#000000')
                gradient.addColorStop(1, '#1a1a2e')
            }
            ctx.fillStyle = gradient
            ctx.fillRect(0, 0, width, height)

            // Sun
            ctx.beginPath()
            ctx.arc(width - 100, 100, 60, 0, Math.PI * 2)
            const sunGrad = ctx.createLinearGradient(width - 100, 40, width - 100, 160)
            sunGrad.addColorStop(0, '#FFD700')
            sunGrad.addColorStop(1, '#FF00FF')
            ctx.fillStyle = sunGrad
            ctx.shadowColor = '#FF00FF'
            ctx.shadowBlur = 50
            ctx.fill()
            ctx.shadowBlur = 0

            // Background Parallax
            ctx.save()
            const bgSpeed = 0.05
            const bgOffset = cameraPos.current.x * bgSpeed

            if (trackType === 'hilly') {
                ctx.fillStyle = '#1a1a1a'
                ctx.beginPath()
                ctx.moveTo(0, height)
                for (let i = 0; i < width * 2; i += 200) {
                    const x = (i - bgOffset) % (width * 2) - 200
                    ctx.lineTo(x + 100, height - 300)
                    ctx.lineTo(x + 200, height)
                }
                ctx.fill()
                ctx.strokeStyle = '#00FF00'
                ctx.lineWidth = 2
                ctx.stroke()
            } else if (trackType === 'highway') {
                ctx.fillStyle = '#000'
                for (let i = 0; i < 50; i++) {
                    const x = ((i * 100) + bgOffset) % (width * 2) - 100
                    const h = 100 + (i * 137) % 300
                    ctx.fillRect(x, height - h, 80, h)
                    ctx.strokeStyle = '#00FFFF'
                    ctx.lineWidth = 1
                    ctx.strokeRect(x, height - h, 80, h)
                    ctx.fillStyle = Math.random() > 0.5 ? '#FF00FF' : '#00FFFF'
                    for (let w = 0; w < 5; w++) {
                        if ((i + w) % 3 === 0) ctx.fillRect(x + 10 + (w * 10) % 40, height - h + 20 + (w * 40) % h, 5, 10)
                    }
                    ctx.fillStyle = '#000'
                }
            } else if (trackType === 'racing') {
                ctx.fillStyle = '#111'
                for (let i = 0; i < 20; i++) {
                    const x = ((i * 400) - bgOffset) % (width * 2) - 200
                    ctx.fillRect(x, height - 200, 300, 200)
                    ctx.fillStyle = '#FF0000'
                    ctx.beginPath(); ctx.moveTo(x, height - 200); ctx.lineTo(x + 300, height - 250); ctx.lineTo(x + 300, height - 200); ctx.fill()
                    ctx.fillStyle = '#111'
                }
            }
            ctx.restore()

            ctx.translate(cameraPos.current.x, cameraPos.current.y)

            // Terrain
            const startRenderX = -cameraPos.current.x - 100
            const endRenderX = -cameraPos.current.x + width + 100

            ctx.beginPath()
            ctx.moveTo(startRenderX, getTerrainHeight(startRenderX))
            for (let x = startRenderX; x <= endRenderX; x += 20) {
                ctx.lineTo(x, getTerrainHeight(x))
            }
            ctx.lineTo(endRenderX, getTerrainHeight(endRenderX) + 1000)
            ctx.lineTo(startRenderX, getTerrainHeight(startRenderX) + 1000)
            ctx.closePath()

            ctx.fillStyle = '#050505'
            ctx.fill()

            ctx.lineWidth = 2
            ctx.strokeStyle = trackType === 'racing' ? '#FF0000' : (trackType === 'highway' ? '#FF00FF' : '#00FF00')
            ctx.stroke()

            ctx.beginPath()
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
            ctx.lineWidth = 1
            for (let x = Math.floor(startRenderX / 100) * 100; x <= endRenderX; x += 100) {
                ctx.moveTo(x, getTerrainHeight(x))
                ctx.lineTo(x, getTerrainHeight(x) + 500)
            }
            ctx.stroke()

            // Props
            if (trackType === 'hilly') {
                const gridStep = 100
                const startGridX = Math.floor(startRenderX / gridStep) * gridStep

                for (let x = startGridX; x <= endRenderX; x += gridStep) {
                    const rand = Math.sin(x * 12.9898) * 43758.5453
                    const isTree = (rand - Math.floor(rand)) > 0.7
                    const isRock = (rand - Math.floor(rand)) < 0.2
                    const y = getTerrainHeight(x)

                    if (isTree) {
                        ctx.fillStyle = '#263238'
                        ctx.fillRect(x, y - 150, 5, 150)
                        ctx.beginPath(); ctx.moveTo(x, y - 150); ctx.lineTo(x + 40, y - 150); ctx.stroke()
                        ctx.fillStyle = '#FF00FF'
                        ctx.shadowColor = '#FF00FF'
                        ctx.shadowBlur = 30
                        ctx.beginPath(); ctx.arc(x + 40, y - 150, 5, 0, Math.PI * 2); ctx.fill()
                        ctx.shadowBlur = 0
                    } else if (isRock) {
                        ctx.fillStyle = '#424242'
                        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10, y - 15); ctx.lineTo(x + 25, y - 5); ctx.lineTo(x + 30, y); ctx.fill()
                    }
                }
            }

            // Bodies
            const bodies = Composite.allBodies(world)
            bodies.forEach(body => {
                if (body.label === 'ground') return

                ctx.save()
                ctx.translate(body.position.x, body.position.y)
                ctx.rotate(body.angle)

                if (body.label === 'wheel') {
                    ctx.beginPath()
                    ctx.arc(0, 0, 25, 0, Math.PI * 2)
                    ctx.fillStyle = '#1a1a1a'
                    ctx.fill()
                    ctx.strokeStyle = '#333'
                    ctx.lineWidth = 2
                    ctx.stroke()
                    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fillStyle = '#555'; ctx.fill()
                    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.moveTo(0, -15); ctx.lineTo(0, 15); ctx.strokeStyle = '#ccc'; ctx.lineWidth = 4; ctx.stroke()

                } else if (body.label === 'carBody') {
                    const w = 140
                    const h = 40
                    const color = currentCarConfig.current.color

                    if (currentCarConfig.current.id === 'f1') {
                        ctx.fillStyle = color
                        ctx.beginPath(); ctx.moveTo(60, 5); ctx.lineTo(20, -10); ctx.lineTo(-40, -10); ctx.lineTo(-60, -5); ctx.lineTo(-60, 15); ctx.lineTo(40, 15); ctx.closePath(); ctx.fill()
                        ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke()
                        ctx.fillStyle = '#1a237e'; ctx.fillRect(-20, 0, 40, 15)
                        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-10, -10, 8, 0, Math.PI, true); ctx.fill()
                        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(60, 10); ctx.lineTo(75, 15); ctx.lineTo(75, 5); ctx.lineTo(60, 5); ctx.fill()
                        ctx.fillRect(-75, -25, 5, 25); ctx.fillRect(-80, -35, 20, 10)

                    } else if (currentCarConfig.current.id === 'bullet') {
                        ctx.strokeStyle = '#37474F'; ctx.lineWidth = 4
                        ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(-15, 10); ctx.lineTo(-25, -5); ctx.lineTo(15, -15); ctx.closePath(); ctx.stroke()
                        ctx.fillStyle = '#78909C'; ctx.fillRect(-15, -5, 20, 15)
                        ctx.fillStyle = '#546E7A'; ctx.beginPath(); ctx.moveTo(15, -15); ctx.quadraticCurveTo(25, -25, 35, -10); ctx.lineTo(15, -10); ctx.fill()
                        ctx.fillStyle = '#3E2723'; ctx.beginPath(); ctx.moveTo(-25, -5); ctx.quadraticCurveTo(-15, -10, 0, -5); ctx.lineTo(-25, -5); ctx.fill()
                        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-5, -30, 8, 0, Math.PI * 2); ctx.fill()
                        ctx.strokeStyle = '#263238'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-5, -22); ctx.quadraticCurveTo(10, -25, 20, -10); ctx.stroke()

                    } else {
                        ctx.fillStyle = color
                        ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2, 0); ctx.lineTo(w / 4, -h / 2); ctx.lineTo(-w / 3, -h / 2); ctx.lineTo(-w / 2, 0); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); ctx.fill()
                        ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.stroke()
                        ctx.fillStyle = '#81D4FA'; ctx.beginPath(); ctx.moveTo(w / 4 - 5, -h / 2 + 5); ctx.lineTo(-w / 3 + 5, -h / 2 + 5); ctx.lineTo(-w / 2 + 10, 0); ctx.lineTo(w / 4 - 5, 0); ctx.closePath(); ctx.fill()
                    }

                } else if (body.label === 'fuel') {
                    ctx.fillStyle = '#FFC107'
                    ctx.beginPath(); ctx.rect(-15, -20, 30, 40); ctx.fill()
                    ctx.strokeStyle = '#FF6F00'; ctx.lineWidth = 2; ctx.stroke()
                    ctx.fillStyle = 'black'; ctx.font = 'bold 12px Arial'; ctx.fillText('FUEL', -14, 5)
                } else if (body.label === 'coin') {
                    ctx.fillStyle = '#FFD700'
                    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill()
                    ctx.strokeStyle = '#FFA000'; ctx.lineWidth = 2; ctx.stroke()
                    ctx.fillStyle = '#B8860B'; ctx.font = 'bold 20px Arial'; ctx.fillText('$', -6, 7)
                }

                ctx.restore()
            })

            // Particles
            if (Math.abs(carBody.speed) > 20) {
                particles.push({
                    x: carBody.position.x - Math.cos(carBody.angle) * 40,
                    y: carBody.position.y - Math.sin(carBody.angle) * 40,
                    vx: (Math.random() - 0.5) * 5,
                    vy: (Math.random() - 0.5) * 5,
                    life: 1.0,
                    color: currentCarConfig.current.color
                })
            }

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]
                p.x += p.vx; p.y += p.vy; p.life -= 0.05
                if (p.life <= 0) particles.splice(i, 1)
                else {
                    ctx.globalAlpha = p.life
                    ctx.fillStyle = p.color
                    ctx.shadowColor = p.color
                    ctx.shadowBlur = 10
                    ctx.beginPath(); ctx.arc(p.x, p.y, 3 + p.life * 5, 0, Math.PI * 2); ctx.fill()
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1.0
                }
            }

            ctx.restore()
            animationFrameId = requestAnimationFrame(render)
        }

        const runner = Runner.create()
        Runner.run(runner, engine)
        render()

        return () => {
            Runner.stop(runner)
            cancelAnimationFrame(animationFrameId)
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            cleanupEngine()
        }
    }, [gameState, trackType, restartKey])

    return (
        <div className="relative w-full h-screen overflow-hidden bg-zinc-900 font-['Rajdhani']">
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); transform: scale(1); }
                    50% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.8); transform: scale(1.05); }
                }
                @keyframes slide-up {
                    from { transform: translateY(50px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-pulse-glow { animation: pulse-glow 2s infinite; }
                .font-orbitron { font-family: 'Orbitron', sans-serif; }
            `}</style>

            {/* AUTHENTICATION */}
            {!session && <Auth onLogin={() => { }} />}

            {/* LOADING OVERLAY */}
            {session && loadingData && (
                <div className="absolute inset-0 flex items-center justify-center z-[60] bg-black/80 backdrop-blur-sm text-white font-orbitron text-2xl animate-pulse">
                    SYNCING PROFILE DATA...
                </div>
            )}

            {/* MAIN MENU - Conditional Mobile/Desktop */}
            {gameState === 'menu' && (
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
            )}

            {/* GARAGE */}
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
                                    <div key={car.id} className={`relative p-8 rounded-3xl border-2 flex flex-col items-center gap-6 transition-all duration-300 w-80 ${isSelected ? 'border-yellow-400 bg-white/5 scale-105 shadow-[0_0_30px_rgba(255,215,0,0.2)]' : 'border-white/10 bg-black/40 hover:bg-white/5'}`}>
                                        {isSelected && <div className="absolute top-4 right-4 text-yellow-400 text-xs font-bold border border-yellow-400 px-2 py-1 rounded">EQUIPPED</div>}

                                        <div className="text-3xl font-black italic font-orbitron text-center leading-tight">{car.name}</div>

                                        <div className="w-full h-32 rounded-xl flex items-center justify-center bg-gradient-to-br from-gray-800 to-black border border-white/10 shadow-inner">
                                            <div className="w-16 h-16 rounded-full" style={{ backgroundColor: car.color, boxShadow: `0 0 20px ${car.color}` }}></div>
                                        </div>

                                        <div className="w-full space-y-2">
                                            <div className="flex justify-between text-sm text-gray-400">
                                                <span>SPEED</span>
                                                <span className="text-white font-bold">{car.maxSpeed} km/h</span>
                                            </div>
                                            <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500" style={{ width: `${(car.maxSpeed / 460) * 100}%` }}></div>
                                            </div>

                                            <div className="flex justify-between text-sm text-gray-400 mt-2">
                                                <span>GEARS</span>
                                                <span className="text-white font-bold">{car.gears}</span>
                                            </div>
                                        </div>

                                        {isUnlocked ? (
                                            <button
                                                onClick={() => setSelectedCarId(car.id)}
                                                className={`w-full py-3 rounded-xl font-bold font-orbitron tracking-wider transition-all ${isSelected ? 'bg-yellow-400 text-black shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}
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

            {/* PLAYING UI */}
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
            {/* Mobile Touch Controls - Optimized for new mobile UI */}
            <div className={`absolute bottom-0 left-0 right-0 pointer-events-none md:hidden z-40 px-4 ${isLandscape ? 'pb-12' : 'pb-6'}`}>
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
        </div>
    )
}
