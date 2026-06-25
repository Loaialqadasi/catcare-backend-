-- ============================================
-- CatCare UTM — Development Seed Data (idempotent)
-- ============================================
-- WARNING: This file is for DEVELOPMENT use only.
-- Do NOT run this against a production database.
-- Add this file to .gitignore in production.
-- ============================================
-- IMPORTANT: Change these passwords before deploying to production!
-- ============================================
-- All passwords below are 'password123' (bcrypt cost-12 hash).
-- Accounts: admin@utm.my, manager@utm.my, student@graduate.utm.my
-- ============================================

-- ─── Seed Users ───
INSERT INTO users (full_name, email, password_hash, role, email_verified) VALUES
  ('Admin User',   'admin@utm.my',              '$2b$12$/XAd2C12mVFLKYpCOK/dO.L0n7FB1w0DVPTP45JkFLGE/Ui7AwBVC', 'admin',   TRUE),
  ('Manager User', 'manager@utm.my',            '$2b$12$/XAd2C12mVFLKYpCOK/dO.L0n7FB1w0DVPTP45JkFLGE/Ui7AwBVC', 'manager', TRUE),
  ('Student User', 'student@graduate.utm.my',   '$2b$12$/XAd2C12mVFLKYpCOK/dO.L0n7FB1w0DVPTP45JkFLGE/Ui7AwBVC', 'student', TRUE)
ON CONFLICT (email) DO UPDATE
SET
  password_hash  = EXCLUDED.password_hash,
  role           = EXCLUDED.role,
  email_verified = TRUE,
  updated_at     = NOW();

-- ─── Seed Cats ───
-- created_by_user_id resolves the student via subquery so the seed is order-independent.
INSERT INTO cats (nickname, description, photo_url, location_name, latitude, longitude, health_status, ownership_tag, created_by_user_id)
SELECT * FROM (VALUES
  ('Oyen Library',        'Friendly orange cat usually seen near the library.',          'https://placecats.com/millie/400/300', 'UTM Library',             1.5589000, 103.6389000, 'healthy',        'campus_managed', NULL),
  ('Grey Canteen',        'Shy grey cat often near the cafeteria.',                     'https://placecats.com/millie/400/300', 'UTM Cafeteria',           1.5600000, 103.6400000, 'needs_attention','stray',          NULL),
  ('Kucing Tepi Jalan',   'Black and white cat that hangs around the main road.',       'https://placecats.com/millie/400/300', 'UTM Main Road',           1.5595000, 103.6395000, 'healthy',        'stray',          NULL),
  ('Milo Dorm',           'Tabby cat adopted by students at the dormitory.',            'https://placecats.com/millie/400/300', 'UTM Dormitory Block A',   1.5610000, 103.6410000, 'healthy',        'adopted',        NULL),
  ('Putih Engineering',   'White cat with blue eyes near the engineering faculty.',     'https://placecats.com/millie/400/300', 'UTM Engineering Faculty', 1.5590000, 103.6380000, 'injured',        'campus_managed', NULL),
  ('Shadow Parking',      'Dark grey cat that lives in the parking area.',              'https://placecats.com/millie/400/300', 'UTM Parking Lot B',       1.5605000, 103.6405000, 'healthy',        'stray',          NULL),
  ('Ginger Mosque',       'Orange cat always sleeping near the mosque.',                'https://placecats.com/millie/400/300', 'UTM Mosque',              1.5598000, 103.6392000, 'needs_attention','campus_managed', NULL),
  ('Bulat Sports',        'Round fluffy cat near the sports complex.',                  'https://placecats.com/millie/400/300', 'UTM Sports Complex',      1.5602000, 103.6398000, 'healthy',        'stray',          NULL)
) AS t(nickname, description, photo_url, location_name, latitude, longitude, health_status, ownership_tag, _ignored)
WHERE NOT EXISTS (SELECT 1 FROM cats WHERE cats.nickname = t.nickname);

-- Set the created_by_user_id for seeded cats to the student account
UPDATE cats
SET created_by_user_id = (SELECT id FROM users WHERE email = 'student@graduate.utm.my')
WHERE created_by_user_id IS NULL
  AND nickname IN ('Oyen Library','Grey Canteen','Kucing Tepi Jalan','Milo Dorm',
                   'Putih Engineering','Shadow Parking','Ginger Mosque','Bulat Sports');

