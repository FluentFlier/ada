# Ada — Technical Architecture
## Expo + InsForge + Gemini Stack

---

## 1. Why Expo (Not Pure Swift)

### The Argument For Swift
iOS share extensions have a 120MB memory limit. Native Swift uses 5-15MB baseline. Maximum headroom.

### Why We're Going Expo Anyway
1. **expo-share-extension exists** — maintained package, handles the share extension target setup
2. **Hermes baseline is ~50MB** — leaves ~70MB for a thin capture-and-dismiss extension. Ada's extension doesn't do heavy processing — it captures content, saves to InsForge, and closes. 70MB is plenty.
3. **One TypeScript codebase** — share extension, main app, and edge functions all in TypeScript
4. **EAS handles the hard parts** — code signing, provisioning profiles, TestFlight submission. No manual Xcode headaches.
5. **OTA updates** — push JS fixes without App Store review (EAS Update)
6. **Claude Code is faster at TypeScript** — faster iteration for a solo builder
7. **Android comes ~free later** — expo-share-intent for Android share targets
8. **InsForge SDK is TypeScript** — native integration, no bridging
9. **Web dashboard later** — share code between mobile app and web admin panel

### Memory Safety Plan
- Share extension: capture content → save to InsForge → dismiss. No heavy processing.
- If memory issues arise on specific devices: fall back to expo-share-intent (opens main app instead of inline extension)
- Profile memory usage in release builds on physical devices before launch
- Keep share extension dependencies minimal (no image processing libraries)

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                      iOS Device                       │
│                                                       │
│  ┌───────────────────┐     ┌──────────────────────┐  │
│  │ Share Extension    │     │ Ada Main App (Expo)  │  │
│  │ (expo-share-ext)   │     │                      │  │
│  │                    │     │ ┌──────────────────┐ │  │
│  │ - Capture URL/     │     │ │ Inbox            │ │  │
│  │   text/image       │     │ │ Library          │ │  │
│  │ - Save to InsForge │     │ │ Tasks            │ │  │
│  │ - Dismiss          │     │ │ Settings         │ │  │
│  └────────┬───────────┘     │ └──────────────────┘ │  │
│           │                 │                      │  │
│           │  InsForge SDK   │  expo-calendar       │  │
│           │  (direct save)  │  expo-notifications  │  │
│           │                 │                      │  │
│           └────────┬────────┴──────────┬───────────┘  │
│                    │                   │              │
└────────────────────┼───────────────────┼──────────────┘
                     │ HTTPS             │ HTTPS
                     ▼                   ▼
┌──────────────────────────────────────────────────────┐
│                    InsForge                            │
│                  (Unlimited Pro)                       │
│                                                       │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Postgres │  │ Edge         │  │ Auth           │  │
│  │          │  │ Functions    │  │ (Sign in w/    │  │
│  │ - items  │  │              │  │  Apple +       │  │
│  │ - actions│  │ /classify    │  │  email)        │  │
│  │ - profiles│ │ /summarize   │  └────────────────┘  │
│  │ - vectors│  │ /draft       │                       │
│  │          │  │ /embed       │  ┌────────────────┐  │
│  └──────────┘  └──────┬───────┘  │ Storage        │  │
│                       │          │ (images/files) │  │
│                       │          └────────────────┘  │
└───────────────────────┼──────────────────────────────┘
                        │ HTTPS
                        ▼
┌──────────────────────────────────────────────────────┐
│              Google Gemini (Free Tier)                 │
│                                                       │
│  ┌─────────────────┐  ┌────────────────────────────┐ │
│  │ Flash-Lite       │  │ Flash                      │ │
│  │ (classification) │  │ (summarization)            │ │
│  │ 1,000 RPD free   │  │ 250 RPD free              │ │
│  │ 15 RPM           │  │ 10 RPM                    │ │
│  │ + multimodal     │  │                            │ │
│  │   (image→struct) │  │                            │ │
│  └─────────────────┘  └────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Embedding (text-embedding-004)                   │ │
│  │ 1,500 RPD free                                   │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 3. Share Extension Implementation

### Using expo-share-extension

**Setup in app.json:**
```json
{
  "expo": {
    "plugins": [
      ["expo-share-extension", {
        "backgroundColor": "#0A0A1A"
      }]
    ]
  }
}
```

