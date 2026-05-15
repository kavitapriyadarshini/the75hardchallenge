# Supabase auth with real email addresses

The app signs users up and in with their real email (`signUp` / `signInWithPassword`).

## Confirm email (optional)

In the Supabase dashboard: **Authentication → Providers → Email** (or **Auth → Email** depending on UI version), find **Confirm email**.

- **OFF (recommended for now):** Users can sign in immediately after sign-up with no inbox step. Matches the current app expectation.
- **ON:** Users must click the verification link before `signInWithPassword` succeeds (unless you add a “resend” / “pending verification” flow in the app).

Turn **Confirm email** **ON** only if you want strict email verification.