-- ─── Seed Emergency Reports ───
INSERT INTO emergency_reports (cat_id, title, description, emergency_type, priority, status, location_name, latitude, longitude, reported_by_user_id)
SELECT t.cat_id, t.title, t.description, t.emergency_type, t.priority, t.status, t.location_name, t.latitude, t.longitude, u.id
FROM (VALUES
  ('Oyen Library',      1, 'Injured cat near cafeteria',         'Cat appears to have an injured leg and needs urgent help.',     'injury',        'critical', 'open',        'UTM Cafeteria',           1.5600000, 103.6400000),
  ('Grey Canteen',      2, 'Cat missing near dorm',              'Grey cat missing since last night, last seen near dorm entrance.', 'missing',     'high',     'in_progress', 'UTM Dorm Entrance',       1.5590000, 103.6370000),
  ('Putih Engineering', 5, 'Injured white cat at engineering',   'The white cat near engineering faculty seems to have a cut on its paw.', 'injury', 'high',     'open',        'UTM Engineering Faculty', 1.5590000, 103.6380000),
  ('Ginger Mosque',     7, 'Ginger cat not eating',              'The orange cat near the mosque has not been eating for 2 days.','sickness',     'medium',   'open',        'UTM Mosque',              1.5598000, 103.6392000),
  (NULL,                NULL, 'Stray kitten at parking lot',     'Found a small kitten alone at the parking lot, looks very young.', 'danger',     'critical', 'open',        'UTM Parking Lot B',       1.5605000, 103.6405000),
  ('Kucing Tepi Jalan', 3, 'Kucing Tepi Jalan needs food',       'The black and white cat near main road seems underweight.',    'feeding_urgent','medium',   'resolved',    'UTM Main Road',           1.5595000, 103.6395000)
) AS t(nickname, _cat_rowid, title, description, emergency_type, priority, status, location_name, latitude, longitude)
CROSS JOIN users u
WHERE u.email = 'student@graduate.utm.my'
  AND NOT EXISTS (SELECT 1 FROM emergency_reports e WHERE e.title = t.title);

-- ─── Sample Donations ───
INSERT INTO donations (donor_name, donor_email, amount, receipt_url, note, status, rejection_reason, donor_user_id, reviewed_by_user_id, reviewed_at)
SELECT * FROM (VALUES
  ('Ahmad Razak',     'ahmad@graduate.utm.my',   50.00,  NULL::text,                                'Monthly contribution for cat food',     'pending',  NULL::text, NULL::bigint, NULL::bigint, NULL::timestamptz),
  ('Siti Nurhaliza',  'siti@graduate.utm.my',    200.00, 'https://example.com/receipts/r002.pdf',   'For veterinary expenses',              'approved', NULL::text, NULL::bigint, NULL::bigint, NULL::timestamptz),
  ('Lim Wei Jie',     'limwj@graduate.utm.my',   100.00, 'https://example.com/receipts/r003.pdf',   'General donation',                     'reviewed', NULL::text, NULL::bigint, NULL::bigint, NULL::timestamptz),
  ('Nur Aisyah',      'aisyah@graduate.utm.my',  30.00,  NULL::text,                                'For shelter supplies',                 'rejected', 'Receipt could not be verified. Please resubmit with a clearer image.', NULL::bigint, NULL::bigint, NULL::timestamptz),
  ('Tan Kok Meng',    'tankm@graduate.utm.my',   500.00, 'https://example.com/receipts/r005.pdf',   'Sponsorship for campus cat program',   'approved', NULL::text, NULL::bigint, NULL::bigint, NULL::timestamptz)
) AS t(donor_name, donor_email, amount, receipt_url, note, status, rejection_reason, _du, _ru, _ra)
WHERE NOT EXISTS (SELECT 1 FROM donations d WHERE d.donor_email = t.donor_email AND d.amount = t.amount);

-- Link donor_user_id to student where applicable
UPDATE donations SET donor_user_id = (SELECT id FROM users WHERE email = 'student@graduate.utm.my')
WHERE donor_name IN ('Ahmad Razak', 'Nur Aisyah') AND donor_user_id IS NULL;

-- Link reviewed_by_user_id to admin where applicable
UPDATE donations SET reviewed_by_user_id = (SELECT id FROM users WHERE email = 'admin@utm.my'),
                     reviewed_at = CASE
                       WHEN status = 'approved' AND donor_name = 'Siti Nurhaliza' THEN NOW() - INTERVAL '2 days'
                       WHEN status = 'reviewed' AND donor_name = 'Lim Wei Jie'    THEN NOW() - INTERVAL '1 day'
                       WHEN status = 'rejected' AND donor_name = 'Nur Aisyah'     THEN NOW() - INTERVAL '3 days'
                       WHEN status = 'approved' AND donor_name = 'Tan Kok Meng'   THEN NOW() - INTERVAL '5 days'
                       ELSE reviewed_at
                     END
WHERE reviewed_by_user_id IS NULL
  AND status IN ('approved', 'reviewed', 'rejected');

-- ─── Sample Care History ───
INSERT INTO care_history (cat_id, care_type, description, performed_by, performed_by_user_id)
SELECT c.id, t.care_type, t.description, t.performed_by, u.id
FROM (VALUES
  ('Oyen Library',      'feeding',  'Fed Oyen Library with wet food and fresh water near the library entrance.', 'Admin User'),
  ('Putih Engineering', 'medical',  'Applied antiseptic and bandaged the injured paw of Putih Engineering.',     'Admin User'),
  ('Milo Dorm',         'grooming', 'Brushed and cleaned Milo Dorm at the dormitory. Removed ticks.',            'Student User'),
  ('Ginger Mosque',     'feeding',  'Provided special appetite-stimulating food for Ginger Mosque.',             'Student User')
) AS t(nickname, care_type, description, performed_by)
JOIN cats c ON c.nickname = t.nickname
LEFT JOIN users u ON u.full_name = t.performed_by
WHERE NOT EXISTS (
  SELECT 1 FROM care_history ch
  WHERE ch.cat_id = c.id AND ch.description = t.description
);

-- ─── Verify ───
SELECT id, full_name, email, role, email_verified FROM users ORDER BY id;
