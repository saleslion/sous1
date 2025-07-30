-- =====================================================
-- SOUSIE APP - COMPLETE DATABASE SETUP
-- =====================================================
-- This script creates all necessary tables for the Sousie cooking assistant app
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USER PROFILES TABLE
-- =====================================================
-- Extended user information beyond Supabase Auth
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    dietary_preferences TEXT[], -- Array of dietary restrictions/preferences
    favorite_cuisines TEXT[], -- Array of favorite cuisine types
    cooking_skill_level TEXT CHECK (cooking_skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. USER LIKED RECIPES TABLE
-- =====================================================
-- Stores user's favorite recipes
CREATE TABLE IF NOT EXISTS user_liked_recipes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipe_identifier TEXT NOT NULL, -- Unique identifier for the recipe
    recipe_name TEXT NOT NULL,
    recipe_data JSONB NOT NULL, -- Full recipe data (ingredients, instructions, etc.)
    source TEXT DEFAULT 'sousie_generated', -- Where the recipe came from
    tags TEXT[], -- User-added tags
    personal_notes TEXT, -- User's personal notes about the recipe
    liked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, recipe_identifier)
);

-- =====================================================
-- 3. USER MENUS TABLE
-- =====================================================
-- Stores saved weekly meal plans
CREATE TABLE IF NOT EXISTS user_menus (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    menu_name TEXT NOT NULL,
    menu_data JSONB NOT NULL, -- Weekly menu structure with days and meals
    grocery_list JSONB, -- Generated grocery list
    week_start_date DATE, -- Which week this menu is for
    is_active BOOLEAN DEFAULT FALSE, -- Is this the current active menu
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. USER INTENTS TABLE
-- =====================================================
-- Tracks user interactions and intents for analytics and personalization
CREATE TABLE IF NOT EXISTS user_intents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT, -- Browser session ID
    intent_type TEXT NOT NULL CHECK (intent_type IN (
        'chat_message', 'recipe_search', 'recipe_like', 'recipe_unlike', 
        'menu_generate', 'menu_save', 'surprise_me', 'ingredient_search',
        'dietary_filter', 'cuisine_preference', 'cooking_tip_request'
    )),
    intent_data JSONB NOT NULL, -- Detailed data about the intent
    user_input TEXT, -- What the user typed/searched
    ai_response TEXT, -- AI's response (for chat messages)
    success BOOLEAN DEFAULT TRUE, -- Whether the intent was successfully fulfilled
    error_message TEXT, -- If there was an error
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. RECIPE RATINGS TABLE
-- =====================================================
-- User ratings and reviews for recipes
CREATE TABLE IF NOT EXISTS recipe_ratings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipe_identifier TEXT NOT NULL,
    recipe_name TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    review_text TEXT,
    difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
    prep_time_actual INTEGER, -- Actual prep time in minutes
    cook_time_actual INTEGER, -- Actual cook time in minutes
    would_make_again BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, recipe_identifier)
);

-- =====================================================
-- 6. COOKING SESSIONS TABLE
-- =====================================================
-- Track when users actually cook recipes
CREATE TABLE IF NOT EXISTS cooking_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    recipe_identifier TEXT NOT NULL,
    recipe_name TEXT NOT NULL,
    session_date DATE DEFAULT CURRENT_DATE,
    completed BOOLEAN DEFAULT FALSE,
    notes TEXT, -- User's notes about how it went
    modifications TEXT, -- Any changes they made to the recipe
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. USER PREFERENCES TABLE
-- =====================================================
-- Detailed user preferences and settings
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    unit_system TEXT DEFAULT 'us' CHECK (unit_system IN ('us', 'metric')),
    default_serving_size INTEGER DEFAULT 4,
    dietary_restrictions TEXT[], -- Allergies, intolerances
    disliked_ingredients TEXT[], -- Ingredients to avoid
    preferred_meal_types TEXT[], -- breakfast, lunch, dinner, snack, dessert
    cooking_time_preference TEXT DEFAULT 'medium' CHECK (cooking_time_preference IN ('quick', 'medium', 'long')),
    spice_tolerance TEXT DEFAULT 'medium' CHECK (spice_tolerance IN ('mild', 'medium', 'hot', 'very_hot')),
    equipment_available TEXT[], -- Available kitchen equipment
    notification_preferences JSONB DEFAULT '{"email": true, "push": false}',
    privacy_settings JSONB DEFAULT '{"share_recipes": false, "show_activity": false}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_liked_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - USER PROFILES
