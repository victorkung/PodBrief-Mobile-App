# PodBrief Mobile App Design Guidelines

## Brand Identity

**Purpose**: PodBrief helps busy professionals consume podcast content efficiently through dual modes: full episode listening or AI-generated summaries.

**Aesthetic Direction**: **Premium Editorial** - Sophisticated, focused, and content-first. The app should feel like a high-end magazine for audio: crisp typography, generous whitespace, and deliberate use of gold accents to signal value and curation. The black background creates an immersive, distraction-free listening environment.

**Memorable Element**: The **Gold Progress Ring** - Every piece of audio content uses a circular progress indicator with a gold stroke, creating a consistent visual language that signals "this is valuable content being consumed."

## Navigation Architecture

**Root Navigation**: Tab Bar (5 tabs)

**Tabs**:
1. **Discover** (Search icon) - Podcast search and discovery
2. **Shows** (Grid icon) - Followed podcasts and new episodes feed
3. **Library** (Bookmark icon) - Saved episodes and AI briefs
4. **Downloads** (Download icon) - Offline content management
5. **Profile** (User icon) - Account settings and subscription

**Floating Element**: Persistent audio player mini-bar above tab bar when content is playing

## Screen-by-Screen Specifications

### 1. Discover Screen
**Purpose**: Search and explore podcasts
**Layout**:
- Header: Transparent, large search bar with gold focus state
- Root view: Scrollable
- Safe area: top = headerHeight + Spacing.xl
- Components: Search input, result cards (podcast artwork, title, author, episode count)

### 2. Shows Screen  
**Purpose**: Manage followed podcasts, view new episodes
**Layout**:
- Header: Transparent with "Shows" title
- Root view: Scrollable with two sections
- Sections: "My Shows" (horizontal scroll grid), "New Episodes" (vertical list)
- Safe area: top = headerHeight + Spacing.xl
- Empty state: "No Shows Yet" illustration

### 3. Library Screen
**Purpose**: Access saved content
**Layout**:
- Header: Transparent with segmented control (Episodes/Summaries tabs)
- Root view: List (FlatList)
- Safe area: top = headerHeight + Spacing.xl, bottom = tabBarHeight + playerHeight + Spacing.xl
- Components: Episode/Brief cards with download indicators, progress rings
- Empty state: Per-tab illustrations

### 4. Downloads Screen
**Purpose**: Manage offline content
**Layout**:
- Header: Default with storage usage indicator (e.g., "2.3 GB used")
- Root view: Scrollable list
- Safe area: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl
- Components: Downloadable item cards with progress bars, delete buttons
- Empty state: "No Downloads" illustration

### 5. Profile Screen
**Purpose**: Account management and settings
**Layout**:
- Header: Transparent
- Root view: Scrollable form
- Safe area: top = headerHeight + Spacing.xl
- Components: Avatar, display name, credits badge, plan card, settings sections
- Sections: Account (language, logout), Subscription (status, upgrade CTA), Downloads (WiFi-only toggle, auto-delete)

### 6. Episode Detail Screen (Modal)
**Purpose**: View episode details, generate brief or save episode
**Layout**:
- Header: Transparent with close button (left)
- Root view: Scrollable
- Safe area: top = headerHeight + Spacing.xl
- Components: Large artwork, title, podcast name, description, action buttons (Save Episode / Generate Brief)

### 7. Brief Detail Screen (Modal)
**Purpose**: Read/listen to AI-generated summary
**Layout**:
- Header: Transparent with close button (left), share button (right)
- Root view: Scrollable
- Components: Artwork, playback controls, tabbed content (Summary/Condensed Transcript/Full Transcript)
- Safe area: top = headerHeight + Spacing.xl

### 8. Now Playing Screen (Modal)
**Purpose**: Full-screen audio controls
**Layout**:
- Header: None
- Root view: Non-scrollable
- Safe area: top = insets.top + Spacing.xl, bottom = insets.bottom + Spacing.xl
- Components: Large artwork (center), progress slider with timestamps, playback controls (skip -15s, play/pause, skip +15s), speed selector, volume slider
- Gesture: Swipe down to dismiss

### 9. Auth Screens (Stack)
**Purpose**: Sign in/sign up flow
**Layout**: Centered forms on each screen
- Welcome screen: Logo, "Start Listening Free" CTA, "Already have an account?" link
- Sign Up: Email, password, first name fields, Google OAuth button
- Sign In: Email, password fields, Google OAuth button

## Color Palette

**Primary**:
- Gold: `#F59E0B` (accents, CTAs, active states)

**Backgrounds**:
- App Background: `#000000` (pure black)
- Card Surface: `#1A1A1A` (slightly elevated)
- Input Background: `#2A2A2A`

**Text**:
- Primary Text: `#FFFFFF`
- Secondary Text: `#9CA3AF` (60% opacity white)
- Tertiary Text: `#6B7280` (40% opacity white)

**Semantic**:
- Success: `#10B981` (download complete, brief ready)
- Warning: `#F59E0B` (low credits)
- Error: `#EF4444` (generation failed)

## Typography

**Font**: System (San Francisco on iOS, Roboto on Android)

**Type Scale**:
- Heading 1: Bold, 28pt (screen titles)
- Heading 2: Bold, 22pt (section headers)
- Heading 3: Semibold, 18pt (card titles)
- Body: Regular, 16pt
- Caption: Regular, 14pt (metadata, timestamps)
- Small: Regular, 12pt (labels)

## Visual Design

**Icons**: Feather icons from @expo/vector-icons, gold color for active states

**Shadows**: Minimal use - only for floating audio player:
- shadowOffset: {width: 0, height: -2}
- shadowOpacity: 0.10
- shadowRadius: 4

**Touchable Feedback**: 
- Cards: Scale down to 0.98 on press
- Buttons: Opacity 0.7 on press
- Gold buttons: Slight brightness increase on press

**Progress Indicators**:
- Circular: 4pt stroke, gold color, on episode/brief cards
- Linear: 2pt height, gold fill, on download items
- Player: Full-width thin bar above mini player

## Assets to Generate

**icon.png** - App icon featuring a gold circular waveform on black background - Used on device home screen

**splash-icon.png** - Same as icon.png but larger - Used during app launch

**empty-discover.png** - Illustration of a magnifying glass with sound waves - Used on Discover screen when no search performed

**empty-shows.png** - Illustration of podcast microphone with "+" symbol - Used on Shows screen when user hasn't followed any shows

**empty-episodes.png** - Illustration of headphones with bookmark - Used on Library > Episodes tab when empty

**empty-summaries.png** - Illustration of document with sparkle icon - Used on Library > Summaries tab when empty

**empty-downloads.png** - Illustration of download arrow with cloud - Used on Downloads screen when no offline content

**default-avatar.png** - Minimal user silhouette on dark gray circle - Used in Profile screen

**podcast-placeholder.png** - Generic podcast artwork (microphone icon on gradient) - Used when artwork fails to load

All illustrations should use the gold (#F59E0B) as the primary color with subtle gray accents, simple line art style, maximum 2-3 visual elements per illustration.