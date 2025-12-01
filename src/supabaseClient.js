
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vvmswmjrhmycbvdqtsyp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bXN3bWpyaG15Y2J2ZHF0c3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NzEyODQsImV4cCI6MjA4MDE0NzI4NH0.QoWjR92voCIJ4_xh96mxI30RtTpVhbcYHv6Ip8BGCn0'

export const supabase = createClient(supabaseUrl, supabaseKey)
