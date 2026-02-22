# Ada — Product Specification
## Version 1.0 | February 2026

---

## 1. Product Overview

### 1.1 Vision
Ada is the intelligence layer between seeing something useful and doing something about it. It transforms the iOS share button — the most universal action on smartphones — from a passive filing system into an AI executive assistant that understands content, detects intent, and takes action.

### 1.2 Problem Statement
People save 20+ pieces of content per week (links, screenshots, posts, articles) and act on fewer than 5% of them. Every save-for-later app (Pocket, Heyday, Omnivore, Evernote) has failed or stagnated because they assume the user will return to organize and act. They won't.

Meanwhile, AI agents (ChatGPT, Manus, OpenClaw) can execute tasks but require users to open a separate app, describe their intent in words, and prompt-engineer the output. This creates a friction barrier that excludes non-technical users — the vast majority of the market.

### 1.3 Solution
Ada lives in the iOS share sheet. When a user shares any content:
1. **Share** — One tap from any app (Safari, Instagram, LinkedIn, camera roll, etc.)
2. **Detect** — AI classifies content type and infers user intent
3. **Act** — Ada suggests the right action (add to calendar, draft message, book restaurant, etc.)
4. **Done** — User approves with one tap. Ada executes.

### 1.4 Key Differentiator
**Context-first, not chat-first.** The content IS the prompt. Ada doesn't need the user to describe what they want. It infers from what they shared.

---

## 2. Target Users

### 2.1 Primary Persona: "The Busy Professional"
- **Demographics:** 25-40, iPhone user, $75K+ income
- **Behavior:** Constantly sharing/saving content across apps, rarely follows through
- **Pain:** Digital clutter, missed events, forgotten tasks, information overload
- **Willingness to pay:** $10/month for something that actually works

### 2.2 Secondary Persona: "The College Power User"
- **Demographics:** 18-24, iPhone user, heavy app usage
- **Behavior:** Saves job postings, event flyers, restaurant recs, lecture screenshots
- **Pain:** Disorganized job search, missed deadlines, forgotten recommendations
- **Willingness to pay:** $5-10/month, especially during job search

### 2.3 Tertiary Persona: "The Non-Technical Parent"
- **Demographics:** 30-50, iPhone user, manages family logistics
- **Behavior:** Saves recipes, school events, activity schedules, product links
- **Pain:** Can't keep track of everything, doesn't know how to use AI tools
- **Willingness to pay:** $10/month for something that "just works"

---

## 3. App Structure

### 3.1 Tab Bar (4 Tabs)

#### Tab 1: Inbox
**Purpose:** New items that Ada has processed with suggested actions.

**Content:**
- Cards showing shared content with Ada's suggested action(s)
- Each card shows: content preview, detected category, suggested action(s), timestamp
- Actions: Approve, Edit, Dismiss, Snooze
- Once handled → item moves to Library and/or Tasks

**Empty state:** "Share something from any app to get started. Ada will appear here with suggestions."

**Sort:** Most recent first, with high-priority actions pinned

#### Tab 2: Library
**Purpose:** Everything saved, auto-organized.

**Content:**
- Category sections (collapsible): Articles, Events, Jobs, Products, Food, Travel, People, Tasks, Media, Documents
- Each item: title, source app icon, date saved, brief summary, category tag
- Search bar (semantic search — "that restaurant my friend sent me")
- Filters: Category, Date, Source App, Has Action, Starred

**Empty state:** "Your library is empty. Share content from any app and Ada will organize it here."

#### Tab 3: Tasks
**Purpose:** Pending and completed actions.

**Sections:**
- **Pending** — Actions Ada suggested that are awaiting execution or approval
- **Scheduled** — Actions set for a future time (e.g., "remind me Friday")
- **Completed** — Successfully executed actions (calendar events added, messages drafted, etc.)

**Each task card shows:** Action type, source content, status, timestamp

#### Tab 4: Settings
**Purpose:** User preferences, profile, and configuration.

**Content:**
- **Profile** — Name, email, resume/bio (used for personalized drafts)
- **Preferences** — Default categories, notification settings, action preferences
- **Integrations** — Calendar accounts, connected services
- **Subscription** — Plan management, usage stats
- **Privacy** — Data management, export, delete
- **About** — Version, support, feedback

---

## 4. Share Extension

### 4.1 Supported Content Types (NSExtensionActivationRule)
```xml
NSExtensionActivationSupportsWebURLWithMaxCount: 1
NSExtensionActivationSupportsWebPageWithMaxCount: 1
NSExtensionActivationSupportsText: true
NSExtensionActivationSupportsImageWithMaxCount: 5
NSExtensionActivationSupportsFileWithMaxCount: 3
```

### 4.2 Share Extension UX Flow
1. User taps Share → selects Ada from share sheet
2. Ada's share extension opens (compact modal)
3. Shows: Content preview + loading indicator ("Ada is thinking...")
4. Within 1-2 seconds: Shows detected category + suggested action
5. User can:
   - **Quick Save** — Save with Ada's suggestion, dismiss (default)
   - **Edit** — Change category, modify action, add note
   - **Just Save** — Save without any action
