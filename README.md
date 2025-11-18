# NanoBanana Studio

A modern, AI-powered image editor alternative to Photoshop/Photopea, powered by Google's nanobanana API from fal.ai.

![NanoBanana Studio Screenshot](./screenshot.png)

## Features

- 🎨 **AI-Powered Image Editing**: Edit images using natural language prompts
- ✨ **Image Generation**: Generate new images from text descriptions
- 🖼️ **Intuitive UI**: Clean, modern interface inspired by professional image editors
- ⚡ **Fast Processing**: Leverages Google's Gemini 2.5 Flash Image model
- 💾 **Easy Export**: Download your edited images with one click

## Prerequisites

- Node.js 18+ and npm
- A fal.ai API key ([Get one here](https://fal.ai))

## Installation

1. Clone the repository and install dependencies:

```bash
npm run install:all
```

2. Set up your environment variables:

```bash
cd backend
cp env.example .env
```

Edit `backend/.env` and add your fal.ai API key:

```
FAL_API_KEY=your_fal_ai_api_key_here
PORT=3001
```

**Note:** Get your fal.ai API key from [fal.ai](https://fal.ai). You'll need to sign up and create an API key in your dashboard.

## Running the Application

Start both frontend and backend in development mode:

```bash
npm run dev
```

- Frontend will be available at: http://localhost:3000
- Backend API will be available at: http://localhost:3001

## Usage

### Edit Mode

1. Click "Upload Image" to select an image file
2. Enter a natural language prompt describing the edits you want (e.g., "make the sky more dramatic", "add a sunset", "remove the background")
3. Optionally add a negative prompt to exclude unwanted elements
4. Click "Edit Image" and wait for processing
5. Download your edited image

### Generate Mode

1. Switch to "Generate" mode
2. Enter a detailed prompt describing the image you want to create
3. Optionally add a negative prompt
4. Click "Generate Image"
5. Download the generated image

## API Configuration

**Important:** The application uses fal.ai's nanobanana API. The endpoint URL in `backend/server.js` is set to `https://fal.run/fal-ai/nanobanana`. If fal.ai uses a different endpoint format, you may need to update the URL in the server code.

To verify the correct endpoint:
1. Check the [fal.ai documentation](https://fal.ai/models)
2. Look for the nanobanana model endpoint
3. Update the fetch URL in `backend/server.js` if needed

## API Endpoints

### POST `/api/edit-image`

Edit an existing image using AI.

**Request:**
- `image` (file): Image file to edit
- `prompt` (string): Natural language editing instructions
- `negativePrompt` (string, optional): Things to avoid in the edit

**Response:**
```json
{
  "images": [{"url": "data:image/..."}]
}
```

### POST `/api/generate-image`

Generate a new image from text.

**Request:**
```json
{
  "prompt": "a beautiful landscape...",
  "negativePrompt": "blurry, low quality",
  "width": 1024,
  "height": 1024
}
```

**Response:**
```json
{
  "images": [{"url": "data:image/..."}]
}
```

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **AI**: Google nanobanana via fal.ai
- **UI**: Custom CSS with modern design

## Project Structure

```
nanobanana-studio/
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── App.tsx    # Main application component
│   │   ├── api.ts     # API client functions
│   │   ├── types.ts   # TypeScript type definitions
│   │   ├── utils.ts   # Utility functions
│   │   ├── App.css    # Styles
│   │   └── ...
│   └── package.json
├── backend/           # Express backend server
│   ├── server.js      # API server with validation & error handling
│   ├── env.example    # Environment variables template
│   └── package.json
├── package.json       # Root package.json
├── README.md          # Full documentation
└── SETUP.md          # Quick setup guide
```

## Code Quality Features

- **TypeScript**: Full type safety on frontend
- **Error Handling**: Comprehensive error handling on both frontend and backend
- **Validation**: Input validation for images, prompts, and parameters
- **API Timeout**: 120-second timeout for API requests
- **File Validation**: Type and size validation for uploaded images
- **Logging**: Structured logging for debugging
- **Security**: File type validation, size limits, and input sanitization

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

