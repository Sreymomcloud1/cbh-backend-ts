-- =============================================================================
-- Cambodia Business Hub — Seed Data
-- Migration: 002_seed_data.sql
-- Populates the database with the exact same mock data from the frontend
-- (/data/index.ts) so the app works immediately after first run.
--
-- Passwords are bcrypt hashes of the demo passwords shown in the frontend:
--   startup@demo.com  → password: "demo1234"
--   customer@demo.com → password: "demo1234"
--   admin@cbh.com     → password: "admin123"
--
-- Run:  node src/utils/migrate.js   (picks this up automatically after 001)
-- =============================================================================

-- =============================================================================
-- USERS
-- =============================================================================

INSERT INTO users (id, email, password_hash, role, name, phone) VALUES
  -- Startup owners
  ('a0000001-0000-0000-0000-000000000001',
   'startup@demo.com',
   '$2b$10$Kix4kMHiWKnEP4q9bNrMxOi4YF2g5mJ8PlkRE7bFtnbsqPR6Qwzee',  -- demo1234
   'startup', 'Sophea Mao', '+855 12 345 678'),

  ('a0000001-0000-0000-0000-000000000002',
   'ratanak@angkorfoods.com',
   '$2b$10$Kix4kMHiWKnEP4q9bNrMxOi4YF2g5mJ8PlkRE7bFtnbsqPR6Qwzee',
   'startup', 'Ratanak Sok', '+855 17 654 321'),

  ('a0000001-0000-0000-0000-000000000003',
   'chanda@edukhmer.io',
   '$2b$10$Kix4kMHiWKnEP4q9bNrMxOi4YF2g5mJ8PlkRE7bFtnbsqPR6Qwzee',
   'startup', 'Chanda Heng', '+855 98 111 222'),

  ('a0000001-0000-0000-0000-000000000004',
   'veasna@finpay.com.kh',
   '$2b$10$Kix4kMHiWKnEP4q9bNrMxOi4YF2g5mJ8PlkRE7bFtnbsqPR6Qwzee',
   'startup', 'Veasna Keo', '+855 11 999 888'),

  ('a0000001-0000-0000-0000-000000000005',
   'sokha@mekonghealth.kh',
   '$2b$10$Kix4kMHiWKnEP4q9bNrMxOi4YF2g5mJ8PlkRE7bFtnbsqPR6Qwzee',
   'startup', 'Sokha Ean', '+855 23 445 566'),

  ('a0000001-0000-0000-0000-000000000006',
   'monyrath@khmerharvest.com',
   '$2b$10$Kix4kMHiWKnEP4q9bNrMxOi4YF2g5mJ8PlkRE7bFtnbsqPR6Qwzee',
   'startup', 'Monyrath Chhun', '+855 77 321 654'),

  -- Customer / Investor
  ('b0000001-0000-0000-0000-000000000001',
   'customer@demo.com',
   '$2b$10$Kix4kMHiWKnEP4q9bNrMxOi4YF2g5mJ8PlkRE7bFtnbsqPR6Qwzee',  -- demo1234
   'customer', 'James Wong', '+65 9123 4567'),

  -- Admin (password: admin123 — update before production)
  ('c0000001-0000-0000-0000-000000000001',
   'admin@cbh.com',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',  -- admin123
   'admin', 'CBH Admin', NULL)

ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- CUSTOMER PROFILES
-- =============================================================================

INSERT INTO customer_profiles (user_id, company, title) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'Nexus Capital', 'Partner')
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- STARTUP PROFILES
-- =============================================================================