**Share extension entry (share-extension/index.tsx):**
```typescript
import { AppRegistry } from "react-native";
import ShareExtension from "./ShareView";

AppRegistry.registerComponent("shareExtension", () => ShareExtension);
```

**ShareView.tsx (the actual share extension UI):**
```typescript
import { close } from "expo-share-extension";
import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { createClient } from "@insforge/sdk";

// InsForge client (initialized with stored auth token)
const insforge = createClient({
  baseUrl: process.env.EXPO_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY!,
});

type ShareProps = {
  url?: string;
  text?: string;
  images?: string[];  // local file URIs
  files?: string[];
};

export default function ShareView({ url, text, images, files }: ShareProps) {
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  // Quick URL pattern classification (instant, no API call)
  useEffect(() => {
    if (url) {
      setCategory(quickClassify(url));
    }
  }, [url]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save raw item to InsForge — classification happens server-side
      await insforge.db.from("items").insert({
        content_type: url ? "url" : images?.length ? "image" : "text",
        raw_content: url || text || "",
        status: "pending",
        quick_category: category,
        // If image, upload to storage first
      });

      // If there's an image, upload it
      if (images?.length) {
        // Upload to InsForge storage
        // Store reference in item
      }
    } catch (error) {
      console.error("Save failed:", error);
    }
    close(); // Dismiss share extension
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A1A", padding: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Ada</Text>
        <TouchableOpacity onPress={close}>
          <Text style={{ color: "#6C63FF" }}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Content preview */}
      <View style={{ backgroundColor: "#1a1a2e", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <Text style={{ color: "#aaa", fontSize: 14 }} numberOfLines={2}>
          {url || text || `${images?.length || 0} image(s)`}
        </Text>
        {category && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ color: "#00D4AA", fontSize: 12 }}>
              📂 {category}
            </Text>
          </View>
        )}
      </View>

      {/* Save button */}
      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        style={{
          backgroundColor: "#6C63FF",
          borderRadius: 12,
          padding: 16,
          alignItems: "center",
        }}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
            ✓ Save to Ada
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// Instant URL pattern matching (no API call, runs in extension)
function quickClassify(url: string): string | null {
  const host = new URL(url).hostname.toLowerCase();
  const path = new URL(url).pathname.toLowerCase();

  if (host.includes("eventbrite") || host.includes("meetup") || host.includes("luma")) return "Events & Plans";
  if (host.includes("linkedin.com") && path.includes("/jobs/")) return "Jobs & Career";
  if (host.includes("linkedin.com") && path.includes("/in/")) return "People & Contacts";
  if (host.includes("yelp") || host.includes("opentable") || host.includes("resy")) return "Food & Dining";
  if (host.includes("amazon") || host.includes("ebay") || host.includes("etsy")) return "Shopping & Products";
  if (host.includes("youtube") || host.includes("spotify") || host.includes("netflix")) return "Media";
  if (host.includes("airbnb") || host.includes("booking.com") || host.includes("tripadvisor")) return "Travel";

  return null; // Will be classified by Gemini on the backend
}
```

### Memory Budget
| Component | Estimated Memory |
|-----------|-----------------|
| Hermes runtime | ~35-50MB |
| Share extension UI (minimal React Native) | ~5-10MB |
| InsForge SDK network call | ~2-5MB |
| **Total** | **~42-65MB** |
| **Headroom (from 120MB)** | **55-78MB** |

The extension does NOT process images locally. It saves the image file URI, uploads to InsForge Storage, and lets the backend handle everything.

---

## 4. Content Processing Pipeline

### Stage 1: Capture (Share Extension — instant)
1. User taps Share → selects Ada
2. expo-share-extension receives content (URL, text, or image file URIs)
3. Quick URL pattern classification (instant, no API)
4. Insert raw item into InsForge `items` table with status "pending"
5. If image: upload to InsForge Storage, save URL reference
6. Dismiss extension — user back to their app in < 2 seconds

### Stage 2: Classification (Server-Side Edge Function)
Triggered by: database webhook / scheduled poll / main app request

