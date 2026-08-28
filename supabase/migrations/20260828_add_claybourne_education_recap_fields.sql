-- Adds recap fields for educational/promo cannabis activations (e.g. Claybourne Co.),
-- which don't sample product and instead drive engagement via an in-store QR code.
-- consumers_sampled already doubles as "QR code scans" for this client (dashboard-side
-- relabel only); these are the concepts with no existing column to reuse.
alter table public.recaps
  add column if not exists qr_code_destination text,
  add column if not exists education_topics_covered text,
  add column if not exists top_patient_concerns text,
  add column if not exists compliance_issue_occurred text,
  add column if not exists compliance_issue_details text,
  add column if not exists loyalty_signups integer;

comment on column public.recaps.qr_code_destination is 'What the in-store QR code linked to (loyalty signup, education page, discount code, menu, etc).';
comment on column public.recaps.education_topics_covered is 'Subjects covered during the educational activation (dosing, consumption method, strain/terpene education, medical vs recreational use, etc).';
comment on column public.recaps.top_patient_concerns is 'Recurring patient/customer concerns or reasons for interest raised during the activation (pain, sleep, anxiety, etc).';
comment on column public.recaps.compliance_issue_occurred is 'Whether a cannabis marketing/compliance issue occurred (distinct from general operational issues_occurred) - Yes/No.';
comment on column public.recaps.compliance_issue_details is 'Details of any compliance issue flagged via compliance_issue_occurred.';
comment on column public.recaps.loyalty_signups is 'Count of loyalty/rewards program signups captured through the QR code flow.';
