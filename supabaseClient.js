const { createClient } = require('@supabase/supabase-js');

// Update supabaseClient.js with Render's PostgreSQL connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
});

module.exports = { supabase }; 