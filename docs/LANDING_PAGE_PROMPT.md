# Build a Landing Page / Waitlist Website for tryada.app

You are building a single-page marketing website for **Ada**, an iOS app. The site lives at **tryada.app** and its sole goal is to collect waitlist signups (email addresses). Build it as a complete, production-ready page using HTML, CSS (Tailwind CDN or inline styles), and vanilla JS — no framework required. Mobile-first, responsive, fast.

---

## Brand Identity

- **Product Name:** Ada
- **Tagline:** "Share anything. It's handled."
- **Positioning:** Ada is the intelligence layer between seeing something useful and doing something about it. It transforms the iOS share button into an AI executive assistant that understands content, detects intent, and takes action.
- **Tone:** Warm, friendly, approachable, confident. Not corporate. Think "the smart friend who has their life together." Casual but not sloppy. Concise copy — every word earns its place.
- **Domain:** tryada.app

---

## Color Palette (NO BLUE ANYWHERE)

| Token | Hex | Usage |
|-------|-----|-------|
| Primary / CTAs | `#EB5E55` | Buttons, links, key highlights |
| Background | `#FDF0D5` | Page background, hero background |
| Text | `#3A3335` | Headings, body text |
| Cards / Surface | `#FFFFFF` | Card backgrounds, elevated surfaces |
| Success / Confirmed | `#C6D8D3` | Success states, confirmation badges |
| Accent (sparingly) | `#D81E5B` | Emphasis, hover states, badges |
| Text Secondary | `#6B6360` | Subheadings, descriptions, muted text |
| Border | `#E8E2D6` | Card borders, dividers |

**Important:** Do NOT use blue (`#3B82F6`, `#6366F1`, or any blue) anywhere in the design. The coral + cream palette is intentional and should be the entire visual identity.

---

## Typography & Visual Style

- **Font:** Clean sans-serif — Inter, DM Sans, or similar Google Font. Load two weights: 400 (body) and 700 (headings).
- **Headings:** Large, bold, high contrast against cream background.
- **Body:** 16-18px, generous line height (1.6+), `#3A3335` on `#FDF0D5`.
- **Whitespace:** Generous. Sections should breathe. Minimum 80px vertical padding between sections.
- **Cards:** White (`#FFFFFF`) with subtle `#E8E2D6` border, 12-16px border radius, soft shadow (`0 2px 8px rgba(58, 51, 53, 0.06)`).
- **Buttons:** Rounded (8-12px radius), `#EB5E55` background, white text, bold. Hover: `#D81E5B`.
- **Max content width:** 1200px centered. Hero text max-width 720px.
- **Mobile-first:** Stack all sections vertically on mobile. Cards full-width on small screens, 2-3 column grid on desktop.
- **No emojis in headings.** Emojis are fine in feature cards and category badges.

---

## Page Sections (in order)

### 1. Navigation Bar (sticky)

- Logo: "Ada" in bold text, `#3A3335`
- Right side: "Join Waitlist" button (coral `#EB5E55`, white text) — scrolls to waitlist form
- Transparent background, gains subtle white background + shadow on scroll
- Compact: 60px height

---

### 2. Hero Section

**Headline:**
> The share button just got an AI upgrade.

**Subheadline:**
> Share anything from any app. Ada classifies it, organizes it, and tells you what to do next — so nothing falls through the cracks.

**Supporting stat:**
> People save 20+ pieces of content per week and act on fewer than 5%. Ada changes that.

**Waitlist CTA:**
- Email input field + "Get Early Access" button (coral)
- Placeholder text: "you@email.com"
- Below: "Free for early adopters. iOS only at launch."

**Visual:** On the right side (desktop) or below the text (mobile), show a stylized phone mockup or illustration representing the share sheet flow. If you can't generate an image, use a clean CSS mockup of a phone with a share extension UI showing:
```
┌─────────────────────────────┐
│  Ada                   Done │
├─────────────────────────────┤
│                             │
│  eventbrite.com/sf-tech...  │
│                             │
│  📂 Events & Plans          │
│                             │
│  ✨ Add to Calendar          │
│     Mar 15, 7pm — SF Tech   │
│                             │
│  ┌───────────┐ ┌─────────┐ │
│  │ ✓ Save+Act│ │Just Save│ │
│  └───────────┘ └─────────┘ │
└─────────────────────────────┘
```

---

### 3. "How It Works" — 4-Step Flow

Section title: **"From share button to done. In seconds."**

Four cards in a horizontal row (stacked on mobile), each with a number, icon, title, and description:

**Step 1: Share**
> Tap share from any app — Safari, Instagram, LinkedIn, Camera Roll, Messages, anywhere. Ada appears in your share sheet.

**Step 2: Detect**
> AI instantly classifies your content: event, job posting, restaurant, article, product, travel plan, and 6 more categories. It extracts dates, prices, contacts, and deadlines automatically.

