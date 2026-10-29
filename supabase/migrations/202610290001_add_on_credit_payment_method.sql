-- Execute this migration separately and let it commit before running the next one.
-- PostgreSQL does not allow a newly added enum label to be used before commit.
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'on_credit';
