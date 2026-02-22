# Ada — Feature Specification
## Prioritized by MVP / v1.1 / v2.0

---

## Priority Legend
- 🔴 **P0 — MVP (Must Ship for DevSpace April 2026)**
- 🟡 **P1 — v1.1 (First App Store release)**
- 🟢 **P2 — v2.0 (Post-launch, pre-fundraise)**
- ⚪ **P3 — Future (post-seed)**

---

## 1. Share Extension

| Feature | Priority | Description | Acceptance Criteria |
|---------|----------|-------------|-------------------|
| Capture URLs | 🔴 P0 | Accept shared URLs from any app | URL string + page title captured, saved to App Group |
| Capture text | 🔴 P0 | Accept shared plain text | Text content saved to App Group |
| Capture images | 🔴 P0 | Accept shared images (screenshots, photos) | Image saved to shared container, ≤ 120MB memory |
| Quick category display | 🔴 P0 | Show detected category in extension UI | Category label appears within 2s of opening |
| Quick save + dismiss | 🔴 P0 | One-tap save and return to source app | Extension dismisses in < 3s total |
| Suggested action preview | 🟡 P1 | Show suggested action in extension UI | Action type + brief description shown |
| Edit category | 🟡 P1 | Let user change category before saving | Dropdown/picker with all categories |
| Add note | 🟡 P1 | Let user add a text note to shared item | Free-text field, saved alongside item |
| Capture files (PDF, docs) | 🟢 P2 | Accept shared documents | PDF/doc saved, text extracted |
| Offline queue | 🟢 P2 | Queue items when offline, sync when connected | Items saved locally, synced on reconnect |

---

## 2. Content Processing

| Feature | Priority | Description | Acceptance Criteria |
|---------|----------|-------------|-------------------|
| AI classification | 🔴 P0 | Classify content into categories via LLM | 85%+ accuracy on test set of 100 items |
| Structured data extraction | 🔴 P0 | Extract category-specific fields (date, company, price, etc.) | Correct fields extracted for events, jobs, restaurants |
| OCR (images/screenshots) | 🔴 P0 | Extract text from images using Apple Vision | 95%+ accuracy on English text screenshots |
| URL metadata fetch | 🔴 P0 | Fetch Open Graph tags, title, description from URLs | Title + description populated for 90%+ of URLs |
| Embedding generation | 🟡 P1 | Generate vector embedding for each item | 1536-dim embedding stored in pgvector |
| Content summarization | 🟡 P1 | Generate AI summary of articles/long content | 2-3 sentence summary for articles, key points extracted |
| Image content analysis | 🟢 P2 | Understand image content beyond OCR (objects, scenes) | Basic description of non-text image content |
| Multi-language OCR | 🟢 P2 | OCR in languages beyond English | Support top 5 languages (Spanish, Chinese, Hindi, French, Arabic) |
| Batch processing | ⚪ P3 | Process multiple items shared at once | Handle up to 5 images shared simultaneously |

---

## 3. Inbox

| Feature | Priority | Description | Acceptance Criteria |
|---------|----------|-------------|-------------------|
| Item cards with category | 🔴 P0 | Display processed items with category tag | Card shows: title, source, category, timestamp |
| Suggested action display | 🔴 P0 | Show Ada's suggested action on each card | Action type + description visible on card |
| Approve action | 🔴 P0 | One-tap approve suggested action | Action executes, item moves to completed |
| Dismiss action | 🔴 P0 | Dismiss suggestion, keep item in Library | Item archived from Inbox, saved in Library |
| Pull to refresh | 🔴 P0 | Refresh Inbox to check for newly processed items | New items appear after pull |
| Edit action before approving | 🟡 P1 | Modify suggested action details | Can edit date, text, etc. before executing |
| Snooze | 🟡 P1 | Snooze item to reappear later | Time picker, item returns at selected time |
| Batch actions | 🟢 P2 | Approve/dismiss multiple items at once | Multi-select mode, batch approve/dismiss |
| Smart priority ordering | 🟢 P2 | Order Inbox by urgency/relevance | Time-sensitive items (events, deadlines) surfaced first |

---

## 4. Library

| Feature | Priority | Description | Acceptance Criteria |
|---------|----------|-------------|-------------------|
| Category sections | 🔴 P0 | Group items by auto-detected category | Collapsible sections, item count per category |
| Item detail view | 🔴 P0 | Tap item to see full details | Shows: full content, extracted data, actions, notes |
| Basic text search | 🔴 P0 | Search items by title and content keywords | Results appear as user types, < 500ms |
| Star/favorite items | 🔴 P0 | Mark items as starred for quick access | Star toggle, starred filter |
| Delete items | 🔴 P0 | Delete items from library | Swipe to delete, confirmation dialog |
| Semantic search | 🟡 P1 | Search by meaning ("that restaurant my friend sent") | Vector similarity search via pgvector |
| Category filter | 🟡 P1 | Filter library by one or more categories | Multi-select category filter |
| Date range filter | 🟡 P1 | Filter by when items were saved | Date picker filter |
| Open source URL | 🔴 P0 | Tap to open original URL in Safari/app | Opens in SFSafariViewController or deep link |
| Sort options | 🟡 P1 | Sort by date, category, or relevance | Sort picker in toolbar |
| Custom categories | 🟢 P2 | Create user-defined categories | Category management in settings |
| Tags | 🟢 P2 | User-defined tags on items | Tag creation, tag-based filtering |
| Export | ⚪ P3 | Export library as CSV/JSON | Download file with all item data |

---

## 5. Actions (Ada Acts)

