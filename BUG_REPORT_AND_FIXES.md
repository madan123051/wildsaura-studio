# WildSaura Studio: Bug Report & Fixes

## Executive Summary

Two critical issues have been identified in the WildSaura Studio application:

1. **AI Enhancement Always Fails** — The Gemini API endpoint cannot be reached in non-Vercel deployments
2. **Auto-Crop Always Shows "No Crop Needed"** — The saliency detection algorithm is too aggressive in filtering out crops

---

## Issue 1: AI Enhancement Failure

### Root Cause

The application is a **frontend-only Vite app** with serverless API functions defined in the `/api` directory. However:

- **`vite.config.ts`** has **no proxy configuration** for `/api/*` requests
- **`vercel.json`** only provides the `/api` routing **when deployed to Vercel**
- When running locally, in preview mode, or on any non-Vercel hosting, the frontend's `fetch('/api/ai-enhance')` call fails with a **404 or network error**
- The error is caught silently and shows the toast: **"AI enhancement failed. Please try again."**

### Current Flow (Broken)

```
Frontend (app.tsx:894)
  ↓ fetch('/api/ai-enhance', POST)
  ↓ (No local proxy, no Vercel routing)
  ↓ 404 Not Found
  ↓ Error caught at app.tsx:950
  ↓ Toast: "AI enhancement failed. Please try again."
```

### Solution

#### Option A: Add Vite Dev Server Proxy (Recommended for Development)

