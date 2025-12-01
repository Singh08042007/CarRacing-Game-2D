import React, { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import { supabase } from '../supabaseClient'
import Auth from './Auth'
import engineUrl from '../assets/sounds/engine.mp3'
import skidUrl from '../assets/sounds/skid.mp3'
import coinUrl from '../assets/sounds/coin.mp3'
import musicUrl from '../assets/sounds/music.mp3'

const CARS = {
    RALLY: { id: 'rally', name: 'RALLY CAR', price: 0, maxSpeed: 170, gears: 6, color: '#D32F2F', wheelSpeedMultipliers: [0.3, 0.5, 0.7, 0.9, 1.2, 1.8], speedRanges: [35, 55, 75, 95, 115, 175], density: 0.005, downforce: 0, stiffness: 0.2 },
    F1: { id: 'f1', name: 'REDBULL F1', price: 50, maxSpeed: 360, gears: 9, color: '#1a237e', wheelSpeedMultipliers: [0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 2.0, 3.0, 4.5], speedRanges: [40, 70, 90, 110, 130, 150, 210, 280, 360], density: 0.005, downforce: 0.5, stiffness: 0.6 },
    BULLET: { id: 'bullet', name: 'BULLET BIKE', price: 25, maxSpeed: 110, gears: 5, color: '#263238', wheelSpeedMultipliers: [0.25, 0.45, 0.65, 0.85, 1.1], speedRanges: [30, 50, 70, 90, 110], density: 0.008, downforce: 0.1, stiffness: 0.4 }
}

export default function Game2D() {
    const canvasRef = useRef(null)
    const engineRef = useRef(null)
    const scoreRef = useRef(null)
    const scoreRefGameOver = useRef(null)
    const speedRef = useRef(null)
    const gearRefDisplay = useRef(null)
    const fuelRef = useRef(null)
    const fuelBarRef = useRef(null)
    const gameOverRef = useRef(null)
    const coinRefHUD = useRef(null)
    const distBarRef = useRef(null)
    const coinRefGameOver = useRef(null)

    const [gameState, setGameState] = useState('menu')
    const [trackType, setTrackType] = useState('hilly')
    const [coins, setCoins] = useState(0)
    const [unlockedCars, setUnlockedCars] = useState(['rally'])
    const [selectedCarId, setSelectedCarId] = useState('rally')
    const [restartKey, setRestartKey] = useState(0)
    const [highScore, setHighScore] = useState(0)
    const [session, setSession] = useState(null)
    const [loadingData, setLoadingData] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [isLandscape, setIsLandscape] = useState(false)
    const [gameOverStats, setGameOverStats] = useState({ distance: 0, coins: 0 })
    const [boosters, setBoosters] = useState(0)
    const [coinsEnabled, setCoinsEnabled] = useState(true)
    const coinsRef = useRef(0)
    const boostersRef = useRef(0)
    const isBoosting = useRef(false)
    const boostEndTime = useRef(0)
    const collectedCoinsSession = useRef(0)
    const lastRewardDist = useRef(0)
    const keys = useRef({})
    const fuel = useRef(100)
    const isGameOver = useRef(false)
    const carBodyRef = useRef(null)
    const gearRef = useRef(1)
    const flipStartTime = useRef(null)
    const lastShiftTime = useRef(0)
    const currentCarConfig = useRef(CARS.RALLY)

    const audioContext = useRef(null)
    const engineSound = useRef(null)
    const skidSound = useRef(null)
    const coinSound = useRef(null)
    const musicSound = useRef(null)
    const engineGain = useRef(null)

    useEffect(() => {
        const checkMobile = () => {
            const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
            const maxDimension = Math.max(window.innerWidth, window.innerHeight)
            setIsMobile(hasTouchScreen || maxDimension < 1024)
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

    useEffect(() => {
        coinsRef.current = coins
        boostersRef.current = boosters
    }, [coins, boosters])

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            if (session) fetchProfile(session.user.id)
        })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            if (session) fetchProfile(session.user.id)
        })
        return () => subscription.unsubscribe()
    }, [])

    const fetchProfile = async (userId) => {
        setLoadingData(true)
        console.log('Fetching profile for:', userId)
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
        if (error) {
            console.error('Error fetching profile:', error)
        }
        if (data) {
            console.log('Profile loaded:', data)
            setCoins(data.coins || 0)
            setHighScore(data.high_score || 0)
            setBoosters(data.boosters || 0)
            setUnlockedCars(data.unlocked_cars || ['rally'])
            if (data.selected_car) setSelectedCarId(data.selected_car)
        }
        setLoadingData(false)
    }

    const updateProfile = async (newHighScore = null) => {
        if (!session) {
            console.warn('No session, cannot save profile')
            return
        }
        const scoreToSave = newHighScore !== null ? newHighScore : highScore
        console.log('Saving profile...', { coins: coinsRef.current, highScore: scoreToSave })
        const { error } = await supabase.from('profiles').upsert({
            id: session.user.id,
            coins: coinsRef.current,
            high_score: scoreToSave,
            boosters: boostersRef.current,
            unlocked_cars: unlockedCars,
            selected_car: selectedCarId,
            updated_at: new Date()
        })
        if (error) console.error('Error saving profile:', error)
        else console.log('Profile saved successfully')
    }

    const startGame = (type) => {
        setTrackType(type)
        setGameState('playing')
        setRestartKey(prev => prev + 1)
        const selectedCar = CARS[Object.keys(CARS).find(key => CARS[key].id === selectedCarId)]
        currentCarConfig.current = selectedCar
        if (isMobile) {
            const docEl = document.documentElement
            if (docEl.requestFullscreen) docEl.requestFullscreen().catch(err => console.log(err))
            else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen()
        }
    }

    const buyCar = (carId) => {
        const car = Object.values(CARS).find(c => c.id === carId)
        if (coins >= car.price) {
            setCoins(prev => prev - car.price)
            setUnlockedCars(prev => [...prev, carId])
            setSelectedCarId(carId)
            updateProfile()
        }
    }

    const buyBooster = () => {
        if (coins >= 10 && boosters < 10) {
            setCoins(prev => prev - 10)
            setBoosters(prev => prev + 1)
            updateProfile()
        }
    }

    const handleShift = (code) => {
        const now = Date.now()
        if (now - lastShiftTime.current > 250) {
            if (code === 'KeyW' && gearRef.current < currentCarConfig.current.gears) { gearRef.current++; lastShiftTime.current = now }
            if (code === 'KeyS' && gearRef.current > 1) { gearRef.current--; lastShiftTime.current = now }
        }
    }
    const handleTouchStart = (key) => {
        keys.current[key] = true
        if (key === 'KeyW' || key === 'KeyS') handleShift(key)
    }
    const handleTouchEnd = (key) => { keys.current[key] = false }
    const handleGameOver = (reason, dist) => {
        isGameOver.current = true
        setGameOverStats({ distance: dist, coins: collectedCoinsSession.current })
        setGameState('gameover')
        let currentScore = highScore
        if (dist > highScore) {
            setHighScore(dist)
            currentScore = dist
        }
        updateProfile(currentScore)
    }

    useEffect(() => {
        const initAudio = async () => {
            try {
                audioContext.current = new (window.AudioContext || window.webkitAudioContext)()
                const loadSound = async (url) => {
                    try {
                        const response = await fetch(url)
                        if (!response.ok) throw new Error('Network response was not ok')
                        const arrayBuffer = await response.arrayBuffer()
                        return await audioContext.current.decodeAudioData(arrayBuffer)
                    } catch (e) { console.warn('Failed to load sound:', url, e); return null }
                }
                const [engineBuffer, skidBuffer, coinBuffer, musicBuffer] = await Promise.all([
                    loadSound(engineUrl),
                    loadSound(skidUrl),
                    loadSound(coinUrl),
                    loadSound(musicUrl)
                ])
                if (engineBuffer) {
                    const engineSource = audioContext.current.createBufferSource()
                    engineSource.buffer = engineBuffer
                    engineSource.loop = true
                    const gainNode = audioContext.current.createGain()
                    gainNode.gain.value = 0
                    engineSource.connect(gainNode)
                    gainNode.connect(audioContext.current.destination)
                    engineSource.start()
                    engineSound.current = engineSource
                    engineGain.current = gainNode
                }
                skidSound.current = skidBuffer
                coinSound.current = coinBuffer
                if (musicBuffer) {
                    const musicSource = audioContext.current.createBufferSource()
                    musicSource.buffer = musicBuffer
                    musicSource.loop = true
                    const musicGain = audioContext.current.createGain()
                    musicGain.gain.value = 0.3
                    musicSource.connect(musicGain)
                    musicGain.connect(audioContext.current.destination)
                    musicSource.start()
                    musicSound.current = musicSource
                }
            } catch (e) { console.log('Audio init failed:', e) }
        }
        const handleInteraction = () => {
            if (!audioContext.current) initAudio()
            if (audioContext.current?.state === 'suspended') audioContext.current.resume()
            window.removeEventListener('click', handleInteraction)
            window.removeEventListener('touchstart', handleInteraction)
        }
        window.addEventListener('click', handleInteraction)
        window.addEventListener('touchstart', handleInteraction)
        return () => { if (audioContext.current) audioContext.current.close() }
    }, [])

    useEffect(() => {
        if (engineGain.current && audioContext.current) {
            const target = gameState === 'playing' ? 0.1 : 0
            engineGain.current.gain.setTargetAtTime(target, audioContext.current.currentTime, 0.1)
        }
    }, [gameState])

    const createAsphaltPattern = (ctx) => {
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128
        const pCtx = canvas.getContext('2d'); pCtx.fillStyle = '#333'; pCtx.fillRect(0, 0, 128, 128)
        for (let i = 0; i < 500; i++) { pCtx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`; pCtx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2) }
        pCtx.fillStyle = 'rgba(255,255,255,0.8)'; pCtx.fillRect(0, 60, 64, 8)
        return ctx.createPattern(canvas, 'repeat')
    }
    const createGrassPattern = (ctx) => {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64
        const pCtx = canvas.getContext('2d'); pCtx.fillStyle = '#2e7d32'; pCtx.fillRect(0, 0, 64, 64)
        for (let i = 0; i < 200; i++) { pCtx.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`; pCtx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); pCtx.fillStyle = `rgba(100,255,100,${Math.random() * 0.1})`; pCtx.fillRect(Math.random() * 64, Math.random() * 64, 1, 3) }
        return ctx.createPattern(canvas, 'repeat')
    }

    useEffect(() => {
        if (gameState !== 'playing') return
        const cleanupEngine = () => {
            if (engineRef.current) { Matter.World.clear(engineRef.current.world); Matter.Engine.clear(engineRef.current); engineRef.current = null }
        }
        cleanupEngine()

        isGameOver.current = false
        fuel.current = 100
        collectedCoinsSession.current = 0
        lastRewardDist.current = 0
        gearRef.current = 1
        flipStartTime.current = null
        keys.current = {}

        const Engine = Matter.Engine, Runner = Matter.Runner, Composite = Matter.Composite, Bodies = Matter.Bodies, Body = Matter.Body, Events = Matter.Events
        const engine = Engine.create({ gravity: { x: 0, y: 1 }, positionIterations: 8, velocityIterations: 6 })
        engineRef.current = engine
        const world = engine.world
        const segmentWidth = 40, totalSegments = 10000
        const getTerrainHeight = (x) => {
            if (trackType === 'racing') return Math.sin(x * 0.0005) * 20 + 500
            else if (trackType === 'highway') return Math.sin(x * 0.001) * 30 + 500
            else return Math.sin(x * 0.002) * 100 + Math.sin(x * 0.01) * 20 + 500
        }
        const terrainBodies = []
        for (let i = 0; i < totalSegments; i++) {
            const x1 = i * segmentWidth, x2 = (i + 1) * segmentWidth
            const y1 = getTerrainHeight(x1), y2 = getTerrainHeight(x2)
            const angle = Math.atan2(y2 - y1, x2 - x1), cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
            terrainBodies.push(Bodies.rectangle(cx, cy + 200, segmentWidth + 2, 400, { isStatic: true, friction: 0.8, restitution: 0.0, angle: angle, label: 'ground', chamfer: { radius: 0 } }))
        }
        Composite.add(world, terrainBodies)
        const sensors = []
        for (let i = 1; i < 400; i++) {
            const x = i * 1500 + 500, y = getTerrainHeight(x) - 50
            sensors.push(Bodies.circle(x, y, 20, { isStatic: true, isSensor: true, label: 'fuel' }))
            if (coinsEnabled && i % 1 === 0) sensors.push(Bodies.circle(x + 750, getTerrainHeight(x + 750) - 30, 20, { isStatic: true, isSensor: true, label: 'coin' }))
        }
        Composite.add(world, sensors)
        const group = Body.nextGroup(true), startX = 300, startY = getTerrainHeight(300) - 100, carConfig = currentCarConfig.current
        const carBody = Bodies.rectangle(startX, startY, 140, 40, { collisionFilter: { group: group }, density: carConfig.density, friction: 0.0, label: 'carBody', chamfer: { radius: 20 } })
        carBodyRef.current = carBody
        const wheelOptions = { collisionFilter: { group: group }, friction: 0.9, density: 0.01, restitution: 0.0, label: 'wheel' }
        const wheelA = Bodies.circle(startX - 55, startY + 30, 32, wheelOptions), wheelB = Bodies.circle(startX + 55, startY + 30, 32, wheelOptions)
        const suspensionOptions = { bodyA: carBody, stiffness: carConfig.stiffness, damping: 0.15, length: 0 }
        Composite.add(world, [carBody, wheelA, wheelB, Matter.Constraint.create({ ...suspensionOptions, bodyB: wheelA, pointA: { x: -50, y: 30 } }), Matter.Constraint.create({ ...suspensionOptions, bodyB: wheelB, pointA: { x: 50, y: 30 } })])
        Events.on(engine, 'collisionStart', (event) => {
            event.pairs.forEach((pair) => {
                const bodyA = pair.bodyA, bodyB = pair.bodyB
                const isCarA = bodyA.label === 'carBody' || bodyA.label === 'wheel', isCarB = bodyB.label === 'carBody' || bodyB.label === 'wheel'
                if (isCarA || isCarB) {
                    const otherBody = isCarA ? bodyB : bodyA
                    if (otherBody.label === 'fuel') { fuel.current = Math.min(fuel.current + 25, 100); Composite.remove(world, otherBody) }
                    else if (otherBody.label === 'coin') {
                        collectedCoinsSession.current += 1; setCoins(prev => prev + 1); Composite.remove(world, otherBody)
                        if (coinSound.current && audioContext.current) { const s = audioContext.current.createBufferSource(); s.buffer = coinSound.current; s.connect(audioContext.current.destination); s.start() }
                    }
                }
            })
        })
        const handleKeyDown = (e) => { keys.current[e.code] = true; handleShift(e.code) }
        const handleKeyUp = (e) => keys.current[e.code] = false

        window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp)

        Events.on(engine, 'beforeUpdate', () => {
            if (isGameOver.current) return
            if (!carBody.position || isNaN(carBody.position.x)) { Body.setPosition(carBody, { x: 300, y: getTerrainHeight(300) - 100 }); Body.setVelocity(carBody, { x: 0, y: 0 }); return }

            const speed = Math.round(carBody.speed * 5)
            const dist = Math.floor(carBody.position.x / 100)

            if (dist > lastRewardDist.current + 100) { lastRewardDist.current = Math.floor(dist / 100) * 100; setCoins(prev => prev + 10); collectedCoinsSession.current += 10 }

            // Flip Detection
            if (Math.cos(carBody.angle) < -0.5) {
                if (!flipStartTime.current) flipStartTime.current = Date.now()
                else if (Date.now() - flipStartTime.current > 1000) handleGameOver("CAR FLIPPED!", dist)
            } else {
                flipStartTime.current = null
            }

            // Aerodynamic Downforce
            if (currentCarConfig.current.downforce > 0) {
                const downforce = currentCarConfig.current.downforce * (carBody.speed * carBody.speed) * 0.002
                Body.applyForce(carBody, carBody.position, { x: 0, y: downforce })
            }

            // Booster Logic
            if ((keys.current['ShiftLeft'] || keys.current['ShiftRight']) && boostersRef.current > 0 && !isBoosting.current) {
                isBoosting.current = true
                boostEndTime.current = Date.now() + 5000
                setBoosters(prev => prev - 1)
            }

            if (isBoosting.current) {
                if (Date.now() > boostEndTime.current) {
                    isBoosting.current = false
                } else {
                    // Apply Boost
                    const boostForce = { x: Math.cos(carBody.angle) * 0.05, y: Math.sin(carBody.angle) * 0.05 }
                    Body.applyForce(carBody, carBody.position, boostForce)
                    fuel.current = Math.max(fuel.current, 1) // Don't run out of fuel while boosting
                }
            }

            if (fuel.current > 0) {
                const gearIndex = gearRef.current - 1
                const boostMultiplier = isBoosting.current ? 1.5 : 1.0
                const wheelSpeed = (currentCarConfig.current.wheelSpeedMultipliers[gearIndex] || 0.3) * boostMultiplier
                const maxSpeed = (currentCarConfig.current.speedRanges[gearIndex] || 30) + (isBoosting.current ? 50 : 0)

                if ((keys.current['KeyD'] || keys.current['ArrowRight']) && speed < maxSpeed) {
                    Body.setAngularVelocity(wheelA, wheelSpeed); Body.setAngularVelocity(wheelB, wheelSpeed); fuel.current -= 0.05
                }
                if (keys.current['KeyA'] || keys.current['ArrowLeft']) {
                    Body.setAngularVelocity(wheelA, -0.3); Body.setAngularVelocity(wheelB, -0.3); fuel.current -= 0.05
                    if (skidSound.current && audioContext.current && Math.random() > 0.9) {
                        const s = audioContext.current.createBufferSource(); s.buffer = skidSound.current; const g = audioContext.current.createGain(); g.gain.value = 0.2; s.connect(g); g.connect(audioContext.current.destination); s.start()
                    }
                }
            }

            if (engineSound.current && engineGain.current) {
                const currentSpeed = carBody.speed
                const isGasPressed = keys.current['KeyD'] || keys.current['ArrowRight']
                const targetPitch = 0.5 + (currentSpeed / 15) + (isBoosting.current ? 0.5 : 0) // Higher pitch when boosting
                const pitch = Math.min(Math.max(targetPitch, 0.5), 3.0)
                if (engineSound.current.playbackRate) {
                    const currentPitch = engineSound.current.playbackRate.value
                    engineSound.current.playbackRate.value = currentPitch + (pitch - currentPitch) * 0.1
                }
                const targetVolume = isGasPressed ? 0.4 : 0.1
                const currentVol = engineGain.current.gain.value
                engineGain.current.gain.value = currentVol + (targetVolume - currentVol) * 0.1
            }

            if (scoreRef.current) scoreRef.current.innerText = `${dist}m`
            if (speedRef.current) speedRef.current.innerText = `${speed} km/h`
            if (gearRefDisplay.current) gearRefDisplay.current.innerText = `${gearRef.current}/${currentCarConfig.current.gears}`
            if (fuelBarRef.current) fuelBarRef.current.style.width = `${fuel.current}%`
            if (distBarRef.current) distBarRef.current.style.width = `${(dist % 100)}%`
            if (coinRefHUD.current) coinRefHUD.current.innerText = `${collectedCoinsSession.current}`

            if (fuel.current <= 0 && Math.abs(carBody.speed) < 0.1) handleGameOver("OUT OF FUEL!", dist)
        })
        const canvas = canvasRef.current, ctx = canvas.getContext('2d')
        let animationFrameId, particles = []
        const asphaltPattern = createAsphaltPattern(ctx), grassPattern = createGrassPattern(ctx)
        const render = () => {
            const width = canvas.width = window.innerWidth, height = canvas.height = window.innerHeight

            // Dynamic Camera
            const lookAhead = 0 // Disabled to prevent car from going off-screen
            const speedShake = Math.abs(carBody.speed) > 30 ? (Math.random() - 0.5) * (carBody.speed / 10) : 0

            const targetCamX = -carBody.position.x + width * 0.3
            const targetCamY = -carBody.position.y + height * 0.6 + Math.abs(carBody.velocity.x) * 2

            const lerpFactor = 0.5 // Very fast tracking to prevent lag
            cameraPos.current.x += (targetCamX - cameraPos.current.x) * lerpFactor
            cameraPos.current.y += (targetCamY - cameraPos.current.y) * 0.1

            // Apply Shake
            const renderCamX = cameraPos.current.x + speedShake
            const renderCamY = cameraPos.current.y + speedShake

            ctx.save()

            // Sky & Background (Parallax)
            // Sky & Background (Parallax)
            const gradient = ctx.createLinearGradient(0, 0, 0, height)
            if (trackType === 'highway') {
                gradient.addColorStop(0, '#0f0c29'); gradient.addColorStop(0.5, '#302b63'); gradient.addColorStop(1, '#24243e'); // Night
            } else if (trackType === 'racing') {
                gradient.addColorStop(0, '#1a2a6c'); gradient.addColorStop(0.5, '#b21f1f'); gradient.addColorStop(1, '#fdbb2d'); // Sunset
            } else {
                gradient.addColorStop(0, '#2980B9'); gradient.addColorStop(1, '#6DD5FA'); // Day
            }
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height)

            // Stars / Clouds
            ctx.save()
            if (trackType === 'highway') {
                ctx.fillStyle = '#FFF';
                for (let i = 0; i < 50; i++) {
                    const sX = ((i * 137) % width + renderCamX * 0.02) % width
                    const sY = ((i * 241) % (height / 2))
                    ctx.globalAlpha = Math.random() * 0.5 + 0.5
                    ctx.beginPath(); ctx.arc(sX, sY, Math.random() * 1.5, 0, Math.PI * 2); ctx.fill()
                }
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                for (let i = 0; i < 10; i++) {
                    const cX = ((i * 300) + renderCamX * 0.1) % (width + 400) - 200
                    const cY = (i * 50) % 200
                    ctx.beginPath(); ctx.arc(cX, cY, 40, 0, Math.PI * 2); ctx.arc(cX + 30, cY - 10, 50, 0, Math.PI * 2); ctx.arc(cX + 60, cY, 40, 0, Math.PI * 2); ctx.fill()
                }
            }
            ctx.restore()

            // Sun/Moon
            ctx.beginPath();
            ctx.arc(width - 100, 100, 60, 0, Math.PI * 2);
            ctx.fillStyle = trackType === 'highway' ? '#eee' : '#ffd700';
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 40; ctx.fill(); ctx.shadowBlur = 0

            // Parallax Layers
            const bgOffset = renderCamX * 0.05
            ctx.save()
            if (trackType === 'hilly') {
                ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(0, height);
                for (let i = 0; i < width * 2; i += 150) {
                    const x = ((i - bgOffset) % (width * 2) + (width * 2)) % (width * 2) - 100
                    ctx.lineTo(x, height - 300 - Math.abs(Math.sin(i)) * 150);
                }
                ctx.lineTo(width, height); ctx.fill()
            } else if (trackType === 'highway') {
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                for (let i = 0; i < width * 2; i += 100) {
                    const h = 100 + Math.abs(Math.sin(i * 1321)) * 150
                    const x = ((i - bgOffset) % (width * 2) + (width * 2)) % (width * 2) - 50
                    ctx.fillRect(x, height - h, 40, h)
                }
            }
            ctx.restore()

            // Terrain
            ctx.translate(renderCamX, renderCamY)
            const startRenderX = -renderCamX - 100, endRenderX = -renderCamX + width + 100

            ctx.beginPath();
            ctx.moveTo(startRenderX, getTerrainHeight(startRenderX));
            for (let x = startRenderX; x <= endRenderX; x += 40) ctx.lineTo(x, getTerrainHeight(x));
            ctx.lineTo(endRenderX, getTerrainHeight(endRenderX) + 1000);
            ctx.lineTo(startRenderX, getTerrainHeight(startRenderX) + 1000);
            ctx.closePath()

            if (trackType === 'highway') { ctx.fillStyle = asphaltPattern; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke() }
            else { ctx.fillStyle = grassPattern; ctx.fill(); ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 5; ctx.stroke() }

            // Decorations
            for (let x = Math.floor(startRenderX / 500) * 500; x <= endRenderX; x += 500) {
                const y = getTerrainHeight(x)
                if (trackType === 'hilly') {
                    ctx.fillStyle = '#1b5e20'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20, y - 60); ctx.lineTo(x + 40, y); ctx.fill()
                    ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.moveTo(x + 10, y - 40); ctx.lineTo(x + 20, y - 80); ctx.lineTo(x + 30, y - 40); ctx.fill()
                    ctx.fillStyle = '#3e2723'; ctx.fillRect(x + 15, y, 10, 10)
                } else if (trackType === 'highway') {
                    ctx.fillStyle = '#555'; ctx.fillRect(x, y - 150, 5, 150); ctx.beginPath(); ctx.arc(x + 20, y - 150, 10, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; ctx.fill(); ctx.shadowBlur = 0
                } else if (trackType === 'racing') {
                    // Grandstand Structure
                    ctx.fillStyle = '#222'; ctx.fillRect(x, y - 100, 160, 100); // Base

                    // Roof
                    ctx.beginPath(); ctx.moveTo(x - 20, y - 120); ctx.lineTo(x + 180, y - 130); ctx.lineTo(x + 180, y - 100); ctx.lineTo(x - 20, y - 100);
                    ctx.fillStyle = '#b71c1c'; ctx.fill(); // Red roof
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

                    // Pillars
                    ctx.fillStyle = '#444'; ctx.fillRect(x + 10, y - 100, 10, 100); ctx.fillRect(x + 140, y - 100, 10, 100);

                    // Tiers & Crowd
                    for (let r = 0; r < 5; r++) {
                        const tierY = y - 20 - r * 15
                        // Tier floor
                        ctx.fillStyle = '#333'; ctx.fillRect(x + 20, tierY + 10, 120, 5);

                        // People
                        for (let c = 0; c < 10; c++) {
                            if (Math.random() > 0.2) { // 80% occupancy
                                const pX = x + 30 + c * 12 + Math.random() * 5
                                const pY = tierY + 5
                                // Body
                                ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 40%)`;
                                ctx.beginPath(); ctx.arc(pX, pY + 5, 4, 0, Math.PI * 2); ctx.fill();
                                // Head
                                ctx.fillStyle = '#ffccaa';
                                ctx.beginPath(); ctx.arc(pX, pY, 2.5, 0, Math.PI * 2); ctx.fill();
                            }
                        }
                    }
                }
            }

            // Bodies
            Composite.allBodies(world).forEach(body => {
                if (body.label === 'ground') return
                ctx.save(); ctx.translate(body.position.x, body.position.y); ctx.rotate(body.angle)

                if (body.label === 'wheel') {
                    // Rotating Wheel
                    ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2);
                    ctx.fillStyle = '#111'; ctx.fill();
                    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();

                    // Rim
                    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2);
                    ctx.fillStyle = '#444'; ctx.fill();

                    // Rotating Spokes
                    ctx.save();
                    ctx.rotate(body.position.x * 0.1); // Rotation based on distance
                    ctx.strokeStyle = '#888'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, 15); ctx.stroke();
                    ctx.restore();
                }
                else if (body.label === 'carBody') {
                    const color = currentCarConfig.current.color

                    // Shadow
                    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 20;

                    if (currentCarConfig.current.id === 'f1') {
                        // F1 Body
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.moveTo(70, 5); ctx.lineTo(20, -10); ctx.lineTo(-40, -10); // Nose to Cockpit
                        ctx.lineTo(-60, -20); ctx.lineTo(-70, -20); ctx.lineTo(-70, 10); // Rear Wing mount
                        ctx.lineTo(40, 15); ctx.closePath();
                        ctx.fill();

                        // Sidepods
                        ctx.fillStyle = '#1a237e'; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(10, 0); ctx.lineTo(10, 15); ctx.lineTo(-30, 15); ctx.fill();

                        // Driver Helmet
                        ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(-10, -12, 6, 0, Math.PI * 2); ctx.fill();

                        // Rear Wing
                        ctx.fillStyle = '#111'; ctx.fillRect(-80, -35, 20, 5); ctx.fillRect(-75, -35, 5, 25);

                        // Front Wing
                        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(60, 10); ctx.lineTo(80, 15); ctx.lineTo(80, 5); ctx.lineTo(60, 5); ctx.fill();
                    }
                    else if (currentCarConfig.current.id === 'bullet') {
                        // Bike Frame
                        ctx.strokeStyle = '#37474F'; ctx.lineWidth = 5;
                        ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(-15, 10); ctx.lineTo(-25, -5); ctx.lineTo(15, -15); ctx.closePath(); ctx.stroke();

                        // Fuel Tank
                        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(15, -15); ctx.quadraticCurveTo(25, -25, 35, -10); ctx.lineTo(15, -10); ctx.fill();

                        // Seat
                        ctx.fillStyle = '#3E2723'; ctx.beginPath(); ctx.moveTo(-25, -5); ctx.quadraticCurveTo(-15, -10, 0, -5); ctx.lineTo(-25, -5); ctx.fill();

                        // Rider
                        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-5, -25, 8, 0, Math.PI * 2); ctx.fill(); // Head
                        ctx.strokeStyle = '#263238'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-5, -18); ctx.quadraticCurveTo(10, -25, 20, -10); ctx.stroke(); // Body
                    }
                    else {
                        // Rally Car Body
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.moveTo(60, 10); ctx.lineTo(50, -5); ctx.lineTo(20, -20); // Hood to Roof
                        ctx.lineTo(-30, -20); ctx.lineTo(-50, -5); ctx.lineTo(-60, 10); // Roof to Trunk
                        ctx.lineTo(-60, 20); ctx.lineTo(60, 20); ctx.closePath();
                        ctx.fill();

                        // Windows
                        ctx.fillStyle = '#81D4FA';
                        ctx.beginPath(); ctx.moveTo(45, -5); ctx.lineTo(20, -17); ctx.lineTo(-25, -17); ctx.lineTo(-45, -5); ctx.closePath(); ctx.fill();

                        // Spoiler
                        ctx.fillStyle = '#D32F2F'; ctx.fillRect(-65, -15, 5, 15); ctx.fillRect(-70, -18, 20, 5);

                        // Decals
                        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(10, -20); ctx.lineTo(-10, 20); ctx.lineTo(-30, 20); ctx.lineTo(-10, -20); ctx.fill();
                    }
                    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
                }
                else if (body.label === 'fuel') {
                    ctx.fillStyle = '#FFC107'; ctx.beginPath(); ctx.roundRect(-15, -20, 30, 40, 5); ctx.fill();
                    ctx.strokeStyle = '#FF6F00'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.fillStyle = 'black'; ctx.font = 'bold 10px Orbitron'; ctx.fillText('FUEL', -12, 5);
                }
                else if (body.label === 'coin') {
                    ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#FFA000'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.fillStyle = '#B8860B'; ctx.font = 'bold 20px Orbitron'; ctx.fillText('$', -6, 7);
                    // Sparkle
                    if (Math.random() > 0.9) { ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(10, -10, 3, 0, Math.PI * 2); ctx.fill(); }
                }
                ctx.restore()
            })

            // Particle System 2.0
            if (Math.abs(carBody.speed) > 10) {
                // Smoke/Dust
                if (Math.random() > 0.5) {
                    particles.push({
                        x: carBody.position.x - Math.cos(carBody.angle) * 40,
                        y: carBody.position.y + 20,
                        vx: (Math.random() - 0.5) * 2,
                        vy: (Math.random() * -2) - 1,
                        life: 1.0,
                        type: trackType === 'hilly' ? 'dust' : 'smoke',
                        size: Math.random() * 5 + 5
                    })
                }
            }

            // Boost Flames
            if (isBoosting.current) {
                for (let i = 0; i < 5; i++) {
                    particles.push({
                        x: carBody.position.x - Math.cos(carBody.angle) * 60,
                        y: carBody.position.y,
                        vx: -Math.cos(carBody.angle) * 10 + (Math.random() - 0.5) * 5,
                        vy: -Math.sin(carBody.angle) * 10 + (Math.random() - 0.5) * 5,
                        life: 0.5,
                        type: 'fire',
                        size: Math.random() * 10 + 5,
                        color: `hsl(${Math.random() * 60 + 10}, 100%, 50%)`
                    })
                }
            }

            // Render Particles
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx; p.y += p.vy; p.life -= 0.02; p.size += 0.2;

                if (p.life <= 0) particles.splice(i, 1);
                else {
                    ctx.globalAlpha = p.life;
                    if (p.type === 'dust') ctx.fillStyle = '#795548';
                    else if (p.type === 'smoke') ctx.fillStyle = '#9E9E9E';
                    else ctx.fillStyle = p.color;

                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 1.0
                }
            }
            ctx.restore(); animationFrameId = requestAnimationFrame(render)
        }
        const runner = Runner.create(); Runner.run(runner, engine); render()
        return () => { Runner.stop(runner); cancelAnimationFrame(animationFrameId); window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); cleanupEngine() }
    }, [gameState, trackType, restartKey])

    const cameraPos = useRef({ x: 0, y: 0 })

    return (
        <div className="relative w-full h-screen overflow-hidden bg-zinc-900 font-['Rajdhani']">
            <style>{`
                @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); transform: scale(1); } 50% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.8); transform: scale(1.05); } }
                @keyframes slide-up { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .animate-pulse-glow { animation: pulse-glow 2s infinite; }
                .font-orbitron { font-family: 'Orbitron', sans-serif; }
            `}</style>
            {!session && <Auth onLogin={() => { }} />}
            {session && loadingData && (
                <div className="absolute inset-0 flex items-center justify-center z-[60] bg-black/80 backdrop-blur-sm text-white font-orbitron text-2xl animate-pulse">
                    SYNCING PROFILE DATA...
                </div>
            )}

            {gameState === 'menu' && (
                isMobile ? (
                    // MOBILE MENU
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-gradient-to-b from-gray-900 via-black to-gray-900 p-6">
                        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                            <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 font-orbitron mb-4">RALLY DRIFT 2D</h1>
                            <div className="flex gap-4 text-white font-orbitron text-sm">
                                <div className="flex flex-col items-center"><span className="text-yellow-400 font-bold text-lg">{coins}</span><span className="text-gray-400 text-xs">COINS</span></div>
                                <div className="w-px bg-white/20"></div>
                                <div className="flex flex-col items-center"><span className="text-white font-bold text-lg">{highScore}m</span><span className="text-gray-400 text-xs">BEST</span></div>
                            </div>
                            <div className="flex flex-col gap-3 w-full mt-4">
                                <button onClick={() => startGame('hilly')} className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 rounded-xl text-white font-black text-lg font-orbitron active:scale-95 transition-transform shadow-lg">🏔️ HILLY CLIMB</button>
                                <button onClick={() => startGame('racing')} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white font-black text-lg font-orbitron active:scale-95 transition-transform shadow-lg">🏁 RACING TRACK</button>
                                <button onClick={() => startGame('highway')} className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl text-white font-black text-lg font-orbitron active:scale-95 transition-transform shadow-lg">🛣️ HIGHWAY</button>
                                <button onClick={() => setCoinsEnabled(!coinsEnabled)} className={`w-full py-3 rounded-xl font-bold font-orbitron text-sm ${coinsEnabled ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>COINS: {coinsEnabled ? 'ON' : 'OFF'}</button>
                            </div>
                            <button onClick={() => setGameState('garage')} className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full text-white font-black text-base font-orbitron active:scale-95 transition-transform shadow-lg mt-2">🏪 GARAGE</button>
                        </div>
                    </div>
                ) : (
                    // DESKTOP MENU
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[url('https://images.unsplash.com/photo-1541447270888-83e8494f9c06?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
                        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'repeating-linear-gradient(45deg, #000 0, #000 10px, #222 10px, #222 20px)' }}></div>
                        <div className="relative z-10 text-center flex flex-col items-center gap-10 animate-slide-up">
                            <h1 className="text-9xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 font-orbitron drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] tracking-tighter" style={{ textShadow: '0 0 30px rgba(255,165,0,0.5)' }}>RALLY DRIFT <span className="text-white">2D</span></h1>
                            <div className="bg-black/80 p-6 rounded-2xl border border-yellow-500/30 flex items-center gap-8 shadow-2xl backdrop-blur-md">
                                <div className="text-yellow-400 font-bold text-3xl font-orbitron flex flex-col items-center"><span className="text-sm text-gray-400 font-sans tracking-widest uppercase">Balance</span>{coins} <span className="text-lg">COINS</span></div>
                                <div className="w-px h-12 bg-white/20"></div>
                                <div className="text-white font-bold text-2xl font-orbitron flex flex-col items-center"><span className="text-sm text-gray-400 font-sans tracking-widest uppercase">Best Run</span>{highScore}m</div>
                            </div>
                            <div className="flex gap-6 mt-4">
                                <button onClick={() => startGame('hilly')} className="group relative px-8 py-6 bg-gradient-to-b from-green-600 to-green-800 rounded-xl border-b-4 border-green-900 text-white font-black text-2xl font-orbitron hover:translate-y-1 hover:border-b-0 transition-all shadow-[0_0_20px_rgba(76,175,80,0.4)] hover:shadow-[0_0_40px_rgba(76,175,80,0.6)] overflow-hidden"><div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>HILLY CLIMB</button>
                                <button onClick={() => startGame('racing')} className="group relative px-8 py-6 bg-gradient-to-b from-blue-600 to-blue-800 rounded-xl border-b-4 border-blue-900 text-white font-black text-2xl font-orbitron hover:translate-y-1 hover:border-b-0 transition-all shadow-[0_0_20px_rgba(33,150,243,0.4)] hover:shadow-[0_0_40px_rgba(33,150,243,0.6)] overflow-hidden"><div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>RACING TRACK</button>
                                <button onClick={() => startGame('highway')} className="group relative px-8 py-6 bg-gradient-to-b from-orange-600 to-orange-800 rounded-xl border-b-4 border-orange-900 text-white font-black text-2xl font-orbitron hover:translate-y-1 hover:border-b-0 transition-all shadow-[0_0_20px_rgba(255,152,0,0.4)] hover:shadow-[0_0_40px_rgba(255,152,0,0.6)] overflow-hidden"><div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>HIGHWAY</button>
                            </div>
                            <button onClick={() => setCoinsEnabled(!coinsEnabled)} className={`px-8 py-3 rounded-full font-bold font-orbitron tracking-widest transition-all border-2 ${coinsEnabled ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.3)]' : 'bg-gray-800/50 text-gray-500 border-gray-700'}`}>COINS: {coinsEnabled ? 'ENABLED' : 'DISABLED'}</button>
                            <button onClick={() => setGameState('garage')} className="mt-4 px-16 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full border-4 border-purple-400/50 text-white font-black text-2xl font-orbitron animate-pulse-glow hover:scale-105 transition-transform shadow-[0_0_30px_rgba(147,51,234,0.5)]">OPEN GARAGE</button>
                        </div>
                    </div>
                )
            )}

            {gameState === 'garage' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-zinc-900 text-white bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-900 to-black">
                    {/* Mobile Back Button */}
                    <button onClick={() => setGameState('menu')} className="absolute top-4 left-4 z-50 w-12 h-12 flex items-center justify-center bg-white/10 rounded-full backdrop-blur-md border border-white/20 text-2xl active:scale-95 transition-all md:hidden">←</button>

                    <h2 className="text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-12 font-orbitron drop-shadow-lg">GARAGE</h2>
                    <div className="text-yellow-400 font-bold text-3xl mb-12 font-orbitron bg-black/50 px-8 py-4 rounded-full border border-yellow-500/30">YOUR COINS: <span className="text-white">{coins}</span></div>
                    <div className="flex gap-8 overflow-x-auto p-8 max-w-full">
                        {Object.values(CARS).map(car => {
                            const isUnlocked = unlockedCars.includes(car.id)
                            const isSelected = selectedCarId === car.id
                            return (
                                <div key={car.id} className={`relative p-8 rounded-3xl border-2 flex flex-col items-center gap-6 transition-all duration-300 w-80 ${isSelected ? 'border-yellow-400 bg-white/5 scale-105 shadow-[0_0_30px_rgba(255,215,0,0.2)]' : 'border-white/10 bg-black/40 hover:bg-white/5'}`}>
                                    {isSelected && <div className="absolute top-4 right-4 text-yellow-400 text-xs font-bold border border-yellow-400 px-2 py-1 rounded">EQUIPPED</div>}
                                    <div className="text-3xl font-black italic font-orbitron text-center leading-tight">{car.name}</div>
                                    <div className="w-full h-32 rounded-xl flex items-center justify-center bg-gradient-to-br from-gray-800 to-black border border-white/10 shadow-inner"><div className="w-16 h-16 rounded-full" style={{ backgroundColor: car.color, boxShadow: `0 0 20px ${car.color}` }}></div></div>
                                    <div className="w-full space-y-2">
                                        <div className="flex justify-between text-sm text-gray-400"><span>SPEED</span><span className="text-white font-bold">{car.maxSpeed} km/h</span></div>
                                        <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${(car.maxSpeed / 460) * 100}%` }}></div></div>
                                        <div className="flex justify-between text-sm text-gray-400 mt-2"><span>GEARS</span><span className="text-white font-bold">{car.gears}</span></div>
                                    </div>
                                    {isUnlocked ? (
                                        <button onClick={() => setSelectedCarId(car.id)} className={`w-full py-3 rounded-xl font-bold font-orbitron tracking-wider transition-all ${isSelected ? 'bg-yellow-400 text-black shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}>{isSelected ? 'SELECTED' : 'SELECT'}</button>
                                    ) : (
                                        <button onClick={() => buyCar(car.id)} className="w-full py-3 rounded-xl font-bold font-orbitron tracking-wider bg-green-600 text-white hover:bg-green-500 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" disabled={coins < car.price}>BUY ({car.price})</button>
                                    )}
                                </div>
                            )
                        })}

                        {/* Booster Shop Item */}
                        <div className="relative p-8 rounded-3xl border-2 border-red-500/30 bg-black/40 hover:bg-white/5 flex flex-col items-center gap-6 transition-all duration-300 w-80">
                            <div className="text-3xl font-black italic font-orbitron text-center leading-tight text-red-500">NITRO BOOST</div>
                            <div className="w-full h-32 rounded-xl flex items-center justify-center bg-gradient-to-br from-red-900 to-black border border-white/10 shadow-inner">
                                <span className="text-5xl">🚀</span>
                            </div>
                            <div className="w-full space-y-2">
                                <div className="flex justify-between text-sm text-gray-400"><span>EFFECT</span><span className="text-white font-bold">+50 km/h</span></div>
                                <div className="flex justify-between text-sm text-gray-400"><span>DURATION</span><span className="text-white font-bold">5s</span></div>
                                <div className="flex justify-between text-sm text-gray-400 mt-2"><span>OWNED</span><span className="text-yellow-400 font-bold">{boosters}/10</span></div>
                            </div>
                            <button onClick={buyBooster} className="w-full py-3 rounded-xl font-bold font-orbitron tracking-wider bg-red-600 text-white hover:bg-red-500 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" disabled={coins < 10 || boosters >= 10}>
                                {boosters >= 10 ? 'MAXED OUT' : 'BUY (10)'}
                            </button>
                        </div>
                    </div>
                    <button onClick={() => setGameState('menu')} className="mt-12 px-8 py-3 text-gray-400 hover:text-white font-bold font-orbitron tracking-widest hover:tracking-[0.2em] transition-all">← BACK TO MENU</button>
                </div>
            )}

            {gameState === 'playing' && (
                <>
                    <canvas ref={canvasRef} className="block" />
                    {isMobile ? (
                        <div className="absolute top-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 flex items-center justify-between text-white text-sm font-orbitron pointer-events-none z-10">
                            <div className="flex items-center gap-3"><span ref={scoreRef} className="text-cyan-400 font-bold">0m</span><span ref={speedRef} className="text-purple-400 font-bold">0km/h</span><span ref={gearRefDisplay} className="text-orange-400 text-xs">G:1</span></div>
                            <div className="flex items-center gap-3">
                                <button onTouchStart={() => { keys.current['ShiftLeft'] = true }} onTouchEnd={() => { keys.current['ShiftLeft'] = false }} className="px-3 py-1 bg-red-600 rounded text-xs font-bold pointer-events-auto active:scale-95">🚀 {boosters}</button>
                                <span ref={coinRefHUD} className="text-yellow-400 font-bold">💰0</span>
                                <div ref={fuelBarRef} className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-green-500 w-full transition-all"></div></div>
                                <button onClick={() => setGameState('menu')} className="px-2 py-1 bg-red-600 rounded text-xs pointer-events-auto">✕</button>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
                            <div className="flex flex-col gap-2">
                                <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 font-orbitron drop-shadow-[0_0_10px_rgba(255,165,0,0.5)]" style={{ textShadow: '0 0 20px rgba(255,165,0,0.5)' }}>RALLY CLIMB</h1>
                                <div className="bg-black/20 p-6 rounded-xl backdrop-blur-md border border-cyan-500/30 text-white font-orbitron shadow-[0_0_20px_rgba(0,255,255,0.1)]">
                                    <div className="text-xl font-bold flex items-center gap-2"><span className="text-cyan-400 drop-shadow-[0_0_5px_rgba(0,255,255,0.8)]">DIST</span><span ref={scoreRef} className="text-white text-2xl">0m</span></div>
                                    <div className="text-xl font-bold flex items-center gap-2"><span className="text-purple-400 drop-shadow-[0_0_5px_rgba(192,38,211,0.8)]">SPD</span><span ref={speedRef} className="text-white text-2xl">0 km/h</span></div>
                                    <div className="text-xl font-bold flex items-center gap-2"><span className="text-orange-400 drop-shadow-[0_0_5px_rgba(251,146,60,0.8)]">GEAR</span><span ref={gearRefDisplay} className="text-white text-2xl">1</span><span className="text-xs text-gray-400 tracking-widest">MANUAL</span></div>
                                    <div className="text-xl font-bold mt-2 flex items-center gap-2"><span className="text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]">COINS</span><span ref={coinRefHUD} className="text-white text-2xl">0</span></div>
                                    <div className="text-xl font-bold mt-2 flex items-center gap-2"><span className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">NITRO</span><span className="text-white text-2xl">{boosters}</span><span className="text-xs text-gray-400 tracking-widest">SHIFT</span></div>
                                    <div className="text-xs text-gray-500 mt-2 tracking-widest border-t border-white/10 pt-2">CONTROLS: W / S</div>
                                    <div className="mt-3 w-full h-1 bg-gray-800 rounded-full overflow-hidden"><div ref={distBarRef} className="h-full bg-gradient-to-r from-cyan-400 to-blue-600 w-0 transition-all duration-200 shadow-[0_0_10px_rgba(0,255,255,0.5)]"></div></div>
                                    <div className="text-[10px] text-cyan-500/70 text-center mt-1 tracking-widest">NEXT CHECKPOINT</div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-4 items-end pointer-events-auto">
                                <button onClick={() => setGameState('menu')} className="px-8 py-2 bg-red-600/80 text-white font-bold font-orbitron rounded-lg border border-red-500/50 hover:bg-red-500 transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] backdrop-blur-sm">ABORT RUN</button>
                                <div className="w-72 bg-black/20 p-4 rounded-xl backdrop-blur-md border border-red-500/30 pointer-events-none shadow-[0_0_20px_rgba(220,38,38,0.1)]">
                                    <div className="text-red-400 font-bold mb-2 font-orbitron tracking-widest drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]">FUEL LEVEL</div>
                                    <div className="w-full h-4 bg-gray-900/80 rounded-full overflow-hidden border border-white/10 relative">
                                        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(90deg, transparent 50%, rgba(0,0,0,0.5) 50%)', backgroundSize: '10px 100%' }}></div>
                                        <div ref={fuelBarRef} className="h-full bg-gradient-to-r from-red-600 via-yellow-500 to-green-500 w-full transition-all duration-200 shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {gameState === 'gameover' && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white z-50 backdrop-blur-lg">
                    <h2 className="text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-900 mb-8 font-orbitron drop-shadow-[0_0_20px_rgba(220,38,38,0.8)] animate-pulse">GAME OVER</h2>
                    <div className="bg-black/40 p-12 rounded-3xl border-2 border-red-500/50 shadow-[0_0_50px_rgba(220,38,38,0.2)] flex flex-col items-center gap-6 backdrop-blur-md">
                        <div className="text-3xl text-yellow-400 font-orbitron tracking-widest flex flex-col items-center"><span className="text-sm text-gray-400 mb-1">TOTAL EARNINGS</span><span className="text-5xl drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">{gameOverStats.coins} <span className="text-2xl">$</span></span></div>
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
                        <div className="text-2xl text-cyan-400 font-orbitron tracking-widest flex flex-col items-center"><span className="text-sm text-gray-400 mb-1">DISTANCE TRAVELED</span><span className="text-4xl drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">{gameOverStats.distance}m</span></div>
                    </div>
                    <div className="flex gap-6 mt-12 pointer-events-auto">
                        <button onClick={() => startGame(trackType)} className="group relative px-12 py-4 bg-yellow-500 text-black font-black text-2xl rounded-xl overflow-hidden shadow-[0_0_20px_rgba(234,179,8,0.5)] hover:scale-105 transition-transform"><div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div><span className="relative z-10 font-orbitron">RETRY RUN</span></button>
                        <button onClick={() => setGameState('menu')} className="group relative px-12 py-4 bg-transparent text-white border-2 border-white/20 font-black text-2xl rounded-xl overflow-hidden hover:bg-white/10 hover:border-white/50 transition-all"><span className="relative z-10 font-orbitron">MAIN MENU</span></button>
                    </div>
                </div>
            )}
            {isMobile && (
                <div className={`absolute bottom-0 left-0 right-0 pointer-events-none z-40 px-4 w-full ${isLandscape ? 'pb-8' : 'pb-8'}`}>
                    <div className="flex justify-between items-end w-full pointer-events-auto gap-3">
                        <div className="flex gap-2">
                            <button onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyW') }} onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyW') }} className="w-14 h-14 rounded-lg bg-cyan-500/30 border border-cyan-400 backdrop-blur-sm flex items-center justify-center active:bg-cyan-500/60 active:scale-95 transition-all"><span className="text-xl text-white font-black">▲</span></button>
                            <button onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyS') }} onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyS') }} className="w-14 h-14 rounded-lg bg-purple-500/30 border border-purple-400 backdrop-blur-sm flex items-center justify-center active:bg-purple-500/60 active:scale-95 transition-all"><span className="text-xl text-white font-black">▼</span></button>
                        </div>
                        <button onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyA') }} onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyA') }} className="w-16 h-16 rounded-xl bg-red-500/30 border-2 border-red-400 backdrop-blur-sm flex items-center justify-center active:bg-red-500/60 active:scale-95 transition-all"><span className="text-xs text-white font-black font-orbitron">BR</span></button>
                        <button onTouchStart={(e) => { e.preventDefault(); handleTouchStart('KeyD') }} onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('KeyD') }} className="w-20 h-24 rounded-2xl bg-green-500/30 border-2 border-green-400 backdrop-blur-sm flex items-center justify-center active:bg-green-500/60 active:scale-95 transition-all"><span className="text-base text-white font-black font-orbitron">GAS</span></button>
                    </div>
                </div>
            )}
        </div>
    )
}