INSERT INTO startup_profiles (
  id, user_id, slug, business_name, tagline, description,
  logo_initials, industry, funding_stage, plan,
  location, website, founded_year, employee_range,
  verification_status, verified_at,
  founder_name, founder_email
) VALUES

  ('d0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001',
   'khmer-tech',
   'KhmerTech Solutions',
   'Powering digital transformation across Southeast Asia',
   'KhmerTech Solutions is a leading software development company based in Phnom Penh, specializing in custom enterprise software, mobile applications, and cloud infrastructure. We''ve helped over 50 businesses modernize their operations since 2019.',
   'KT', 'Technology', 'Series A', 'pro',
   'Phnom Penh, Cambodia', 'https://khmertech.kh', '2019', '45-60',
   'Approved', NOW(),
   'Sophea Mao', 'startup@demo.com'),

  ('d0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000002',
   'angkor-foods',
   'Angkor Foods Co.',
   'Bringing authentic Cambodian flavors to the world',
   'Angkor Foods is an artisan food and beverage company that sources traditional Cambodian ingredients and produces premium packaged products for both local and international markets.',
   'AF', 'Food & Beverage', 'Seed', 'free',
   'Siem Reap, Cambodia', 'https://angkorfoods.com', '2021', '15-25',
   'Approved', NOW(),
   'Ratanak Sok', 'ratanak@angkorfoods.com'),

  ('d0000001-0000-0000-0000-000000000003',
   'a0000001-0000-0000-0000-000000000003',
   'edukhmer',
   'EduKhmer',
   'Quality education accessible to every Cambodian student',
   'EduKhmer is an EdTech startup building Cambodia''s most comprehensive online learning platform. We offer courses in coding, business, languages, and professional skills — all in Khmer and English.',
   'EK', 'Education', 'Pre-Seed', 'free',
   'Phnom Penh, Cambodia', 'https://edukhmer.io', '2022', '8-15',
   'Pending', NULL,
   'Chanda Heng', 'chanda@edukhmer.io'),

  ('d0000001-0000-0000-0000-000000000004',
   'a0000001-0000-0000-0000-000000000004',
   'cambodia-finpay',
   'CambodiaFinPay',
   'Modern payment infrastructure for growing businesses',
   'CambodiaFinPay builds payment APIs and embedded finance solutions for Cambodian and regional businesses. We simplify multi-currency transactions, lending infrastructure, and financial reporting for SMEs.',
   'CF', 'Finance', 'Series B', 'pro',
   'Phnom Penh, Cambodia', 'https://finpay.com.kh', '2018', '80-120',
   'Pending', NULL,
   'Veasna Keo', 'veasna@finpay.com.kh'),

  ('d0000001-0000-0000-0000-000000000005',
   'a0000001-0000-0000-0000-000000000005',
   'mekong-health',
   'Mekong Health',
   'Telehealth and diagnostics for underserved communities',
   'Mekong Health connects patients in rural Cambodia with licensed doctors through its telehealth platform. We also partner with local clinics to provide affordable diagnostic testing and preventive care programs.',
   'MH', 'Healthcare', 'Bootstrapped', 'free',
   'Battambang, Cambodia', 'https://mekonghealth.kh', '2020', '20-30',
   'Approved', NOW(),
   'Sokha Ean', 'sokha@mekonghealth.kh'),

  ('d0000001-0000-0000-0000-000000000006',
   'a0000001-0000-0000-0000-000000000006',
   'khmer-harvest',
   'Khmer Harvest',
   'Connecting farmers to markets through smart agritech',
   'Khmer Harvest is an agritech platform that uses IoT sensors, weather data, and AI to help Cambodian farmers optimize crop yield. Our marketplace directly links farmers to retailers and exporters, cutting out middlemen.',
   'KH', 'Agriculture', 'Growth', 'pro',
   'Kampong Cham, Cambodia', 'https://khmerharvest.com', '2020', '30-45',
   'Pending', NULL,
   'Monyrath Chhun', 'monyrath@khmerharvest.com')

ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- SERVICES
-- =============================================================================

