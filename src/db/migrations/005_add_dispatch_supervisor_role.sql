-- Update company_users_role_check constraint to include dispatch_supervisor
ALTER TABLE company_users 
  DROP CONSTRAINT IF EXISTS company_users_role_check;

ALTER TABLE company_users
  ADD CONSTRAINT company_users_role_check 
  CHECK (role = ANY (ARRAY['boss'::text, 'manager'::text, 'rep'::text, 'back_office'::text, 'dispatch_supervisor'::text]));
