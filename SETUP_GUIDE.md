# 🍳 Sousie - Complete Setup Guide

## ✅ Database Setup Checklist

### Step 1: Create Supabase Tables

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `database_setup.sql` 
4. Paste and **Run** the script
5. Verify all tables were created successfully

### Step 2: Configure Environment Variables

In your **Vercel Project Settings**, add these environment variables:

```
OPENAI_API_KEY = your_openai_api_key_here
SUPABASE_URL = https://nvazaobnepbwzommkakz.supabase.co
SUPABASE_ANON_KEY = your_supabase_anon_key_here
```

### Step 3: Enable Authentication

1. In Supabase, go to **Authentication** → **Settings**
2. Enable **Email** authentication
3. Configure your **Site URL** to your Vercel domain
4. Add your Vercel domain to **Redirect URLs**

## 🗄️ Database Tables Created

| Table | Purpose | Key Features |
|-------|---------|-------------|
| `user_profiles` | User information & preferences | Auto-created on signup |
| `user_liked_recipes` | Favorite recipes storage | Full recipe data stored |
| `user_menus` | Weekly meal plans | Includes grocery lists |
| `user_intents` | User behavior tracking | Analytics & personalization |
| `recipe_ratings` | Recipe reviews & ratings | User feedback system |
| `cooking_sessions` | Actual cooking tracking | When users cook recipes |
| `user_preferences` | Detailed user settings | Dietary restrictions, etc. |

## 🔐 Authentication Features

- ✅ **Secure signup/login** with email
- ✅ **Automatic profile creation** on first login
- ✅ **Row-level security** - users only see their data
- ✅ **Session management** with analytics tracking
- ✅ **Password reset** functionality

## 📊 Intent Tracking System

Every user interaction is tracked:

- **Chat messages** with AI responses
- **Recipe searches** with ingredients & filters
- **Recipe likes/unlikes** with timestamps
- **Menu generation** requests
- **Surprise me** clicks
- **Error events** for debugging

## 🚀 Deployment Status

The app is configured for automatic deployment:
- ✅ GitHub repository connected
- ✅ Vercel webhook configured  
- ✅ Build process optimized
- ✅ Environment variables ready
- ✅ Database schema complete

## 🧪 Test the Application

Once deployed, test these features:

1. **Authentication**:
   - Sign up with a new account
   - Verify profile is created
   - Log out and log back in

2. **Chat Interface**:
   - Ask Sousie a cooking question
   - Verify response appears
   - Check intent is tracked in database

3. **Recipe Finder**:
   - Enter ingredients (e.g., "chicken, rice")
   - Get recipe suggestions
   - Like a recipe and verify it's saved

4. **Menu Planner**:
   - Generate a weekly menu
   - Save the menu
   - Verify it appears in saved menus

## 🔧 Troubleshooting

### Common Issues:

**"Database not configured"**
- Check environment variables in Vercel
- Verify Supabase URL and keys are correct

**"Authentication not working"**
- Check redirect URLs in Supabase Auth settings
- Verify site URL matches your domain

**"Intent tracking failing"**
- Check user_intents table exists
- Verify RLS policies are enabled

**"Recipes not saving"**
- Check user_liked_recipes table
- Verify user is logged in
- Check browser console for errors

## 📱 User Experience Flow

1. **First Visit**: User sees login/signup options
2. **Registration**: Creates account → auto-profile creation  
3. **Onboarding**: Suggested questions help users start chatting
4. **Discovery**: Users find recipes via chat or ingredient search
5. **Engagement**: Save favorites, plan menus, rate recipes
6. **Retention**: Personalized recommendations based on history

## 🎯 Success Metrics

Monitor these in your database:

- **User registrations** (user_profiles count)
- **Chat engagement** (user_intents with type 'chat_message')
- **Recipe interactions** (likes, searches, saves)
- **Menu planning usage** (menu generations and saves)
- **Error rates** (failed intents)

Your Sousie app is now ready for users! 🍳✨