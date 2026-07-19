import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://afsoyuczexiztsjntkvi.supabase.co';
const defaultSupabasePublishableKey =
  'sb_publishable_ARjsX-L4PvbkuPSEttyQnQ_Wtq-Aibs';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || defaultSupabaseUrl;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  defaultSupabasePublishableKey;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types for our database
export interface Test {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  is_active: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  test_id: string;
  question_number: number;
  question_text: string;
  image_url: string | null;
  options: string; // JSON string of options
  correct_answer: string;
  dimension: 'analyst' | 'strategist' | 'observer' | 'intuitive';
  created_at: string;
}

export type PublicQuestion = Omit<Question, 'correct_answer'>;

export interface TestSession {
  id: string;
  test_id: string;
  email: string | null;
  answers: string | null; // JSON string
  analyst_score: number | null;
  strategist_score: number | null;
  observer_score: number | null;
  intuitive_score: number | null;
  overall_score: number | null;
  is_paid: boolean;
  stripe_session_id: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AppSettings {
  id: string;
  key: string;
  value: string;
}

export interface HomeContent {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface ArchetypeResult {
  id: string;
  dimension: 'analyst' | 'strategist' | 'observer' | 'intuitive';
  title_ru: string;
  title_en: string;
  content_ru: string; // Full rich text content in Russian
  content_en: string; // Full rich text content in English
  updated_at: string;
}