**Step 3: Act**
> Ada suggests the right action — add to calendar, set a reminder, generate a summary, save a contact. One tap to approve.

**Step 4: Done**
> The action executes. The event is on your calendar. The reminder is set. Everything is filed and searchable. You're back in your app in under 2 seconds.

---

### 4. "What Can Ada Detect?" — Category Grid

Section title: **"Ada understands what you share."**
Section subtitle: **"12 content categories, recognized instantly."**

Display as a 3x4 grid (2x6 on mobile) of category cards. Each card has an icon, label, and a real-world example:

| Category | Icon | Example |
|----------|------|---------|
| Events & Plans | 📅 | "SF Tech Meetup — March 15, 7pm at The Vault" |
| Food & Dining | 🍽️ | "That new ramen spot your friend sent on Instagram" |
| Shopping & Deals | 🛒 | "Nike Dunks on sale — $89, down from $120" |
| Travel | ✈️ | "Airbnb cabin in Big Sur — saved from Safari" |
| Jobs & Career | 💼 | "Senior PM role at Stripe — LinkedIn share" |
| Learning | 📚 | "That React tutorial you bookmarked and forgot" |
| Entertainment | 🎬 | "Movie trailer from YouTube — releases next Friday" |
| Health & Fitness | 💪 | "Gym class schedule screenshot from Instagram Stories" |
| Finance | 💰 | "Venmo request reminder — rent due March 1st" |
| Social | 👥 | "New connection's LinkedIn profile to follow up with" |
| Inspiration | ✨ | "Interior design mood board from Pinterest" |
| Other | 📁 | "Anything else — Ada files it and learns your patterns" |

---

### 5. "What Can Ada Do?" — Action Types

Section title: **"Ada doesn't just organize. It acts."**

Display as feature cards with icon + title + description:

**Add to Calendar**
> Event detected? Ada extracts the title, date, time, and location, then creates a calendar event with one tap.

**Set Reminders**
> Deadline approaching? Ada catches urgency signals — "due Friday," "RSVP by March 10" — and sets a reminder so you never miss it.

**Generate Summaries**
> Long article or research paper? Ada reads it and gives you the key points in seconds. No more "I'll read it later" purgatory.

**Save Contacts**
> Met someone at a conference? Shared a LinkedIn profile? Ada extracts the name, title, company, and saves the contact.

**Create Notes**
> Ada pulls out the most important details — key quotes, action items, takeaways — into a structured note.

**Track Prices**
> Spotted a product you want? Ada monitors the price and alerts you when it drops. *(Coming soon)*

---

### 6. "Why Ada, Not ChatGPT?" — Competitive Comparison

Section title: **"AI agents are powerful. But they're all chat-first."**

**Opening paragraph:**
> ChatGPT, Manus, and other AI agents can do incredible things — but they all start the same way: open the app, describe what you want, prompt-engineer the output. That's a friction barrier that excludes most people and kills spontaneous action.

> Ada flips the model. **The content IS the prompt.** You don't describe your intent — Ada infers it from what you shared. No typing. No prompting. No switching apps.

**Comparison table:**

| | Chat Agents (ChatGPT, Manus) | Ada |
|---|---|---|
| **Starting point** | Open app, type a prompt | Share from any app — one tap |
| **Context** | You describe what you have | Ada sees what you shared |
| **Intent** | You tell it what to do | Ada infers what you need |
| **Time to action** | 30-60 seconds of prompting | 2 seconds, zero prompting |
| **Organization** | Scattered chat threads | Auto-categorized library |
| **Works from any app** | No — must copy/paste into chat | Yes — iOS share sheet |
| **Non-technical users** | Struggle with prompting | Just tap Share → Done |

**Pull quote / callout:**
> "The best AI assistant is one you never have to talk to."

---

### 7. Real Use Cases

Section title: **"Real moments. Real saves."**

Three horizontal example cards (stacked on mobile), each showing a scenario:

**The Job Hunter**
> You're scrolling LinkedIn and spot a PM role at your dream company. Share it to Ada. Instantly: job details extracted, deadline flagged, reminder set for "Apply by Friday." A week later, Ada drafts your cover letter from your stored resume.

**The Social Butterfly**
> Friend texts you a restaurant link and an event flyer screenshot. Share both to Ada. The restaurant goes into Food & Dining with a "Book reservation" action. The event goes into Events & Plans with "Add to Calendar" — date, time, location already filled in.

**The Student**
> You screenshot a professor's office hours from Instagram Stories, save an arxiv paper from Safari, and bookmark a YouTube tutorial. All three hit Ada's share sheet. All three are classified, organized, and waiting in your Library — with a summary generated for the paper.

---

### 8. Technical Credibility (Brief)

