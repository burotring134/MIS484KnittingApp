# Threadia

AI-powered cross-stitch pattern generator. Upload a photo and get a printable
grid mapped to real DMC thread colours — on the web or on mobile.

## Features

- AI image stylisation via `fal.ai` before pattern extraction
- K-means colour quantisation down to a user-defined palette size
- Nearest-neighbour mapping to the full DMC thread catalogue
- Unicode symbol assignment per colour for chart-style printing
- Interactive grid with zoom, grid-line toggle, colour highlighting, and PNG export
- React web client and Expo (React Native) mobile client sharing one backend

## Project structure

```
threadia/
├── backend/      Express API: upload, fal.ai, quantisation, DMC mapping
├── frontend/     Vite + React + Tailwind web client
├── mobile/       Expo / React Native client
└── package.json  Monorepo scripts (backend + frontend dev)
```

## Requirements

- Node.js 18 or newer
- A `fal.ai` API key (free tier works for testing)
- For mobile: Expo Go on a physical device, or an iOS/Android simulator

## Setup

1. Clone the repo and install all dependencies:

   ```bash
   npm run install:all
   cd mobile && npm install && cd ..
   ```

2. Create a `.env` file in the project root:

   ```
   FALL_API_KEY=your_fal_ai_key_here
   PORT=5001
   ```

## Running

### Web (backend + frontend together)

```bash
npm run dev
```

- Backend: http://localhost:5001
- Frontend: http://localhost:3000 (proxied to the backend under `/api`)

### Mobile

1. Start the backend from the project root:

   ```bash
   npm run dev --prefix backend
   ```

2. Open `mobile/config.js` and point `API_BASE` at a URL your phone can reach
   (your LAN IP, e.g. `http://192.168.1.33:5001`, or an ngrok tunnel).

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
| `gridSize`  | number  | Grid width in cells (e.g. 30–100)    |
| `numColors` | number  | Palette size (e.g. 5–30)             |

Response:

```json
{
  "width": 50,
  "height": 50,
  "grid": [[0, 1, 2, ...], ...],
  "colors": [
    { "id": 0, "hex": "#aabbcc", "dmcCode": "310", "dmcName": "Black",
      "dmcHex": "#000000", "symbol": "■", "count": 1234 }
  ]
}
```

`GET /health` — liveness probe.

## How the pipeline works

1. The uploaded image is sent to `fal.ai` storage and restyled for cleaner
   colour blocks. On failure the original image is used as a fallback.
2. `sharp` resizes the image to the requested grid dimensions.
3. K-means quantisation reduces the image to the requested palette size.
4. Each palette colour is mapped to the nearest DMC thread in RGB space.
5. Pixels, colours, and symbols are returned as a grid the clients render
   to a canvas (web) or SVG (mobile).

## Scripts

Root:

- `npm run install:all` — install backend + frontend
- `npm run dev` — run backend and frontend in watch mode
- `npm start` — run backend (prod) and frontend (dev)

Backend (`backend/`):

- `npm run dev` — `nodemon server.js`
- `npm start` — `node server.js`

Frontend (`frontend/`):

- `npm run dev` — Vite dev server on port 3000
- `npm run build` — production build
- `npm run preview` — preview the production build

Mobile (`mobile/`):

- `npm start` — `expo start`
- `npm run ios` / `npm run android`

## Tech stack

- **Backend:** Node.js, Express, Multer, Sharp, `@fal-ai/client`
- **Frontend:** React 18, Vite, Tailwind CSS
- **Mobile:** Expo, React Native, `react-native-svg`, `expo-image-picker`

## Notes

- Mobile devices cannot reach `localhost` on your development machine. Use
  a LAN IP or an ngrok tunnel in `mobile/config.js`.
- The `.env` file is read from the project root, not from `backend/`.
