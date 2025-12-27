# OAuth Deep Link Setup - Complete ✅

## What's Been Implemented

### ✅ Desktop App (`babushkaml-app`)
1. **Deep Link Plugin** - Added `tauri-plugin-deep-link` for `babushkaml://` URL scheme
2. **OAuth Integration** - Updated `AuthContext.tsx` to:
   - Open OAuth in browser with proper redirect URL
   - Listen for deep link callbacks
   - Parse tokens from deep link URL
   - Set Supabase session automatically
3. **Rust Backend** - Added deep link event handler in `lib.rs`
4. **Configuration** - URL scheme registered in `tauri.conf.json`

### ✅ Landing Page (`babushkaml`)
1. **Callback Handler** - Updated `/auth/callback` to:
   - Detect desktop app redirects (`redirect_to=babushkaml://auth`)
   - Extract tokens from OAuth response
   - Redirect back to app via deep link with tokens

## How It Works

```
1. User clicks "Continue with Google/GitHub" in desktop app
   ↓
2. App opens browser with Supabase OAuth URL
   redirectTo: https://babushkaml.com/auth/callback?redirect_to=babushkaml://auth
   ↓
3. User authenticates with OAuth provider
   ↓
4. OAuth provider redirects to: https://babushkaml.com/auth/callback?redirect_to=babushkaml://auth#access_token=xxx&refresh_token=xxx
   ↓
5. Landing page callback extracts tokens and redirects to: babushkaml://auth#access_token=xxx&refresh_token=xxx
   ↓
6. macOS opens the deep link → Desktop app receives it
   ↓
7. App parses tokens and sets Supabase session
   ↓
8. User is logged in! 🎉
```

## Configuration Required

### 1. Supabase Dashboard Configuration

Go to: **Supabase Dashboard → Authentication → URL Configuration**

Add to **Redirect URLs**:
```
https://babushkaml.com/auth/callback
```

### 2. Environment Variables

**Desktop App** (`.env` file in `babushkaml-app/`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://babushkaml.com
```

**Landing Page** (`.env.local` in `babushkaml/`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Deploy Landing Page

Deploy the updated `/auth/callback` page to production:
```bash
cd /Users/dsuke/Projects/dev/babushkaml
# Deploy to your hosting (Vercel, etc.)
```

## Testing

### Test Deep Link Registration
```bash
# Open the app
open /Users/dsuke/Projects/dev/babushkaml-app/src-tauri/target/release/bundle/macos/BabushkaML.app

# Test deep link (should open the app)
open "babushkaml://auth#access_token=test&refresh_token=test"
```

### Test Full OAuth Flow
1. Open the desktop app
2. Click "Continue with Google" or "Continue with GitHub"
3. Complete OAuth in browser
4. App should automatically receive tokens and log you in

## Troubleshooting

### Deep link doesn't work
- Check macOS Console.app for errors
- Verify URL scheme in Info.plist: `plutil -p BabushkaML.app/Contents/Info.plist | grep -A 5 CFBundleURL`

### Tokens not received
- Check browser console on landing page for errors
- Verify Supabase redirect URL is configured
- Check network tab for OAuth callback

### App doesn't open from deep link
- First launch: Right-click app → Open (macOS security)
- Check if URL scheme is registered: `defaults read com.babushkaml.app CFBundleURLTypes`

## Files Modified

### Desktop App
- `src-tauri/Cargo.toml` - Added deep-link plugin
- `src-tauri/tauri.conf.json` - Configured URL scheme
- `src-tauri/src/lib.rs` - Added deep link handler
- `src/contexts/AuthContext.tsx` - OAuth + callback handling
- `package.json` - Added @tauri-apps/plugin-deep-link

### Landing Page
- `src/app/auth/callback/page.tsx` - Desktop redirect support

## Status: ✅ Ready for Testing

All code is implemented and the app is built. Just need to:
1. Configure Supabase redirect URLs
2. Set environment variables
3. Deploy landing page changes
4. Test the flow!

