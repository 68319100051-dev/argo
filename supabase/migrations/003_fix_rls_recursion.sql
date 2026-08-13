-- Fix infinite RLS recursion caused by has_role() querying users table
-- while users table RLS policy calls has_role()
-- ALTER FUNCTION to SECURITY DEFINER + restrict search_path to break the cycle

alter function public.current_user_role() security definer set search_path = 'public';
alter function public.has_role(text) security definer set search_path = 'public';