**For URLs:**
```typescript
// Edge function: /classify
// 1. Fetch URL metadata (Open Graph tags, title, description)
// 2. Send to Gemini Flash-Lite for classification
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Classify this content and extract structured data.
          
URL: ${url}
Title: ${title}
Description: ${description}
Body text: ${bodyText?.slice(0, 2000)}

Return JSON only: { "category": "...", "confidence": 0.0-1.0, "extracted_data": {...}, "suggested_actions": [...] }`
        }]
      }],
      generationConfig: { responseMimeType: "application/json" }
    })
  }
);
```

**For Images/Screenshots (the killer feature):**
```typescript
// Send image directly to Gemini multimodal — OCR + classification in ONE call
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64ImageData  // The screenshot/image
            }
          },
          {
            text: `You are an AI assistant analyzing a screenshot or image shared by a user.

1. Extract ALL text visible in the image (OCR).
2. Classify the content into exactly one category: article, event, job, product, restaurant, travel, person, task, media, document
3. Extract structured data based on the category.
4. Suggest actions the user might want to take.

Return JSON only:
{
  "ocr_text": "full extracted text",
  "category": "category_name",
  "confidence": 0.0-1.0,
  "extracted_data": { ... category-specific fields ... },
  "suggested_actions": [
    { "type": "action_type", "description": "what it does", "priority": "high|medium|low" }
  ]
}`
          }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    })
  }
);
```

This is the key architectural insight: **one Gemini multimodal call replaces the entire OCR → parse → classify → extract pipeline.** The model sees the image, reads the text, understands the layout and context, and returns structured data. A job posting screenshot from LinkedIn looks completely different from an event flyer — Gemini understands this visually.

### Stage 3: Action Execution (User-Triggered in Main App)
1. User opens Ada → Inbox shows classified items with suggested actions
2. User taps "Approve" on an action
3. App executes:
   - **Calendar:** expo-calendar creates event
   - **Reminder:** expo-calendar creates reminder  
   - **Summary:** Calls Gemini Flash via edge function
   - **Message draft:** Calls Gemini Flash via edge function
   - **Booking:** Opens deep link to Resy/OpenTable/Google Maps
4. Action status updated in InsForge

---

## 5. InsForge Database Schema

```sql
-- Enable vector extension (if InsForge supports pgvector)
-- Otherwise, use InsForge's built-in search or store embeddings as JSON arrays

-- User profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY,  -- matches auth user ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    display_name TEXT,
    email TEXT,
    resume_text TEXT,
    bio TEXT,
    interests TEXT[],
    default_calendar_id TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
    daily_item_count INT DEFAULT 0,
    daily_item_reset_at DATE DEFAULT CURRENT_DATE
);

-- Shared items
CREATE TABLE items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    content_type TEXT NOT NULL CHECK (content_type IN ('url', 'text', 'image', 'file')),
    raw_content TEXT NOT NULL,
    title TEXT,
    description TEXT,
    source_app TEXT,
    thumbnail_url TEXT,
    image_storage_path TEXT,  -- InsForge Storage path for uploaded images
    
    category TEXT DEFAULT 'uncategorized',
    extracted_data JSONB DEFAULT '{}',
    confidence REAL,
    
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'classifying', 'classified', 'action_suggested', 
        'action_completed', 'archived'
    )),
    ocr_text TEXT,
    summary TEXT,
    
    embedding REAL[],  -- 768-dim Gemini embedding as array
    
    is_starred BOOLEAN DEFAULT FALSE,
    user_note TEXT,
    quick_category TEXT  -- From URL pattern matching in share extension
);

-- Actions
CREATE TABLE actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    
    action_type TEXT NOT NULL CHECK (action_type IN (
        'add_calendar', 'create_reminder', 'draft_message',
        'draft_cover_letter', 'generate_summary', 'deep_link_booking',
        'extract_contact', 'track_price'
    )),
    status TEXT DEFAULT 'suggested' CHECK (status IN (
        'suggested', 'approved', 'executing', 'completed', 'failed', 'dismissed'
    )),
    
    action_data JSONB DEFAULT '{}',
    result JSONB,
    error TEXT
);

