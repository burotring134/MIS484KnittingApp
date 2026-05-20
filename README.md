# Threadia

AI-powered cross-stitch pattern generator. Upload a photo and get a printable
grid mapped to real DMC thread colours — on mobile.

## Features

- AI image stylisation via `fal.ai` before pattern extraction
- K-means colour quantisation down to a user-defined palette size (weighted, multi-restart)
- Nearest-neighbour mapping to the full DMC thread catalogue using DeltaE 2000
- Unicode symbol assignment per colour for chart-style printing
- Interactive grid on mobile with pinch-to-zoom, focus mode, drag-to-mark tracking, and PDF export
- Expo (React Native) mobile client backed by a Node.js Express + MongoDB backend

## Project structure

```
threadia/
├── backend/      Express API: upload, fal.ai, quantisation, DMC mapping, Mongo sync
├── mobile/       Expo / React Native client
└── package.json  Monorepo scripts (backend + mobile dev setup)
```

## Requirements

- Node.js 18 or newer
- MongoDB (running locally or Cloud Atlas)
- A `fal.ai` API key
- For mobile: Expo Go on a physical device, or an iOS/Android simulator

## Setup

1. Clone the repo and install all dependencies:

   ```bash
   npm run install:all
   ```

2. Create a `.env` file in the project root:

   ```
   FAL_KEY=your_fal_ai_key_here
   PORT=5001
   MONGO_URL=mongodb://localhost:27017/threadia
   ```

## Running

### 1. Backend

Start the backend from the project root:

```bash
npm run dev
```

- Backend: http://localhost:5001
- Health check: http://localhost:5001/health

### 2. Mobile

1. Make sure the backend is running.
2. Open `mobile/config.js` and set `API_BASE` to your local machine's IP (e.g. `http://192.168.1.33:5001` or an ngrok tunnel) for local testing.
3. Start Expo:

   ```bash
   cd mobile
   npm start
   ```

   Scan the QR code with Expo Go, or press `i` / `a` for a simulator.

## API

`POST /api/pattern` — multipart form

| Field       | Type    | Description                          |
|-------------|---------|--------------------------------------|
| `image`     | file    | JPG / PNG / WebP, up to 10 MB        |
| `gridSize`  | number  | Grid width in cells (e.g. 20–70)     |
| `numColors` | number  | Palette size (e.g. 4–40)             |
| `difficulty`| string  | `easy` / `medium` / `hard`           |

Response:

```json
{
  "width": 50,
  "height": 50,
  "grid": [[0, 1, 2, ...], ...],
  "colors": [
    { "id": 0, "hex": "#aabbcc", "dmcCode": "310", "dmcName": "Black",
      "dmcHex": "#000000", "symbol": "■", "count": 1234 }
  ],
  "difficulty": "medium",
  "imageDataUri": "data:image/png;base64,..."
}
```

`GET /api/projects` — Get synced projects list from MongoDB.

`POST /api/projects` — Upsert project metadata and state.

`DELETE /api/projects/:id` — Delete synced project.

`GET /health` — liveness probe.

## How the pipeline works

1. The uploaded image is sent to `fal.ai` storage and restyled for cleaner
   colour blocks. On failure the original image is used as a fallback.
2. `sharp` pre-processes orientation, boosts vibrance, and does a pyramid downsample to target grid dimensions.
3. Feature detection engages: Sobel edge magnitude, saturation, and local-darkness accents (e.g. teddy bear eyes) are weighted to guide K-means clustering.
4. Weighted K-means quantisation in Lab color space reduces the image to the requested palette size.
5. Centroids are greedy-matched to unique DMC threads using DeltaE 2000.
6. The grid and colors are mapped and returned, pre-rendering a themed chart PNG for immediate delivery.

## Scripts

Root:

- `npm run install:all` — install backend + mobile dependencies
- `npm run dev` — run backend in watch (nodemon) mode
- `npm start` — run backend in production mode

Backend (`backend/`):

- `npm run dev` — `nodemon server.js`
- `npm start` — `node server.js`

Mobile (`mobile/`):

- `npm start` — `expo start`
- `npm run ios` / `npm run android`

## Tech stack

- **Backend:** Node.js, Express, MongoDB (native driver), Multer, Sharp, `@fal-ai/client`
- **Mobile:** Expo, React Native, `react-native-svg`, `expo-image-picker`

## Notes

- Mobile devices cannot reach `localhost` on your development machine. Use
  a LAN IP or an ngrok tunnel in `mobile/config.js`.
- The `.env` file is read from the project root, not from `backend/`.