Section title: **"Built different. Engineered thoughtfully."**

Short paragraph + bullet points:

> Ada processes everything server-side through a secure AI pipeline. Your data never trains any model. Classification happens in under 3 seconds.

- **On-device:** Share extension captures content and dismisses in under 2 seconds
- **Server-side:** AI classification via edge functions — your content is never stored on third-party servers
- **Smart fallback:** If AI is unavailable, heuristic classification kicks in instantly using 30+ domain rules
- **Multimodal:** Screenshots and images are understood visually — OCR + content analysis in a single AI call
- **Privacy-first:** Row-level security, encrypted at rest and in transit, no data shared with third parties

---

### 9. Final CTA — Waitlist Signup

Section title: **"Stop saving. Start doing."**

**Subtitle:**
> Ada is launching soon on iOS. Join the waitlist for early access — free for the first 500 users.

**Waitlist form:**
- Email input + "Join the Waitlist" button (coral `#EB5E55`)
- Below form: "No spam. Just an invite when we're ready."
- On successful submit: replace form with success message — "You're in! We'll email you when Ada is ready." (use `#C6D8D3` sage background for the success card)

---

### 10. Footer

- Left: "Ada" logo + "Share anything. It's handled." in small text
- Right: Links — "Privacy" | "Twitter" | "Contact"
- Bottom: "© 2026 Ada. All rights reserved."
- Background: `#3A3335` (dark charcoal), text: `#FDF0D5` (cream)

---

## Waitlist Form Behavior

- Email validation (basic regex + required field)
- Submit button shows loading spinner on click
- On success: hide form, show success card with checkmark icon and sage green background
- Store signups however makes sense for your stack — a simple Supabase/InsForge insert, Formspree, or even localStorage for a prototype
- Prevent duplicate submissions (disable button after click)
- Both hero CTA and final CTA should use the same form/handler

---

## Responsive Breakpoints

- **Mobile (< 640px):** Single column, stacked sections, full-width cards, hero text centered
- **Tablet (640-1024px):** 2-column grids, side-by-side hero text + phone mockup
- **Desktop (> 1024px):** 3-4 column grids, spacious layout, max-width 1200px centered

---

## Performance & SEO

- **Meta title:** "Ada — Share anything. It's handled."
- **Meta description:** "Ada turns your iOS share button into an AI assistant. Share links, screenshots, and text from any app. Ada classifies, organizes, and acts — so nothing falls through the cracks. Join the waitlist."
- **Open Graph image:** Generate or use a placeholder — 1200x630, coral gradient with "Ada" logo and tagline
- **Favicon:** Simple "A" lettermark in coral on cream
- **Fast load:** No heavy frameworks. Tailwind CDN + Google Fonts + vanilla JS. Target < 2s first contentful paint.
- **Smooth scroll:** Anchor links should smooth-scroll to sections
- **Animations:** Subtle fade-in on scroll for cards (CSS `@keyframes` or Intersection Observer). Nothing flashy — the warm palette IS the personality.

---

## Additional Design Notes

- The overall feeling should be **warm and inviting**, like a well-designed notebook or planner app. NOT cold tech, NOT corporate SaaS, NOT dark mode.
- Think: Notion's marketing page warmth + Linear's cleanliness + Readwise's book-lover aesthetic
- Category cards should use the coral primary color for icon/accent, not individual category colors (keep the palette cohesive)
- The phone mockup in the hero should feel native and premium, not a wireframe
- If using illustrations, keep them simple line-art style in the charcoal color
- White cards on cream background — the contrast should be subtle, not jarring
- Buttons should have a slight shadow and feel tactile
- The comparison table should clearly favor Ada's column visually (coral highlights or checkmarks vs. gray x-marks)

---

## Content Summary (Quick Reference)

**Product:** Ada — AI-powered iOS share extension that classifies, organizes, and suggests actions for anything you share
**Tagline:** "Share anything. It's handled."
**Key stat:** People save 20+ pieces of content per week, act on fewer than 5%
**Core flow:** Share → Detect → Act → Done (under 2 seconds)
**Categories:** 12 (Events, Food, Shopping, Travel, Jobs, Learning, Entertainment, Health, Finance, Social, Inspiration, Other)
**Actions:** Add to Calendar, Set Reminder, Generate Summary, Save Contact, Create Note, Track Price
**Differentiator:** Context-first, not chat-first. The content IS the prompt. Zero prompting needed.
**Target users:** Busy professionals (25-40), college power users (18-24), non-technical parents (30-50)
**Pricing:** Free for early adopters. Pro tier planned at $9.99/month.
**Platform:** iOS only at launch (Android planned)
**Tech:** Expo + TypeScript, InsForge backend, Gemini AI, on-device heuristic fallback
**Privacy:** Server-side AI, encrypted, no third-party data sharing, no model training on user data
