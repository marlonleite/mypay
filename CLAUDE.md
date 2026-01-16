# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

myPay is a personal finance management app (controle financeiro pessoal) built with React, Firebase, and Tailwind CSS. The app is in Portuguese (pt-BR).

## Commands

```bash
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Production build to dist/
npm run lint     # ESLint check
npm run preview  # Preview production build
```

## Architecture

### Tech Stack
- React 18 + Vite
- Firebase (Firestore for data, Auth for Google login)
- Tailwind CSS with custom dark theme (dark-* colors)
- Lucide React for icons
- AWS S3 SDK for file uploads (MinIO compatible)
- Google Gemini API for document OCR/extraction

### Data Flow
All user data is stored under `users/{userId}/` in Firestore:
- `transactions/` - Income and expenses with recurrence support
- `cards/` - Credit card definitions (name, closing day, due day)
- `cardExpenses/` - Credit card purchases with installment tracking
- `categories/` - User-defined categories with subcategory support
- `accounts/` - Bank accounts and wallets

### Key Patterns

**Custom Hooks (src/hooks/)**
- `useFirestore.js` - Contains all Firestore hooks: `useTransactions`, `useCards`, `useCardExpenses`, `useCategories`, `useAccounts`, `useTags`
- Each hook returns data, loading, error states plus CRUD operations
- Uses real-time subscriptions via `onSnapshot`

**Authentication**
- `AuthContext` provides `user`, `loginWithGoogle`, `logout`
- `ProtectedRoute` wraps authenticated pages
- Firestore rules enforce `request.auth.uid == userId`

**Tab-Based Navigation**
- `App.jsx` uses tab state (`activeTab`) instead of routes for main navigation
- Tabs: dashboard, transactions, cards, categories, documents
- Month/year selection is shared state passed to child pages

**Document Import (AI-powered)**
- `src/services/ai/gemini.js` - Sends images/PDFs to Gemini for data extraction
- `src/services/ai/prompts.js` - Document-type-specific prompts
- `src/services/storage.js` - S3/MinIO file upload

### UI Components

Reusable components in `src/components/ui/`:
- `Button`, `Input`, `Select`, `Card`, `Modal`, `Loading`, `EmptyState`, `MonthSelector`
- All export from `index.js` barrel file

### Environment Variables

Required in `.env` (see `.env.example`):
- `VITE_FIREBASE_*` - Firebase config
- `VITE_GOOGLE_AI_KEY` - Gemini API for document processing
- `VITE_S3_*` - S3/MinIO storage config (endpoint, bucket, credentials)

## Conventions

- Portuguese for user-facing strings, English for code (variable names, comments)
- Dark mode only - uses custom `dark-*` color palette in Tailwind config
- Dates stored with noon time (12:00) to avoid timezone issues
- Installments create multiple documents, one per month
- Categories support soft delete (archived flag)
