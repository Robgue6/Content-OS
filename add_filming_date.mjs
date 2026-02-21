const ACCESS_TOKEN = 'sbp_48acd39ed371b7e19084df4dfbb222b18d706fd3';
const PROJECT_REF = 'yxqdzzssasadajuuukzq';

const sql = `ALTER TABLE posts ADD COLUMN IF NOT EXISTS filming_date date;`;

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  }
);

const text = await res.text();
console.log('Status:', res.status);
console.log('Response:', text);
