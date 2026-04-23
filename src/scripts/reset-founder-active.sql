-- MIRA — demo-prep: reset founder state to Active (clears vacation gating).
UPDATE public.founder_state
SET state = 'Active', until = NULL, updated_at = NOW()
WHERE user_id = '00000000-0000-0000-0000-000000000001';