INSERT INTO startup_services (startup_id, name, sort_order) VALUES
  -- KhmerTech
  ('d0000001-0000-0000-0000-000000000001', 'Custom Software Development', 1),
  ('d0000001-0000-0000-0000-000000000001', 'Mobile App Development', 2),
  ('d0000001-0000-0000-0000-000000000001', 'Cloud Migration', 3),
  ('d0000001-0000-0000-0000-000000000001', 'API Integration', 4),
  ('d0000001-0000-0000-0000-000000000001', 'IT Consulting', 5),
  ('d0000001-0000-0000-0000-000000000001', 'UI/UX Design', 6),
  -- Angkor Foods
  ('d0000001-0000-0000-0000-000000000002', 'Artisan Food Production', 1),
  ('d0000001-0000-0000-0000-000000000002', 'Export Consulting', 2),
  ('d0000001-0000-0000-0000-000000000002', 'Private Labeling', 3),
  ('d0000001-0000-0000-0000-000000000002', 'Retail Distribution', 4),
  -- EduKhmer
  ('d0000001-0000-0000-0000-000000000003', 'Online Courses', 1),
  ('d0000001-0000-0000-0000-000000000003', 'Corporate Training', 2),
  ('d0000001-0000-0000-0000-000000000003', 'Certification Programs', 3),
  ('d0000001-0000-0000-0000-000000000003', 'Live Tutoring', 4),
  -- CambodiaFinPay
  ('d0000001-0000-0000-0000-000000000004', 'Payment Gateway', 1),
  ('d0000001-0000-0000-0000-000000000004', 'Multi-Currency Wallets', 2),
  ('d0000001-0000-0000-0000-000000000004', 'Lending API', 3),
  ('d0000001-0000-0000-0000-000000000004', 'Financial Dashboards', 4),
  ('d0000001-0000-0000-0000-000000000004', 'Compliance Tools', 5),
  -- Mekong Health
  ('d0000001-0000-0000-0000-000000000005', 'Telehealth Consultations', 1),
  ('d0000001-0000-0000-0000-000000000005', 'Diagnostic Testing', 2),
  ('d0000001-0000-0000-0000-000000000005', 'Preventive Care Programs', 3),
  ('d0000001-0000-0000-0000-000000000005', 'Clinic Partnerships', 4),
  -- Khmer Harvest
  ('d0000001-0000-0000-0000-000000000006', 'IoT Farm Monitoring', 1),
  ('d0000001-0000-0000-0000-000000000006', 'Crop Advisory AI', 2),
  ('d0000001-0000-0000-0000-000000000006', 'Direct-to-Market Sales', 3),
  ('d0000001-0000-0000-0000-000000000006', 'Supply Chain Logistics', 4)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- TEAM MEMBERS
-- =============================================================================

INSERT INTO startup_team_members (startup_id, name, role, avatar_initials, sort_order) VALUES
  -- KhmerTech
  ('d0000001-0000-0000-0000-000000000001', 'Sophea Mao',  'CEO & Co-Founder', 'SM', 1),
  ('d0000001-0000-0000-0000-000000000001', 'Dara Pich',   'CTO',              'DP', 2),
  ('d0000001-0000-0000-0000-000000000001', 'Lina Chan',   'Head of Design',   'LC', 3),
  -- Angkor Foods
  ('d0000001-0000-0000-0000-000000000002', 'Ratanak Sok', 'Founder & CEO',    'RS', 1),
  ('d0000001-0000-0000-0000-000000000002', 'Maly Vong',   'Head of Operations','MV',2),
  -- EduKhmer
  ('d0000001-0000-0000-0000-000000000003', 'Chanda Heng', 'CEO',              'CH', 1),
  ('d0000001-0000-0000-0000-000000000003', 'Piseth Lim',  'Head of Content',  'PL', 2),
  ('d0000001-0000-0000-0000-000000000003', 'Sreyla Noun', 'Head of Marketing','SN', 3),
  -- CambodiaFinPay
  ('d0000001-0000-0000-0000-000000000004', 'Veasna Keo',  'CEO & Co-Founder', 'VK', 1),
  ('d0000001-0000-0000-0000-000000000004', 'Thida Roth',  'CFO',              'TR', 2),
  ('d0000001-0000-0000-0000-000000000004', 'Borey Im',    'CTO',              'BI', 3),
  -- Mekong Health
  ('d0000001-0000-0000-0000-000000000005', 'Sokha Ean',      'Founder & CMO',    'SE', 1),
  ('d0000001-0000-0000-0000-000000000005', 'Dr. Panha Ros',  'Medical Director', 'PR', 2),
  -- Khmer Harvest
  ('d0000001-0000-0000-0000-000000000006', 'Monyrath Chhun', 'CEO',              'MC', 1),
  ('d0000001-0000-0000-0000-000000000006', 'Dalin Phon',     'Head of Agronomy', 'DP', 2),
  ('d0000001-0000-0000-0000-000000000006', 'Kagna Yem',      'Head of Engineering','KY',3)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SAMPLE CONNECTION REQUESTS