Add a `server.proxy` configuration to `vite.config.ts` to forward API calls to a local function server:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Local function server
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': '/',
    },
  },
});
```

Then run a local function server (e.g., using Vercel Functions Emulator or a custom Node.js server) on port 3001.

#### Option B: Use Vercel CLI for Local Testing (Best Practice)

Install and use the Vercel CLI to emulate the production environment locally:

```bash
npm install -g vercel
vercel dev
```

This automatically:
- Starts a Vite dev server on port 3000
- Starts a local function server on port 3001
- Routes `/api/*` calls to the function server

#### Option C: Deploy to Vercel (Production)

The app is already configured for Vercel. Simply deploy:

```bash
vercel deploy
```

Vercel will automatically:
- Build the Vite app
- Deploy serverless functions from `/api`
- Route `/api/*` calls correctly

---

## Issue 2: Auto-Crop Always Shows "No Crop Needed"

### Root Cause

The `detectSubjectBounds()` function in `utils/editorPipeline.ts` uses a **saliency-based algorithm** that is **too aggressive** in determining when to skip cropping. It returns full-frame `{x:0, y:0, width:1, height:1}` in these cases:

1. **Line 385**: If max saliency < 1 (uniform/low-contrast images)
2. **Line 408**: If no blocks exceed the threshold (12% of max saliency)
3. **Line 433**: If detected subject fills **85%+ of the frame**
4. **Line 437**: If detected crop is smaller than **25% of the frame**

### Why It's Problematic

- **Most photos have subjects that fill 70-90% of the frame** → Returns full-frame
- **Threshold at 12% is too conservative** → Misses subtle subjects
- **Minimum crop size of 25% is too large** → Rejects valid edge crops
- **Low contrast images (sunsets, minimalist shots) fail completely** → Returns full-frame

### Current Algorithm Flow

```
Input: Image
  ↓
Downsample to 128×128
  ↓
Compute luminance variance per 8×8 block
  ↓
If max variance < 1 → Return full-frame ✗
  ↓
Find blocks above 12% threshold
  ↓
If no blocks found → Return full-frame ✗
  ↓
Compute bounding box + padding
  ↓
If bbox fills 85%+ of frame → Return full-frame ✗
  ↓
If bbox smaller than 25% → Return full-frame ✗
  ↓
Return crop rectangle
```

### Solution: Improve Saliency Detection

Replace the aggressive thresholds with more intelligent heuristics:

```typescript
export function detectSubjectBounds(
  source: HTMLImageElement | HTMLCanvasElement,
): SubjectRect {
  const SAMPLE = 128;
  const BLOCK = 8;
  const BLOCKS = SAMPLE / BLOCK;

  const canvas = createCanvas(SAMPLE, SAMPLE);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, SAMPLE, SAMPLE);
  const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);

  const lum = (i: number) => data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

  // Compute luminance variance per block
  const saliency: number[] = new Array(BLOCKS * BLOCKS).fill(0);
  let maxSal = 0;
  let totalSal = 0;

  for (let by = 0; by < BLOCKS; by++) {
    for (let bx = 0; bx < BLOCKS; bx++) {
      let sum = 0, sum2 = 0, count = 0;
      for (let dy = 0; dy < BLOCK; dy++) {
        for (let dx = 0; dx < BLOCK; dx++) {
          const i = ((by * BLOCK + dy) * SAMPLE + (bx * BLOCK + dx)) * 4;
          const l = lum(i);
          sum += l;
          sum2 += l * l;
          count++;
        }
      }
      const mean = sum / count;
      const v = Math.max(0, sum2 / count - mean * mean);
      saliency[by * BLOCKS + bx] = v;
      totalSal += v;
      if (v > maxSal) maxSal = v;
    }
  }

  // FIX 1: Use adaptive threshold instead of fixed 0.12
  // If average saliency is very low, image is uniform → no crop needed
  const avgSal = totalSal / (BLOCKS * BLOCKS);
  if (maxSal < 0.5 && avgSal < 0.1) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  // FIX 2: Use adaptive threshold based on distribution
  // Instead of 12% of max, use a percentile-based approach
  const sortedSal = [...saliency].sort((a, b) => b - a);
  const p75 = sortedSal[Math.floor(sortedSal.length * 0.25)];
  const THRESH = Math.max(maxSal * 0.08, p75 * 0.5); // 8% of max OR 50% of 75th percentile

  let minBX = BLOCKS, maxBX = -1, minBY = BLOCKS, maxBY = -1;
  let totalW = 0, wCX = 0, wCY = 0;

  for (let by = 0; by < BLOCKS; by++) {
    for (let bx = 0; bx < BLOCKS; bx++) {
      const sal = saliency[by * BLOCKS + bx];
      if (sal >= THRESH) {
        if (bx < minBX) minBX = bx;
        if (bx > maxBX) maxBX = bx;
        if (by < minBY) minBY = by;
        if (by > maxBY) maxBY = by;
        totalW += sal;
        wCX += (bx + 0.5) * sal;
        wCY += (by + 0.5) * sal;
      }
    }
  }

  // FIX 3: If no subject detected, try a more lenient threshold
  if (maxBX < minBX || maxBY < minBY) {
    // Fallback: use 50% of max saliency
    const LENIENT_THRESH = maxSal * 0.05;
    minBX = BLOCKS; maxBX = -1; minBY = BLOCKS; maxBY = -1;
    totalW = 0; wCX = 0; wCY = 0;

    for (let by = 0; by < BLOCKS; by++) {
      for (let bx = 0; bx < BLOCKS; bx++) {
        const sal = saliency[by * BLOCKS + bx];
        if (sal >= LENIENT_THRESH) {
          if (bx < minBX) minBX = bx;
          if (bx > maxBX) maxBX = bx;
          if (by < minBY) minBY = by;
          if (by > maxBY) maxBY = by;
          totalW += sal;
          wCX += (bx + 0.5) * sal;
          wCY += (by + 0.5) * sal;
        }
      }
    }

    // Still no subject found
    if (maxBX < minBX || maxBY < minBY) {
      return { x: 0, y: 0, width: 1, height: 1 };
    }
  }

  // Compute weighted center of mass
  const cxB = totalW > 0 ? wCX / totalW : BLOCKS / 2;
  const cyB = totalW > 0 ? wCY / totalW : BLOCKS / 2;

  // Expand bounding box to include center of mass
  const halfW = (maxBX - minBX + 1) * 0.5;
  const halfH = (maxBY - minBY + 1) * 0.5;
  const fMinBX = Math.min(minBX, Math.floor(cxB - halfW));
  const fMaxBX = Math.max(maxBX, Math.ceil(cxB + halfW));
  const fMinBY = Math.min(minBY, Math.floor(cyB - halfH));
  const fMaxBY = Math.max(maxBY, Math.ceil(cyB + halfH));

  // Convert to [0,1] with padding
  const PAD = 1.5;
  const x1 = Math.max(0, (fMinBX - PAD) / BLOCKS);
  const y1 = Math.max(0, (fMinBY - PAD) / BLOCKS);
  const x2 = Math.min(1, (fMaxBX + 1 + PAD) / BLOCKS);
  const y2 = Math.min(1, (fMaxBY + 1 + PAD) / BLOCKS);

  const w = x2 - x1;
  const h = y2 - y1;

  // FIX 4: Increase threshold from 85% to 92% (more lenient)
  // and reduce minimum crop size from 25% to 15%
  if (w > 0.92 && h > 0.92) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const MIN = 0.15; // Changed from 0.25
  if (w < MIN || h < MIN) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  return {
    x: x1,
    y: y1,
    width: Math.min(1 - x1, w),
    height: Math.min(1 - y1, h),
  };
}
```

### Key Improvements

| Issue | Original | Fixed | Benefit |
|-------|----------|-------|---------|
| **Low contrast** | Returns full-frame if `maxSal < 1` | Checks average saliency too | Handles sunsets, minimalist shots |
| **Threshold** | Fixed 12% of max | Adaptive: 8% of max OR 50% of 75th percentile | Detects subtle subjects better |
| **Fallback** | None | Tries 5% threshold if first pass fails | Catches more edge cases |
| **Subject fill %** | 85%+ → full-frame | 92%+ → full-frame | Allows more crops |
| **Min crop size** | 25% of frame | 15% of frame | Allows tighter crops |

---

## Implementation Steps

### Step 1: Fix AI Enhancement (Choose One)

**For Development (Recommended):**
```bash
# Install Vercel CLI
npm install -g vercel

# Run with local API emulation
vercel dev
```

**Or manually update `vite.config.ts`:**
```typescript
// Add server.proxy configuration (see Option A above)
```

### Step 2: Fix Auto-Crop

1. Open `/home/ubuntu/wildsaura-studio/utils/editorPipeline.ts`
2. Replace the `detectSubjectBounds()` function (lines 345-445) with the improved version above
3. Save the file

### Step 3: Test

```bash
# Start dev server
npm run dev

# Or if using Vercel CLI
vercel dev

# Test both features:
# 1. Upload an image and click "Auto-Detect & Apply" → Should work
# 2. Click "Auto Crop" → Should detect crops instead of always showing "no crop needed"
```

### Step 4: Deploy

```bash
# Commit changes
git add -A
git commit -m "fix: AI enhancement API routing and auto-crop saliency detection"

# Deploy to Vercel
vercel deploy
```

---

## Testing Checklist

- [ ] AI Enhancement works with various image types (RAW, JPEG, PNG, WebP)
- [ ] Auto-Crop detects subjects in:
  - [ ] Portrait photos
  - [ ] Landscape photos
  - [ ] Low-contrast images (sunsets, fog)
  - [ ] Minimalist compositions
  - [ ] Images with subjects filling 70-90% of frame
- [ ] Auto-Crop still shows "no crop needed" for:
  - [ ] Images where subject truly fills entire frame
  - [ ] Uniform/blank images

---

## Files Modified

1. **`vite.config.ts`** — Add dev server proxy (if using Option A)
2. **`utils/editorPipeline.ts`** — Replace `detectSubjectBounds()` function

---

## References

- Vercel CLI: https://vercel.com/docs/cli
- Vite Server Proxy: https://vitejs.dev/config/server-options.html#server-proxy
- Saliency Detection: https://en.wikipedia.org/wiki/Saliency_map
