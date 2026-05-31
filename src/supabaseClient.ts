/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xgmmvpmoyywpttuslwkh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnbW12cG1veXl3cHR0dXNsd2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzU1MDIsImV4cCI6MjA5NTMxMTUwMn0.j9zOJQgczrW0XeJgiUnTFs9TRpJXnsw3eIgBd0zaxVA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