-- (Mirrors the INBOX_ITEMS from frontend/data/index.ts)
-- =============================================================================

INSERT INTO connection_requests (
  id, sender_id, startup_id,
  sender_full_name, sender_company, sender_role, sender_email, sender_phone,
  purpose, message, subject, status, budget_range
) VALUES

  ('e0000001-0000-0000-0000-000000000001',
   'b0000001-0000-0000-0000-000000000001',
   'd0000001-0000-0000-0000-000000000001',
   'James Wong', 'Nexus Capital', 'Partner', 'james@nexuscapital.com', '+65 9123 4567',
   'Invest',
   'Hi Sophea, I came across your profile on CBH and I''m very impressed by KhmerTech''s growth trajectory. We at Nexus Capital are actively looking to invest in Southeast Asian tech companies. Would love to schedule a call to discuss potential investment opportunities.',
   'Investment Interest in KhmerTech',
   'New', '$500K–$2M'),

  ('e0000001-0000-0000-0000-000000000002',
   'b0000001-0000-0000-0000-000000000001',
   'd0000001-0000-0000-0000-000000000002',
   'James Wong', 'Nexus Capital', 'Partner', 'james@nexuscapital.com', '+65 9123 4567',
   'Become Customer',
   'Hello, we operate a chain of specialty food stores across Hong Kong and Singapore. We''ve been looking for authentic Cambodian food brands to feature in our stores. Angkor Foods looks like a perfect fit. Can we discuss terms?',
   'Partnership Inquiry — Premium Food Distribution',
   'Reviewed', NULL),

  ('e0000001-0000-0000-0000-000000000003',
   'b0000001-0000-0000-0000-000000000001',
   'd0000001-0000-0000-0000-000000000003',
   'James Wong', 'TechVentures Asia', 'Partner', 'james@techventures.com', NULL,
   'Collaborate',
   'Hi Chanda, we''re building a corporate learning platform and think EduKhmer''s content library would be an incredible complement to our offering. We''d love to explore a white-label content partnership.',
   'Collaboration on Corporate Training Content',
   'New', NULL),

  ('e0000001-0000-0000-0000-000000000004',
   'b0000001-0000-0000-0000-000000000001',
   'd0000001-0000-0000-0000-000000000005',
   'James Wong', 'HealthBridge Fund', 'Partner', 'james@healthbridge.com', NULL,
   'Invest',
   'Hello Sokha, HealthBridge Fund focuses exclusively on impact healthcare investments in emerging markets. Your telehealth model aligns perfectly with our portfolio thesis. We''d like to explore a seed-stage investment of $250K–$500K.',
   'Seed Funding for Mekong Health',
   'Responded', '$250K–$500K')

ON CONFLICT DO NOTHING;

-- =============================================================================
-- PLATFORM MESSAGES
-- =============================================================================

INSERT INTO platform_messages (title, body, sent_by, is_active) VALUES
  (
    'New Feature: Analytics Dashboard',
    'We''ve launched a brand new Analytics Dashboard for all Pro members. You can now track profile views, connection trends, and request conversion rates in real-time. Log in to explore the new features.',
    NULL,
    TRUE
  ),
  (
    'Welcome to Cambodia Business Hub',
    'Thank you for joining CBH — Cambodia''s premier startup directory. Complete your profile and submit your verification documents to get your Verified badge and start receiving connection requests.',
    NULL,
    TRUE
  )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- NOTIFICATION PREFERENCES (defaults for seeded users)
-- =============================================================================

INSERT INTO notification_preferences (user_id, new_requests, messages, platform_updates, newsletter)
SELECT id, TRUE, TRUE, FALSE, FALSE FROM users
ON CONFLICT (user_id) DO NOTHING;
