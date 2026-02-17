# PI Connect MVP

A minimal working demo of the PI marketplace platform.

## Quick Start

### 1. Set up the database

Go to your Supabase project: https://supabase.com/dashboard/project/kpgcnqvlfbxhhtyhfxop

1. Click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open `pi-connect-mvp-schema.sql` in Notepad
4. Copy all the SQL and paste it into the editor
5. Click **Run** (green button)
6. Go to **Table Editor** - you should see: `profiles`, `pi_profiles`, `consultation_requests`

### 2. Add test data

You need at least one PI profile to test the search. In the SQL Editor, run:

```sql
-- First, create a test user (this gives you a user_id)
-- Note: You can also just sign up through the app's auth

-- Then insert a test PI profile (replace YOUR_USER_ID with an actual user ID from auth.users)
INSERT INTO public.pi_profiles (
  user_id,
  first_name,
  last_name,
  company_name,
  bio,
  city,
  state,
  location,
  license_number,
  years_experience,
  specialties,
  languages,
  is_verified,
  rating,
  review_count,
  subscription_status
) VALUES (
  'YOUR_USER_ID_HERE',
  'Jane',
  'Smith',
  'Smith Investigations',
  'Experienced private investigator with 10+ years specializing in surveillance and background checks.',
  'Miami',
  'FL',
  'Miami, FL',
  'A-123456',
  12,
  ARRAY['Surveillance', 'Background Investigation', 'Fraud Investigation'],
  ARRAY['English', 'Spanish'],
  true,
  4.7,
  18,
  'pro'
);
```

**To get a real user_id:**
- Option A: Go to **Authentication** → **Users** in Supabase and copy an existing user's ID
- Option B: Sign up in the app (if auth is enabled) and grab the ID from there

### 3. Run locally (Windows)

**Prerequisites:**
- Install Node.js from https://nodejs.org (download the LTS version)
- Extract the `pi-connect-mvp` folder

**Steps:**
1. Open Command Prompt (search "cmd" in Windows)
2. Navigate to the folder:
   ```
   cd path\to\pi-connect-mvp
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Start the dev server:
   ```
   npm run dev
   ```
5. Open your browser to `http://localhost:5173`

### 4. Test the search

1. Enter a city and state (e.g., "Miami", "FL")
2. Select one or more investigation types
3. Click "Find Investigators"
4. You should see your test PI profile(s) appear
5. Click "View Profile" to see the modal
6. Click "Request Consultation" (not wired up yet in MVP)

## What works

✅ Search by location (city/state)
✅ Filter by investigation type/specialties
✅ Display PI cards with ratings and info
✅ View full PI profiles in modal
✅ Responsive design

## What's not included yet

❌ User authentication (can be added)
❌ Consultation request form
❌ Messaging
❌ Dashboard
❌ Admin verification
❌ Payment/subscriptions

## Next steps

Once this works, you can:
1. Add authentication (Supabase Auth)
2. Build out the consultation request form
3. Add more PI profiles for testing
4. Deploy to Vercel/Netlify
5. Integrate back with Lovable if desired

## Troubleshooting

**No PIs showing up?**
- Make sure you added at least one PI profile to `pi_profiles` table
- Make sure `is_verified = true` on the PI profile
- Check the browser console (F12) for errors

**Database connection error?**
- Verify your Supabase URL and anon key in `src/supabaseClient.js`
- Make sure your Supabase project is not paused

**Can't install Node.js or npm?**
- You can also deploy this directly to Vercel/Netlify without running locally
- Just push the code to GitHub and connect it to Vercel