-- =====================================================

CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- =====================================================
-- RLS POLICIES - USER LIKED RECIPES
-- =====================================================

CREATE POLICY "Users can view own liked recipes" ON user_liked_recipes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own liked recipes" ON user_liked_recipes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own liked recipes" ON user_liked_recipes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own liked recipes" ON user_liked_recipes
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - USER MENUS
-- =====================================================

CREATE POLICY "Users can view own menus" ON user_menus
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own menus" ON user_menus
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own menus" ON user_menus
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own menus" ON user_menus
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - USER INTENTS
-- =====================================================

CREATE POLICY "Users can view own intents" ON user_intents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intents" ON user_intents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - RECIPE RATINGS
-- =====================================================

CREATE POLICY "Users can view own ratings" ON recipe_ratings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ratings" ON recipe_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings" ON recipe_ratings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ratings" ON recipe_ratings
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - COOKING SESSIONS
-- =====================================================

CREATE POLICY "Users can view own cooking sessions" ON cooking_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cooking sessions" ON cooking_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cooking sessions" ON cooking_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cooking sessions" ON cooking_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES - USER PREFERENCES
-- =====================================================

CREATE POLICY "Users can view own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- User liked recipes indexes
CREATE INDEX IF NOT EXISTS idx_user_liked_recipes_user_id ON user_liked_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_liked_recipes_recipe_identifier ON user_liked_recipes(recipe_identifier);
CREATE INDEX IF NOT EXISTS idx_user_liked_recipes_liked_at ON user_liked_recipes(liked_at DESC);

-- User menus indexes
CREATE INDEX IF NOT EXISTS idx_user_menus_user_id ON user_menus(user_id);
CREATE INDEX IF NOT EXISTS idx_user_menus_is_active ON user_menus(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_menus_week_start ON user_menus(user_id, week_start_date);

-- User intents indexes
CREATE INDEX IF NOT EXISTS idx_user_intents_user_id ON user_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_intents_type ON user_intents(intent_type);
CREATE INDEX IF NOT EXISTS idx_user_intents_created_at ON user_intents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_intents_session ON user_intents(session_id);

-- Recipe ratings indexes
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_user_id ON recipe_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ratings_recipe_id ON recipe_ratings(recipe_identifier);

-- Cooking sessions indexes
CREATE INDEX IF NOT EXISTS idx_cooking_sessions_user_id ON cooking_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cooking_sessions_date ON cooking_sessions(user_id, session_date DESC);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_liked_recipes_updated_at BEFORE UPDATE ON user_liked_recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_menus_updated_at BEFORE UPDATE ON user_menus FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recipe_ratings_updated_at BEFORE UPDATE ON recipe_ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cooking_sessions_updated_at BEFORE UPDATE ON cooking_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    
    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- SAMPLE DATA (OPTIONAL)
-- =====================================================
-- Uncomment the following if you want some sample data

/*
-- Sample user preferences (this would be created automatically by the trigger)
INSERT INTO user_preferences (user_id, dietary_restrictions, preferred_meal_types) 
VALUES 
    ('sample-user-id', ARRAY['vegetarian'], ARRAY['dinner', 'lunch'])
ON CONFLICT (user_id) DO NOTHING;
*/

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Database setup completed successfully!';
    RAISE NOTICE 'Created tables: user_profiles, user_liked_recipes, user_menus, user_intents, recipe_ratings, cooking_sessions, user_preferences';
    RAISE NOTICE 'All RLS policies and indexes have been created.';
    RAISE NOTICE 'Your Sousie app is ready for user authentication and data storage!';
END $$;