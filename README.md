# STEM KERALA — OFFICIAL PRE-REGISTRATION PLATFORM

Official, production-ready pre-registration website and Google Sheets backend system for **STEM Kerala**.

Redesigned following the minimalist, bold, and beautiful Kerala visual identity: vibrant `#FFE500` Kerala yellow, deep `#00512E` and `#003B22` palm forest greens, bespoke coconut tree vector artwork, and clean typography.

---

## 🎨 BRAND DESIGN SYSTEM

- **Main Background:** `#FFE500` (Vibrant Kerala Yellow)
- **Primary Green:** `#00512E` (Deep Palm Forest Green)
- **Dark Green:** `#003B22` (High-contrast Typography & Borders)
- **Secondary Background:** `#FFFCE8` (Soft Cream Tint for Modals/Cards)
- **White:** `#FFFFFF`
- **Typography:** Manrope (Body & Inputs) and Outfit (Headings, Badges & Buttons)
- **Visuals:** Hand-crafted SVG coconut palm tree silhouettes, pill navigation, clean card containers.

---

## 🚀 WEBSITE SECTIONS & FEATURES

1. **Top Pill Navigation:**
   - STEM Kerala official logo badge.
   - Thin vertical divider.
   - Live green pulsing status indicator.
   - `"PRE-REGISTRATION OPEN"` text.

2. **Minimal Hero Section:**
   - Headline: *"Kerala's Next Wave of Innovation."*
   - Subtitle: *"Rooted in Kerala. Growing Beyond Boundaries."*
   - Description: *"Science, technology, engineering and mathematics — bringing curious minds together to imagine, create and build the future."*
   - **Two Central Registration Buttons:**
     - **Button 1 (Student):** *"Register as Student ↗"* with supporting copy *"Register as a student and claim your early-bird offer."*
     - **Button 2 (School):** *"Register Your School ↗"* with supporting copy *"Bring STEM learning opportunities to your school."*
   - Live Early Bird 20% Discount availability micro-indicator.

3. **Student Pre-Registration Dedicated View:**
   - Heading: *"Start Your STEM Journey."*
   - 20% OFF Early Bird discount banner (first 200 registrations).
   - Fields: Full Name, Class dropdown, Parent Name, Phone (+91), School Name, District (all 14 Kerala districts).
   - Client & server validation, anti-spam honeypot, sequential ID (`STEM-2026-XXXX`).

4. **School Registration Dedicated View:**
   - Heading: *"Bring STEM to Your School."*
   - Separate form storing in dedicated `school_responses` Google Sheet tab.
   - Fields: School Name, District (14 districts), Mentor/Coordinator Name, Mentor Phone, Number of Interested Students (>0), Principal Name, Principal Contact Number, School Email (optional).
   - Sequential School ID (`STEM-SCH-XXXX`).
   - Does **not** count against the student 20% discount quota.

5. **Why Select STEM Kerala? (Minimal 4 Items):**
   - **Learn by Doing:** Practical hardware/software building over rote theory.
   - **Future-Ready Skills:** AI, Coding, Robotics, and IoT.
   - **Create Real Projects:** Working prototypes and tangible inventions.
   - **Think Beyond Boundaries:** Creative confidence and innovation mindset.

6. **Achievements Gallery:**
   - Section heading: *"Small Ideas. Big Achievements."*
   - Responsive grid (3 cols desktop, 2 cols tablet, 1 col mobile) with 3:2 aspect ratio and `object-fit: cover`.
   - Subtle top & bottom CSS mask fade effect.
   - Uses real WebP achievement images from `achievments/`.
   - Click to inspect full image via lightbox.

7. **Featured in the Media:**
   - Section heading: *"STEM Kerala in the Spotlight."*
   - 3:2 aspect ratio containers with centered, transparent WebP media logos from `news/`.
   - `object-fit: contain`, never cropped, stretched, or recolored.
   - Click to preview in lightbox.

8. **Submission Experience:**
   - **Sound:** Plays `submit.mp3` immediately when the user initiates submission, with Web Audio melodic chime fallback.
   - **Validation:** Instant inline feedback for missing or invalid inputs.
   - **Loading State:** Button smoothly switches to spinning loader with *"Please wait while we process your registration."*
   - **Success Modal:** Animated SVG checkmark, confetti burst, unique Registration ID badge with one-click copy, and confirmation status.

9. **Minimal Footer:**
   - Left: *"An initiative by TEB Innovations ↗"* (links to `tebinnovations.in`).
   - Centre: `hello@tebinnovations.in`.
   - Right: *"© 2026 STEM Kerala. All rights reserved."*

---

## 📊 GOOGLE APPS SCRIPT BACKEND (`Code.gs`)

The backend script handles both Student and School registrations with complete concurrency locking and data validation.

### Google Sheet Tabs & Structure:

#### 1. `responses` (Student Registrations)
- `Timestamp`
- `Registration Number` (e.g. `STEM-2026-0001`)
- `Full Name`
- `Class`
- `Parent Name`
- `Phone Number`
- `School Name`
- `District`
- `Discount Eligibility` (Server assigns `20% Discount Eligible (Early Bird)` to first 200, then `Standard Registration`)
- `Registration Status`

#### 2. `school_responses` (School Registrations)
- `Timestamp`
- `School Registration ID` (e.g. `STEM-SCH-0001`)
- `School Name`
- `District`
- `Mentor Name`
- `Mentor Phone`
- `Number of Students`
- `Principal Name`
- `Principal Contact`
- `School Email`
- `Registration Status`

### Backend Deployment Steps:
1. Open your target Google Sheet.
2. In the top menu, go to **Extensions &rarr; Apps Script**.
3. Replace the entire contents of `Code.gs` with the updated code from `D:\Anu\VS\pre-reg-stemkerala\Code.gs`.
4. Click **Save**.
5. Click **Deploy &rarr; New deployment** (or **Manage deployments &rarr; Edit &rarr; New version**).
6. Select type: **Web app**.
7. Set **Execute as:** `Me`.
8. Set **Who has access:** `Anyone` *(Crucial: allows public students and schools to submit without Google login prompts).*
9. Copy the generated Web App URL and update `SCRIPT_URL` in `script.js` if deploying to a new URL.

---

## 🧪 LOCAL TESTING

Simply open `index.html` in any modern web browser or run:
```bash
# Using Node:
npx serve .
```