6. Extension dismisses, returns user to source app
7. Main app processes in background, notification when action is ready

### 4.3 Share Extension UI (SwiftUI)
```
┌─────────────────────────────────────┐
│  Ada                         Done ✓ │
├─────────────────────────────────────┤
│                                     │
│  [Content Preview — URL/image/text] │
│                                     │
│  📂 Category: Events & Plans        │
│                                     │
│  ✨ Suggested: Add to Calendar      │
│     Mar 15, 7pm — SF Tech Meetup    │
│                                     │
│  ┌─────────────┐ ┌───────────────┐  │
│  │ ✓ Save+Act  │ │ 📁 Just Save  │  │
│  └─────────────┘ └───────────────┘  │
│                                     │
│  + Add a note...                    │
└─────────────────────────────────────┘
```

### 4.4 Memory Budget (120MB Hard Limit)
| Component | Memory | Notes |
|-----------|--------|-------|
| Hermes runtime | 35-50MB | React Native baseline with Hermes |
| Share extension UI | 5-10MB | Minimal React Native view |
| InsForge SDK network call | 2-5MB | Save to database |
| **Total estimated** | **42-65MB** | **55-78MB headroom** |

Share extension is thin: capture content → save to InsForge → dismiss. All heavy processing (classification, OCR, summarization) happens server-side in InsForge edge functions calling Gemini.

---

## 5. Content Processing Pipeline

### 5.1 Stage 1: Capture (Share Extension — <3 seconds)
1. Receive content from NSExtensionContext
2. Determine content type (URL, text, image, file)
3. If URL: extract URL string, page title (from metadata)
4. If image: save to App Group shared container
5. If text: save raw text to App Group
6. Make lightweight API call for quick classification (optional — can defer to main app)
7. Save to shared UserDefaults with status "pending"
8. Post Darwin notification to wake main app
9. Dismiss extension

### 5.2 Stage 2: Classification (Main App / Background)
1. Receive notification of new content
2. If URL: fetch page content (title, description, Open Graph tags, body text)
3. If image: run OCR via Vision framework (VNRecognizeTextRequest)
4. Send extracted text to classification LLM:
   ```
   System: You are a content classifier. Classify the following content into exactly one category and extract any actionable information.
   
   Categories: article, event, job, product, restaurant, travel, person, task, media, document
   
   For each category, extract relevant structured data:
   - event: {title, date, time, location, description}
   - job: {company, role, deadline, requirements, url}
   - restaurant: {name, cuisine, location, hours, price_range}
   - person: {name, title, company, connection_context}
   - task: {description, deadline, priority}
   - article: {title, author, publication, topic, reading_time}
   - product: {name, price, store, category}
   - travel: {destination, dates, activity_type, recommendations}
   
   Respond in JSON only.
   ```
5. Parse classification response
6. Generate suggested action based on category
7. Store processed item in Supabase
8. Generate embedding for semantic search
9. Update UI (Inbox tab)

### 5.3 Stage 3: Action Execution (User-Triggered)
1. User reviews suggested action in Inbox
2. User approves (or edits) action
3. Ada executes:
   - **Calendar:** Create EKEvent via EventKit
   - **Reminder:** Create EKReminder via EventKit
   - **Message draft:** Generate via LLM, copy to clipboard or open compose sheet
   - **Booking:** Deep link to Resy/OpenTable/etc. with pre-filled data
   - **Summary:** Generate and display via LLM
4. Mark action as completed
5. Move item to Library + Tasks (completed)

---

## 6. Data Model

### 6.1 SharedItem (Core Entity)
```
SharedItem:
  id: UUID
  user_id: UUID (FK → auth.users)
  created_at: timestamp
  updated_at: timestamp
  
  # Content
  content_type: enum (url, text, image, file)
  raw_content: text (URL string, raw text, or file path)
  title: text (nullable)
  description: text (nullable)
  source_app: text (nullable — e.g., "com.apple.mobilesafari")
  thumbnail_url: text (nullable)
  
  # Classification
  category: enum (article, event, job, product, restaurant, travel, person, task, media, document, uncategorized)
  extracted_data: jsonb (structured data per category)
  confidence: float (classification confidence 0-1)
  
  # Processing
  status: enum (pending, classified, action_suggested, action_completed, archived)
  ocr_text: text (nullable — extracted OCR text from images)
  summary: text (nullable)
  
  # Search
  embedding: vector(1536) (for semantic search via pgvector)
  
  # User interaction
  is_starred: boolean (default false)
  user_note: text (nullable)
  user_category_override: text (nullable — if user changed category)
```

