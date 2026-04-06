---

# RetailzPOS Unified Creation System – Feature Overview

A powerful, all‑in‑one front‑end tool for managing **tickets**, **store creations**, and **Moolah account setups**. Data is stored locally (IndexedDB/localStorage) with optional Google Sheets import and AI‑powered summarization.

## Core Modules

### 1. Ticket Creation
- Full ticket form with: date, shift schedule, support name, portal number, store name, ZIP, contact person/number, module (searchable dropdown), issue description, escalated person, status, remarks, rich‑text **troubleshooting** (Quill editor), and a free‑text note.
- Real‑time **preview panel** shows formatted issue, note, contact info, and resolution.
- **Clock In/Out** buttons copy predefined shift times to clipboard.
- Automatically syncs shift & support fields to the Store and Moolah tabs.
- **AI summarization** (Gemini API) can condense troubleshooting steps into a short resolution.

### 2. Store Creation
- Form fields: portal, store name, ZIP, agent, email, password, SKU, database, # of registers, Moki ID, AnyDesk ID.
- Preview panel shows:
  - Auto‑generated URL (`https://portal[PORTAL].retailzpos.com/`)
  - Naming convention line (`SKU_STATE_STORE_LIVE-PORTAL_ZIP_REG-1`)
  - State and timezone derived from ZIP code
  - Standard checklist (creation, app install, DB upload, etc.)
- Shift & support inherited from the Ticket tab.

### 3. Moolah Creation
- Fields: portal, store name, ZIP, email, password, # of tabs, 6‑digit SKU, Moki ID, AnyDesk ID.
- Preview panel shows:
  - Naming line (`SKU_STATE_STORE_LIVE-PORTAL_ZIP_MOOLAH-1`)
  - State & timezone
  - Standard checklist (account creation, app install, store assignment)
- Also inherits shift/support from Ticket tab.

## Store Data Integration (Google Sheets)
- Fetches store information (portal, store name, ZIP, status, notes) from a public Google Sheet.
- Requires a **Google Sheets API key** (stored in localStorage; set via “SET SHEETS KEY” button).
- **Real‑time store search** with keyboard navigation (↑/↓/Enter) and status badges (Active / Deleted / Deactive / Demo).
- Auto‑populates portal, store name, and ZIP when a store is selected.

## Data Management & History

### Main Table
- Displays all non‑deleted entries (older entries are automatically hidden after the current day).
- Columns: date, shift, support, portal, store, ZIP, contact, contact#, module, issue, escalated, status, remarks, resolution.
- Row actions:
  - 📋 Copy row (tab‑separated)
  - 🔄 Summarize resolution (Gemini)
  - ✏️ Edit (loads entry back into the active form)
  - 🗑️ Soft‑delete (removes from main table, stays in history)

### Sidebar – Ticket History
- Groups entries by **month → date** with collapsible sections (state saved).
- Each entry card shows: issue/store/portal/ZIP + action buttons:
  - 📋 DETAILS – copies portal, store, ZIP, caller, contact, issue, note
  - 📋 HRMS – copies contact info + troubleshooting + resolution (rich HTML + plain text)
  - ✏️ Edit – loads entry for editing
  - ↩️ Restore – brings a soft‑deleted entry back to the main table
  - 🗑️ Delete – permanent deletion (with confirmation)

### Bulk Actions (table toolbar)
- **Select All** checkbox
- 🗑️ REMOVE – soft‑delete selected rows
- 📋 COPY – copy selected rows as tab‑separated values (newest last, no headers)
- ✏️ UPDATE – bulk change status (RESOLVED/PENDING/OTHER TASK/UNSOLVED) for selected rows
- 📥 EXPORT – export visible rows to CSV
- 📤 IMPORT – import CSV (must match expected column headers)
- 📋 SHIFT REPORT – generates a detailed end‑of‑shift report (plain text + HTML) with pending tickets, total calls, other tasks, training/demo, version notes, and reminders.

## AI Features (Gemini)
- **Resolution summarization**: Extracts plain text from the rich‑text troubleshooting field and asks Gemini to produce a 2‑3 sentence professional summary.
- Supports multiple model fallbacks (gemini‑2.0‑flash, gemini‑2.5‑pro, etc.).
- API key is stored locally and can be updated via “SET GEMINI KEY” button.

## Usability & Polish
- **Dark mode** with persistent preference.
- **Undo / Redo** (Ctrl+Z / Ctrl+Y) for all entry changes.
- **Auto‑uppercase** for most text inputs (except passwords, emails, phone numbers).
- **Auto‑growing textareas**.
- **Form data persistence** – each tab remembers its last filled values.
- **Phone number formatting** (US style: `(XXX) XXX-XXXX`).
- **Datalist autocomplete** for Module and Status, with Tab key completion.
- **Rich text editor** (Quill) for troubleshooting steps.
- **Responsive layout** – sidebar can be hidden, tables scroll on small screens.

## Technical Highlights
- Pure HTML/CSS/JS (no backend) – runs entirely in the browser.
- Uses **localStorage** for entries, API keys, theme, sidebar collapse state, and form drafts.
- **Google Sheets API v4** for live store data (read‑only).
- **Gemini API** for summarization.
- jQuery 4 (lightweight DOM helpers) + Bootstrap Icons.
- No build step – works as a single `index.html`.

---

*This README summary reflects version 4.0 of the RetailzPOS Unified Creation System.*
