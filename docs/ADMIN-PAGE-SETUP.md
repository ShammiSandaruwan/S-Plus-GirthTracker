# Admin Page Setup Guide

This guide explains how to set up the hidden admin dashboard and configure Google Authenticator for TOTP-based security.

## 1. Generate a Base32 Secret

You need a valid Base32 secret for TOTP. You can generate one using an online tool or script.
*Example format:* `JBSWY3DPEHPK3PXP` (Do **not** use this exact string, generate your own).

## 2. Add to Google Authenticator

Add the secret manually to your Google Authenticator app:
- **Account Name:** GirthTracker Admin (or similar)
- **Key:** *Your generated Base32 secret*
- **Time based:** Yes

## 3. Configure Google Apps Script

Add the same Base32 secret to your Google Apps Script Properties so the backend can verify the codes.

1. Open your Apps Script project.
2. Go to **Project Settings** (gear icon).
3. Under **Script Properties**, click **Add script property**.
4. Set **Property:** `ADMIN_TOTP_SECRET`
5. Set **Value:** *Your generated Base32 secret*
6. *(Optional)* Add `ADMIN_SESSION_SECRET` with a strong random string for signing session tokens.
7. Save script properties.

## 4. Accessing the Admin Page

The admin page is intentionally hidden from the normal application UI. You must access it via a direct URL.

**Admin URL:**
`https://your-app-domain.com/mod`

## 5. Security Warning

The hidden route `/mod` provides no security by itself - it is simply a convenient, unlinked path. The actual security relies entirely on the TOTP backend verification. Without the 6-digit code from Google Authenticator, no access or data is granted. Keep your `ADMIN_TOTP_SECRET` secure and **never** commit it to version control or add it to frontend environment variables.
