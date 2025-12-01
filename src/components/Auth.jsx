
import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Auth({ onLogin }) {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [message, setMessage] = useState('')

    const handleAuth = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                })
                if (error) throw error
                setMessage('Check your email for the login link!')
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
                onLogin()
            }
        } catch (error) {
            setMessage(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/90 backdrop-blur-md font-['Rajdhani']">
            <div className="bg-black/80 p-10 rounded-3xl border border-cyan-500/30 shadow-[0_0_50px_rgba(0,255,255,0.1)] w-full max-w-md flex flex-col gap-6 relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>

                <h2 className="text-4xl font-black italic text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 font-['Orbitron'] drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
                    {isSignUp ? 'INITIATE LINK' : 'SYSTEM ACCESS'}
                </h2>

                <form onSubmit={handleAuth} className="flex flex-col gap-4">
                    <div>
                        <label className="text-cyan-400 text-sm font-bold tracking-widest mb-1 block">IDENTITY (EMAIL)</label>
                        <input
                            type="email"
                            placeholder="pilot@future.net"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none focus:shadow-[0_0_15px_rgba(0,255,255,0.3)] transition-all font-mono"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-purple-400 text-sm font-bold tracking-widest mb-1 block">ACCESS CODE (PASSWORD)</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none focus:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all font-mono"
                            required
                        />
                    </div>

                    {message && (
                        <div className={`text-center text-sm font-bold p-2 rounded ${message.includes('Check') ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'}`}>
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-4 w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-xl font-['Orbitron'] rounded-xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(0,255,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'PROCESSING...' : (isSignUp ? 'ESTABLISH LINK' : 'ACCESS SYSTEM')}
                    </button>
                </form>

                <div className="text-center">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-gray-400 hover:text-white text-sm tracking-wider transition-colors border-b border-transparent hover:border-white"
                    >
                        {isSignUp ? 'ALREADY HAVE ACCESS? LOGIN' : 'NEW PILOT? REGISTER'}
                    </button>
                </div>
            </div>
        </div>
    )
}
