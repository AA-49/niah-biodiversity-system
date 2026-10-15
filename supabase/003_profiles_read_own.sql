-- Item 15: let a signed in user read their own row in public.profiles.
-- 001_initial_schema.sql turns on Row Level Security for profiles but has no
-- policy for it, so the web dashboard can't read the user's role and always
-- shows "No access". This only allows reading your own row. Nobody can read
-- other people's profiles, and nobody can change a role from the website.

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
