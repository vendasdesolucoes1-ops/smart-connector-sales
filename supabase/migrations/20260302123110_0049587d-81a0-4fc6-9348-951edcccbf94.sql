
-- Add business model fields to company_profiles
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS business_models text[] NOT NULL DEFAULT '{}'::text[],
  -- B2B fields
  ADD COLUMN IF NOT EXISTS b2b_target_audience text DEFAULT '',
  ADD COLUMN IF NOT EXISTS b2b_products_services jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS b2b_differentials text DEFAULT '',
  ADD COLUMN IF NOT EXISTS b2b_objections_faq jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS b2b_sales_process text DEFAULT '',
  ADD COLUMN IF NOT EXISTS b2b_avg_ticket text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS b2b_tone_of_voice text DEFAULT '',
  -- B2C fields
  ADD COLUMN IF NOT EXISTS b2c_target_audience text DEFAULT '',
  ADD COLUMN IF NOT EXISTS b2c_products_services jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS b2c_differentials text DEFAULT '',
  ADD COLUMN IF NOT EXISTS b2c_objections_faq jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS b2c_sales_process text DEFAULT '',
  ADD COLUMN IF NOT EXISTS b2c_avg_ticket text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS b2c_tone_of_voice text DEFAULT '';
