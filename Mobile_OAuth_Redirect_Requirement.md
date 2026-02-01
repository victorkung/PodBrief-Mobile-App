# Mobile OAuth Redirect Requirement for PodBrief

## Overview

The PodBrief mobile app (Expo/React Native) uses browser-based Google OAuth via Supabase. After the user authenticates with Google, Supabase redirects to `https://podbrief.io`. The web app needs to detect mobile OAuth callbacks and redirect back to the mobile app using a deep link.

## Current Issue

The mobile app opens a browser for Google sign-in, but after authentication, the user ends up on the podbrief.io website instead of being returned to the mobile app.

## Required Fix

The web app at `podbrief.io` needs to detect when it receives an OAuth callback from a mobile device and redirect back to the app.

### Detection Logic

Add this script to run early on page load (before React hydrates) or in your auth callback handler:

```javascript
// Mobile OAuth Redirect Handler
(function() {
  // Check if this is a mobile OAuth callback
  const isMobileCallback = window.location.search.includes('mobile=1');
  const hasTokens = window.location.hash.includes('access_token');
  
  if (isMobileCallback && hasTokens) {
    // Redirect back to the mobile app with the tokens
    const deepLinkUrl = 'podbrief://auth/callback' + window.location.hash;
    console.log('Mobile OAuth detected, redirecting to:', deepLinkUrl);
    window.location.href = deepLinkUrl;
    return; // Prevent further page execution
  }
})();
```

### Placement

This script should run as early as possible:
- In the `<head>` of `index.html`, OR
- At the very start of your app's initialization, BEFORE React renders

This ensures the redirect happens immediately before the web app fully loads.

## Expected OAuth Flow

1. **User taps "Continue with Google"** in mobile app
2. **In-app browser opens** to Supabase OAuth URL → Google sign-in
3. **User authenticates** with Google
4. **Supabase redirects** to: `https://podbrief.io?mobile=1#access_token=xyz&refresh_token=abc&...`
5. **Web app detects `mobile=1`** and immediately redirects to: `podbrief://auth/callback#access_token=xyz&refresh_token=abc&...`
6. **iOS/Android intercepts** the `podbrief://` deep link
7. **Mobile app receives tokens** and sets the Supabase session

## URL Structure

### Incoming URL (from Supabase)
```
https://podbrief.io?mobile=1#access_token=eyJ...&refresh_token=abc123&token_type=bearer&expires_in=3600
```

### Outgoing Deep Link (to mobile app)
```
podbrief://auth/callback#access_token=eyJ...&refresh_token=abc123&token_type=bearer&expires_in=3600
```

Note: The hash fragment (`#access_token=...`) must be preserved exactly as-is.

## Mobile App Configuration

The mobile app is already configured with:
- URL scheme: `podbrief`
- Expected callback path: `auth/callback`
- Configured in `app.json`:
  ```json
  {
    "expo": {
      "scheme": "podbrief"
    }
  }
  ```

## Testing

After implementing the fix:
1. Open PodBrief in Expo Go on iOS or Android
2. Tap "Continue with Google"
3. Sign in with your Google account
4. You should be automatically returned to the mobile app and logged in

If testing on iOS, you can verify the redirect is happening by checking Safari's developer console (if connected to Mac).

## Debugging

If the redirect isn't working, verify:
1. The script runs before React hydrates
2. `window.location.search` contains `mobile=1`
3. `window.location.hash` contains `access_token`
4. The `podbrief://` scheme is correctly formed

Add console logs to debug:
```javascript
console.log('URL search:', window.location.search);
console.log('URL hash:', window.location.hash);
console.log('Is mobile callback:', window.location.search.includes('mobile=1'));
console.log('Has tokens:', window.location.hash.includes('access_token'));
```
