const { createClient } = require('@supabase/supabase-js');

// Node 18 não tem WebSocket nativo — passa o polyfill via global
if (!global.WebSocket) {
  global.WebSocket = require('ws');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = { supabase };
