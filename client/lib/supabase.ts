import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = "https://wdylkaiyoelfcmphoaqs.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWxrYWl5b2VsZmNtcGhvYXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MjcwMTQsImV4cCI6MjA4MjEwMzAxNH0.h9kbq-ABILY3ZrIZdWIimzJhdyGz-Cq1eztkEiCBKDk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export { supabaseUrl, supabaseAnonKey };
