#!/usr/bin/env node
/**
 * Database Setup Script for Sousie App
 * Automatically creates all necessary tables and policies in Supabase
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvFile() {
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env.local file not found. Please create it with your Supabase credentials.');
        process.exit(1);
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#\s]+)=(.*)$/);
        if (match) {
            envVars[match[1]] = match[2];
        }
    });
    
    return envVars;
}

async function setupDatabase() {
    console.log('🍳 Setting up Sousie database...\n');
    
    // Load environment variables
    const env = loadEnvFile();
    
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ Missing required environment variables:');
        console.error('   - SUPABASE_URL');
        console.error('   - SUPABASE_SERVICE_ROLE_KEY');
        console.error('\nPlease add these to your .env.local file.');
        process.exit(1);
    }
    
    console.log('✅ Environment variables loaded');
    console.log('🔗 Supabase URL:', env.SUPABASE_URL);
    
    try {
        // Read the database setup SQL
        const sqlPath = path.join(__dirname, 'database_setup.sql');
        if (!fs.existsSync(sqlPath)) {
            console.error('❌ database_setup.sql file not found');
            process.exit(1);
        }
        
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        console.log('✅ Database setup SQL loaded');
        
        // Execute the SQL using fetch (since we don't have supabase client in Node.js)
        const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                'apikey': env.SUPABASE_SERVICE_ROLE_KEY
            },
            body: JSON.stringify({ 
                sql: sqlContent 
            })
        });
        
        if (response.ok) {
            console.log('✅ Database setup completed successfully!');
            console.log('\n🎉 All tables, policies, and indexes have been created.');
            console.log('\n📊 Created tables:');
            console.log('   - user_profiles');
            console.log('   - user_liked_recipes');
            console.log('   - user_menus');
            console.log('   - user_intents');
            console.log('   - recipe_ratings');
            console.log('   - cooking_sessions');
            console.log('   - user_preferences');
            console.log('\n🔐 Row Level Security (RLS) enabled on all tables');
            console.log('🚀 Your Sousie app is ready for deployment!');
        } else {
            console.error('❌ Database setup failed:', response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        console.log('\n💡 Manual setup option:');
        console.log('   1. Go to your Supabase project dashboard');
        console.log('   2. Navigate to SQL Editor');
        console.log('   3. Copy and paste the contents of database_setup.sql');
        console.log('   4. Run the script');
    }
}

// Alternative manual setup instructions
function showManualInstructions() {
    console.log('\n📋 MANUAL SETUP INSTRUCTIONS');
    console.log('=====================================');
    console.log('If the automatic setup fails, follow these steps:');
    console.log('');
    console.log('1. Open your Supabase project dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Create a new query');
    console.log('4. Copy the entire contents of database_setup.sql');
    console.log('5. Paste and run the script');
    console.log('6. Verify all tables are created successfully');
    console.log('');
    console.log('🔑 Required environment variables for Vercel:');
    console.log('   - OPENAI_API_KEY');
    console.log('   - SUPABASE_URL');
    console.log('   - SUPABASE_ANON_KEY');
    console.log('');
}

// Run the setup
if (require.main === module) {
    setupDatabase().then(() => {
        showManualInstructions();
    }).catch((error) => {
        console.error('Setup failed:', error);
        showManualInstructions();
        process.exit(1);
    });
}