| Feature | Priority | Description | Acceptance Criteria |
|---------|----------|-------------|-------------------|
| Add to Calendar | 🔴 P0 | Create calendar event from detected event data | EKEvent created with title, date, time, location |
| Create Reminder | 🔴 P0 | Create reminder from detected task/deadline | EKReminder created with due date |
| Generate Summary | 🔴 P0 | AI summary of articles/long content | Summary displayed in item detail view |
| Draft Message | 🟡 P1 | Draft intro message for LinkedIn profiles/contacts | Message text generated, copy to clipboard |
| Draft Cover Letter | 🟡 P1 | Draft cover letter from job posting + user resume | Cover letter generated using user's resume context |
| Deep Link Booking | 🟡 P1 | Open restaurant booking app with pre-filled data | Opens Resy/OpenTable/Google Maps with restaurant info |
| Price Tracking | 🟢 P2 | Track product prices over time | Price history, alert when price drops |
| Auto-Apply Jobs | ⚪ P3 | Automatically apply to jobs | Fill application forms (complex, defer) |
| Smart Replies | ⚪ P3 | Draft email replies based on context | Integration with Mail app |

---

## 6. Tasks Tab

| Feature | Priority | Description | Acceptance Criteria |
|---------|----------|-------------|-------------------|
| Pending actions list | 🔴 P0 | Show actions awaiting execution | List with action type, source item, status |
| Completed actions list | 🔴 P0 | Show successfully completed actions | Historical log of what Ada did |
| Action status tracking | 🔴 P0 | Show status of each action (pending, executing, completed, failed) | Status badge on each action card |
| Retry failed actions | 🟡 P1 | Retry actions that failed | Retry button, error message shown |
| Scheduled actions | 🟢 P2 | Actions set for future execution | Calendar view of scheduled actions |

---

## 7. User Profile & Settings

| Feature | Priority | Description | Acceptance Criteria |
|---------|----------|-------------|-------------------|
| Sign in with Apple | 🔴 P0 | Authentication via SIWA | Full auth flow, JWT stored |
| Email sign in | 🟡 P1 | Email/password authentication | Supabase Auth email flow |
| Profile setup | 🔴 P0 | Name, email display | Profile screen with basic info |
| Resume upload | 🟡 P1 | Upload resume text for personalized drafts | Text field or file upload, stored in profile |
| Bio/context | 🟡 P1 | Add personal bio for intro message generation | Text field, stored in profile |
| Notification settings | 🟡 P1 | Configure when Ada notifies you | Toggle per notification type |
| Subscription management | 🟡 P1 | View plan, upgrade, manage billing | StoreKit 2 integration |
| Data export | 🟢 P2 | Export all user data | JSON download |
| Account deletion | 🟡 P1 | Delete account and all data | Confirmation flow, full deletion |
| Default calendar picker | 🟡 P1 | Choose which calendar Ada adds events to | Calendar picker from EventKit |

---

## 8. Onboarding

| Feature | Priority | Description | Acceptance Criteria |
|---------|----------|-------------|-------------------|
| Welcome screens | 🔴 P0 | 3-4 screen onboarding explaining Ada | Swipeable screens with illustrations |
| Enable share extension guide | 🔴 P0 | Step-by-step to add Ada to share sheet | Visual guide, deep link to Settings if possible |
| Calendar permission request | 🔴 P0 | Request EventKit access with context | Permission dialog with clear explanation |
| Notification permission request | 🟡 P1 | Request push notification access | Permission dialog |
| First share celebration | 🟡 P1 | Celebrate when user shares first item | Confetti/animation, encouraging message |
| Resume upload prompt | 🟡 P1 | Prompt to add resume during onboarding | Skip-able step, increases action quality |

---

## 9. Subscription & Monetization

| Feature | Priority | Description | Acceptance Criteria |
|---------|----------|-------------|-------------------|
| Free tier enforcement | 🟡 P1 | Limit to 5-10 items/day on free | Counter resets daily, upgrade prompt shown |
| StoreKit 2 integration | 🟡 P1 | In-app purchase for Pro subscription | Monthly ($9.99) and annual ($99) options |
| Paywall screen | 🟡 P1 | Show upgrade benefits when hitting free limit | Feature comparison, purchase buttons |
| Subscription status sync | 🟡 P1 | Sync subscription state with Supabase | Server-side verification via App Store receipts |
| Trial period | 🟢 P2 | 7-day free trial of Pro | Auto-converts or downgrades after trial |

---

## MVP Scope Summary (DevSpace April 2026)

### In MVP (🔴 P0):
1. Share extension that captures URLs, text, and images
2. AI classification into categories
3. OCR on images/screenshots
4. URL metadata fetching
5. Inbox with suggested actions (approve/dismiss)
6. Library with category sections, basic search, star, delete
7. Add to Calendar action
8. Create Reminder action
9. Generate Summary action
10. Tasks tab (pending + completed)
11. Sign in with Apple
12. Basic profile screen
13. Onboarding flow with share extension setup guide
14. Calendar permission handling

### NOT in MVP:
- Subscription/paywall (everyone gets full access during beta)
- Semantic search (basic text search is fine for MVP)
- Cover letter drafts (needs resume context, add in v1.1)
- Message drafts (add in v1.1)
- Deep link booking (add in v1.1)
- Offline queue
- Price tracking
- Custom categories/tags
- Email auth (SIWA only for MVP)

### MVP Success Criteria:
- Share extension works reliably from Safari, Instagram, LinkedIn, Camera Roll, Messages
- Classification accuracy ≥ 85% on test set
- Calendar events created correctly from shared event content
- Share extension stays under 80MB memory (safety margin from 120MB limit)
- End-to-end flow (share → classify → suggest → approve → execute) takes < 10 seconds
- 50 TestFlight testers actively using the app before DevSpace