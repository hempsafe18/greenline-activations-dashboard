-- Seed: current HempSafe-certified ambassador roster, pulled from the HubSpot
-- ambassador pipeline (category = Ambassador, hempsafe_certified = true).
--
-- strengths and headshot_url are intentionally left blank here — HubSpot has
-- no bio/strengths text or headshot for these contacts. Fill both in per
-- ambassador via the Supabase dashboard after reviewing each application
-- (see README "Adding / Updating Ambassadors").
insert into ambassadors (name, markets, hempsafe_certified, hempsafe_cert_date, status) values
  ('Lyza Marrish Rivera',        ARRAY['Jacksonville, FL'],                    true, '2026-07-20', 'active'),
  ('Stephanie Jones',            ARRAY['Atlanta, GA'],                         true, '2026-07-14', 'active'),
  ('Derion Orr',                 ARRAY['Atlanta, GA'],                         true, '2026-07-19', 'active'),
  ('Kent Dixon',                 ARRAY['Charlotte, NC'],                       true, '2026-07-19', 'active'),
  ('Surrayah Dixon',             ARRAY['Charlotte, NC'],                       true, '2026-07-03', 'active'),
  ('Rensha Allen',               ARRAY['Louisville, KY'],                      true, null,         'active'),
  ('Situ Wei',                   ARRAY['San Francisco, CA'],                   true, null,         'active'),
  ('Robbin Rimson',              ARRAY['Orlando, FL'],                         true, null,         'active'),
  ('Angie Menze',                ARRAY['Las Vegas, NV'],                       true, null,         'active'),
  ('Bianca Sanchez',             ARRAY[]::text[],                              true, null,         'active'),
  ('Bianca Brown Obranty',       ARRAY['Atlanta, GA'],                         true, null,         'active'),
  ('Yeabsira Habte',             ARRAY['Orlando, FL'],                         true, '2026-07-10', 'active'),
  ('Priscilla Ward',             ARRAY['Tampa, FL', 'St. Petersburg, FL'],     true, null,         'active'),
  ('Ailyn Salomon',              ARRAY['Orlando, FL'],                         true, null,         'active'),
  ('Tracey O''Donnell',          ARRAY['Orlando, FL'],                         true, null,         'active'),
  ('Aideliz Albelo',             ARRAY['Longwood, FL'],                        true, null,         'active'),
  ('Nicole Wilhite',             ARRAY['Miami, FL'],                           true, null,         'active'),
  ('Ashley Gailey',              ARRAY['Pinellas Park, FL'],                   true, null,         'active'),
  ('Elizabeth (Lizz) Dominguez', ARRAY['Miami, FL'],                           true, null,         'active'),
  ('Ana Castro',                 ARRAY['Fort Lauderdale, FL'],                 true, null,         'active'),
  ('Katie Haley',                ARRAY['Orlando, FL'],                         true, null,         'active'),
  ('Adriana Hill',               ARRAY['Davie, FL'],                           true, null,         'active'),
  ('Valance Isaacs',             ARRAY['Jacksonville, FL'],                    true, null,         'active'),
  ('Patricia Patterson-Gorski',  ARRAY['Jacksonville, FL'],                    true, '2026-07-17', 'active'),
  ('Karen Mueller',              ARRAY['Orlando, FL'],                         true, null,         'active'),
  ('Violeta Pena',               ARRAY['Sanford, FL'],                         true, null,         'active'),
  ('Laura Chmielewski',          ARRAY['Titusville, FL'],                      true, null,         'active');
