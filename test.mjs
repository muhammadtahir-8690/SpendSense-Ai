import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xtjqsuvqtmehnxdbjvqo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0anFzdXZxdG1laG54ZGJqdnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODg4MDksImV4cCI6MjA4ODI2NDgwOX0.HZnlp5vZ0jKBbC8zdITw-uvU93SRAkCcpe4KqTCZVbA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    console.log('Fetching transactions...');
    const { data, error } = await supabase.from('transactions').select('*');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success! Data:', data);
    }
}

test();
