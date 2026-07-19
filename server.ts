import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const PORT = 3000;
const app = express();

app.use(express.json());

// Initialize Gemini SDK with telemetry user-agent
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", hasApiKey: Boolean(apiKey) });
});

// Chat completion with maps-related function calling and Search grounding
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request payload. Expected 'messages' array." });
    }

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is not configured. Please check your Secrets in AI Studio Settings."
      });
    }

    // Call Gemini API
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: messages,
      config: {
        systemInstruction: `You are an intelligent, helpful interactive map assistant. You can help users explore any place, find highly-rated spots, get driving/walking/transit directions, and answer location-specific questions with the help of the interactive map.

Your primary superpower is that you can actively interact with the user's map using your tools:
- Use 'focus_on_location(address)' to fly/center the map to any specific city, landmark, or location the user asks about or wants to explore.
- Use 'show_places_on_map(query, category)' to search and place custom markers on the map. This is perfect when they ask for recommendations like 'pizza near me', 'coffee shops', 'museums in London', etc. Use specific categories when possible (e.g., 'restaurant', 'cafe', 'museum', 'tourist_attraction', 'park', etc.).
- Use 'get_directions(origin, destination, travelMode)' to calculate and draw a path on the map for DRIVING, WALKING, BICYCLING, or TRANSIT.
- Use 'clear_map_markers()' to reset the map and start fresh if asked or when starting a completely different exploration.

You also have Google Search Grounding to find up-to-date real-time details about events, restaurants, operating hours, news, or reviews for places. Always use this search grounding to give accurate, detailed and current answers.

When replying:
- If you invoke a tool, explain to the user in a friendly way what you are doing (e.g. 'I am centering the map on San Francisco and searching for top-rated coffee shops...').
- Keep your tone conversational, elegant, and descriptive.
- Do not make up places or routes if you are unsure; use your search tool or ask for clarification.`,
        tools: [
          { googleSearch: {} },
          {
            functionDeclarations: [
              {
                name: "focus_on_location",
                description: "Fly/center the map to a specific location, city, address, or point of interest.",
                parameters: {
                  type: "OBJECT" as any,
                  properties: {
                    address: {
                      type: "STRING" as any,
                      description: "The name of the location, address, or landmark (e.g., 'Central Park, NY', 'Tokyo', 'Eiffel Tower')."
                    }
                  },
                  required: ["address"]
                }
              },
              {
                name: "show_places_on_map",
                description: "Search for points of interest, businesses, or specific places and show markers on the map around the current view.",
                parameters: {
                  type: "OBJECT" as any,
                  properties: {
                    query: {
                      type: "STRING" as any,
                      description: "The search query (e.g., 'highly-rated sushi', 'boutique hotels', 'parks')."
                    },
                    category: {
                      type: "STRING" as any,
                      description: "Optional broad category of places (e.g., 'restaurant', 'cafe', 'bar', 'tourist_attraction', 'park', 'museum', 'shopping')."
                    }
                  },
                  required: ["query"]
                }
              },
              {
                name: "get_directions",
                description: "Calculate and display routes/directions between two locations.",
                parameters: {
                  type: "OBJECT" as any,
                  properties: {
                    origin: {
                      type: "STRING" as any,
                      description: "The starting address or location name."
                    },
                    destination: {
                      type: "STRING" as any,
                      description: "The ending address or location name."
                    },
                    travelMode: {
                      type: "STRING" as any,
                      description: "The mode of transit: 'DRIVING', 'WALKING', 'BICYCLING', or 'TRANSIT'.",
                      enum: ["DRIVING", "WALKING", "BICYCLING", "TRANSIT"]
                    }
                  },
                  required: ["origin", "destination", "travelMode"]
                }
              },
              {
                name: "clear_map_markers",
                description: "Clear all current markers, routes, and custom elements from the map to start fresh.",
                parameters: {
                  type: "OBJECT" as any,
                  properties: {}
                }
              }
            ]
          }
        ],
        toolConfig: { includeServerSideToolInvocations: true }
      }
    });

    // Check for function calls
    const functionCalls = response.functionCalls || null;
    const text = response.text || "";

    // Extract search grounding metadata if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || null;
    const groundingMetadata = groundingChunks ? groundingChunks.map((chunk: any) => ({
      title: chunk.web?.title || "",
      uri: chunk.web?.uri || ""
    })).filter((c: any) => c.title && c.uri) : [];

    res.json({
      text,
      functionCalls,
      groundingMetadata
    });

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: error.message || "An error occurred while communicating with Gemini." });
  }
});

// Serve frontend build or mount Vite dev server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server mounted.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Serving static production assets from /dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