### 6.2 Action (Suggested/Executed Actions)
```
Action:
  id: UUID
  item_id: UUID (FK → SharedItem)
  user_id: UUID (FK → auth.users)
  created_at: timestamp
  executed_at: timestamp (nullable)
  
  action_type: enum (add_calendar, create_reminder, draft_message, draft_cover_letter, generate_summary, deep_link_booking, extract_contact, track_price)
  status: enum (suggested, approved, executing, completed, failed, dismissed)
  
  # Action-specific data
  action_data: jsonb
  # Examples:
  # Calendar: {title, start_date, end_date, location, notes, calendar_id}
  # Message: {recipient_context, draft_text, platform}
  # Booking: {restaurant_name, deep_link_url, party_size, preferred_time}
  # Summary: {summary_text, key_points}
  
  result: jsonb (nullable — execution result/confirmation)
  error: text (nullable)
```

### 6.3 UserProfile
```
UserProfile:
  id: UUID (same as auth.users.id)
  created_at: timestamp
  updated_at: timestamp
  
  display_name: text
  email: text
  
  # Context for personalized actions
  resume_text: text (nullable — for cover letter generation)
  bio: text (nullable — for intro message generation)
  interests: text[] (nullable)
  default_calendar_id: text (nullable)
  
  # Preferences
  preferred_categories: text[] (nullable — categories user cares most about)
  auto_actions: jsonb (nullable — which actions to auto-execute vs. suggest)
  notification_preferences: jsonb
  
  # Subscription
  subscription_tier: enum (free, pro)
  subscription_expires_at: timestamp (nullable)
```

---

## 7. API Design (Supabase Edge Functions)

### 7.1 POST /functions/v1/classify
**Input:** `{ content_type, raw_content, ocr_text?, metadata? }`
**Output:** `{ category, confidence, extracted_data, suggested_actions[] }`
**Cost:** ~$0.0002 per call (GPT-4o-mini)

### 7.2 POST /functions/v1/summarize
**Input:** `{ content_text, max_length? }`
**Output:** `{ summary, key_points[] }`
**Cost:** ~$0.003-0.01 per call

### 7.3 POST /functions/v1/draft-message
**Input:** `{ person_context, user_profile, message_type, tone? }`
**Output:** `{ draft_text, alternative_drafts[]? }`
**Cost:** ~$0.005-0.02 per call

### 7.4 POST /functions/v1/draft-cover-letter
**Input:** `{ job_data, user_resume, tone?, focus_areas? }`
**Output:** `{ cover_letter_text }`
**Cost:** ~$0.01-0.03 per call

### 7.5 POST /functions/v1/embed
**Input:** `{ text }`
**Output:** `{ embedding: float[1536] }`
**Cost:** ~$0.00002 per call

### 7.6 POST /functions/v1/search
**Input:** `{ query, user_id, limit?, category_filter? }`
**Output:** `{ results[]: { item, similarity_score } }`

---

## 8. Subscription Model

### 8.1 Free Tier
- 5 AI-processed items per day
- Basic categories (auto-classification)
- Manual actions only (no Ada suggestions)
- 30-day content retention
- No semantic search

### 8.2 Pro Tier — $9.99/month or $99/year
- Unlimited AI-processed items
- Full Ada Actions (suggestions + execution)
- Semantic search across all content
- Unlimited content retention
- Priority processing
- Custom categories
- Resume/bio context for personalized drafts
- Export data

### 8.3 Revenue Logic
- Apple takes 30% year 1, 15% year 2+ (App Store Small Business Program if <$1M revenue)
- Push annual plans (59% of subscribers prefer annual with discount)
- Free tier must demonstrate enough value to convert — 5 items/day should create "I want more" moments

---

## 9. Privacy & Security

### 9.1 On-Device Processing
- OCR runs entirely on-device via Apple Vision — images never leave the phone for text extraction
- Content thumbnails generated on-device
- Basic content type detection on-device

### 9.2 Cloud Processing
- Only content the user explicitly shares goes to the server
- LLM classification sends extracted text, NOT raw images
- All data encrypted in transit (TLS) and at rest (Supabase encryption)
- Row Level Security (RLS) on all Supabase tables — users can only access their own data
- No data shared with third parties
- No training on user data

### 9.3 Data Deletion
- User can delete any item at any time
- Account deletion removes all data within 30 days
- Embeddings deleted alongside source content

---

## 10. Success Metrics

### 10.1 North Star Metric
**Weekly Active Shares (WAS):** Number of items shared to Ada per week per active user. Target: 10+ WAS for retained users.

### 10.2 Key Metrics
| Metric | Target (Month 1) | Target (Month 6) |
|--------|------------------|-------------------|
| D1 Retention | 40-50% | 50-60% |
| D7 Retention | 25-35% | 35-45% |
| D30 Retention | 15-25% | 25-35% |
| DAU/MAU | 20-25% | 25-35% |
| Free → Pro conversion | 2-3% | 5-8% |
| Action approval rate | 50%+ | 70%+ |
| Avg items shared/day (active user) | 2-3 | 5-8 |

### 10.3 Quality Metrics
| Metric | Target |
|--------|--------|
| Classification accuracy | 85%+ |
| Action relevance (user approves suggested action) | 60%+ |
| Share extension load time | < 1.5s |
| Classification latency | < 3s |
| OCR processing time | < 500ms |