-- Indexes
CREATE INDEX idx_items_user_id ON items(user_id);
CREATE INDEX idx_items_user_status ON items(user_id, status);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_created_at ON items(created_at DESC);
CREATE INDEX idx_actions_item_id ON actions(item_id);
CREATE INDEX idx_actions_user_status ON actions(user_id, status);
```

---

## 6. Gemini API Rate Limit Management

### Daily Budget (Free Tier)
| Model | Daily Limit | Ada Usage | Headroom |
|-------|-------------|-----------|----------|
| Flash-Lite (classify) | 1,000 RPD | ~500 (50 users × 10 items) | 500 spare |
| Flash (summarize) | 250 RPD | ~50 (20% of items get summaries) | 200 spare |
| Embedding | 1,500 RPD | ~500 (match classification) | 1,000 spare |

### Rate Limiting Strategy
```typescript
// services/gemini.ts
class GeminiService {
  private dailyCounts = { classify: 0, summarize: 0, embed: 0 };
  private limits = { classify: 900, summarize: 200, embed: 1400 }; // Leave buffer
  
  async classify(content: ClassifyInput): Promise<Classification> {
    if (this.dailyCounts.classify >= this.limits.classify) {
      // Queue for tomorrow or use fallback heuristic
      return this.heuristicClassify(content);
    }
    this.dailyCounts.classify++;
    return this.callGemini("flash-lite", content);
  }
  
  // Fallback: keyword-based classification when API quota exhausted
  heuristicClassify(content: ClassifyInput): Classification {
    const text = (content.title + " " + content.description).toLowerCase();
    if (text.match(/event|meetup|conference|rsvp|date.*time/)) return { category: "event", confidence: 0.6 };
    if (text.match(/hiring|job|career|apply|salary|remote/)) return { category: "job", confidence: 0.6 };
    if (text.match(/restaurant|menu|reserv|dine|cuisine/)) return { category: "restaurant", confidence: 0.6 };
    // ... etc
    return { category: "uncategorized", confidence: 0.3 };
  }
}
```

### When to Upgrade to Paid
- Consistently hitting >800 classifications/day
- Means you have 80+ active users sharing 10 items/day
- At that point you should have revenue or funding
- Gemini Flash-Lite paid: $0.075/M input tokens ≈ $0.0001 per classification
- 10,000 classifications/day = ~$1/day = ~$30/month

---

## 7. EAS Build & TestFlight Setup

### eas.json
```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "buildConfiguration": "Release" }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "your-app-store-connect-id"
      }
    }
  }
}
```

### Build & Deploy Commands
```bash
# Development build (for testing on device/simulator)
eas build --platform ios --profile development

# Preview build (TestFlight internal testing)  
eas build --platform ios --profile preview

# Submit to TestFlight
eas submit --platform ios

# Push OTA update (no App Store review needed)
eas update --branch preview --message "fix: classification bug"
```

### Apple Developer Account
- **Requirement:** Apple Developer Program ($99/year)
- **You need this for:** TestFlight distribution, share extension entitlement, Sign in with Apple
- **EAS handles:** Provisioning profiles, code signing, certificates (auto-managed)

---

## 8. Dependencies

### package.json (key dependencies)
```json
{
  "dependencies": {
    "expo": "~54.0.0",
    "expo-router": "~4.0.0",
    "expo-share-extension": "^2.0.0",
    "expo-calendar": "~13.0.0",
    "expo-notifications": "~0.29.0",
    "expo-image": "~2.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-apple-authentication": "~7.0.0",
    "@insforge/sdk": "latest",
    "zustand": "^5.0.0",
    "zod": "^3.23.0",
    "react-native-reanimated": "~3.16.0"
  }
}
```

---

## 9. Testing Strategy

### Device Testing (Critical)
- Test share extension on **physical iPhone** (not just simulator)
- Share from: Safari, Instagram, LinkedIn, Twitter/X, Camera Roll, Messages, Mail, Reddit, TikTok, Notes
- Monitor memory usage in release builds
- Test with large images (4K photos)
- Test with no network (graceful failure)

### Automated Tests
- Classification accuracy: 50+ sample items, assert ≥ 85% correct
- Gemini response parsing: mock responses, test Zod schema validation
- Calendar event creation: mock expo-calendar, verify correct fields
- Edge function unit tests: test each function with sample inputs

### Beta Testing
- EAS + TestFlight for iOS beta distribution
- Invite 20-50 testers from ASU network
- Feedback form (Notion or Google Forms)
- Track: shares per day, classification accuracy, action approval rate