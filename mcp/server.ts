#!/usr/bin/env node
/**
 * Vibe Travel MCP Server
 * Exposes real travel data tools for Claude Code and the app.
 *
 * Usage (for Claude Code):  configure .mcp.json at project root
 * Usage (for testing):      npx tsx mcp/server.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

// Load env from .env.local if running directly
import { readFileSync } from "fs"
import { join } from "path"

try {
  const envPath = join(process.cwd(), ".env.local")
  const lines = readFileSync(envPath, "utf-8").split("\n")
  for (const line of lines) {
    const [key, ...rest] = line.split("=")
    if (key && rest.length > 0 && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join("=").trim()
    }
  }
} catch {
  // .env.local not found — env vars must be set externally
}

import {
  searchPlaces,
  searchPlacesBatch,
} from "../lib/travel-apis/google-places.js"
import { getWeatherForecast } from "../lib/travel-apis/openweather.js"
import { searchRestaurants, searchNearby } from "../lib/travel-apis/yelp.js"
import { searchTours } from "../lib/travel-apis/viator.js"
import { searchHotels } from "../lib/travel-apis/expedia.js"

const server = new McpServer({
  name: "vibe-travel",
  version: "1.0.0",
})

// ── Google Places ─────────────────────────────────────────────────────────────

server.tool(
  "search_attractions",
  "Search for real attraction details from Google Places. Returns rating, hours, accessibility, photos, and Maps link.",
  {
    query: z.string().describe("Attraction name or search query"),
    destination: z.string().describe("City or destination (e.g. 'Tokyo, Japan')"),
  },
  async ({ query, destination }) => {
    const result = await searchPlaces(query, destination)
    if (!result) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "No results found or Google Places API key not configured" }),
          },
        ],
      }
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    }
  }
)

server.tool(
  "search_attractions_batch",
  "Search Google Places for multiple attractions at once. Efficient for enriching a list of AI-generated attractions.",
  {
    attractions: z
      .array(z.object({ name: z.string(), destination: z.string() }))
      .describe("List of attraction name + destination pairs"),
  },
  async ({ attractions }) => {
    const results = await searchPlacesBatch(attractions)
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(Object.fromEntries(results), null, 2),
        },
      ],
    }
  }
)

// ── OpenWeather ───────────────────────────────────────────────────────────────

server.tool(
  "get_weather_forecast",
  "Get a day-by-day weather forecast for a destination over a date range. Useful for weather-aware itinerary planning.",
  {
    destination: z.string().describe("City name (e.g. 'Barcelona, Spain')"),
    startDate: z.string().describe("Start date in YYYY-MM-DD format"),
    endDate: z.string().describe("End date in YYYY-MM-DD format"),
  },
  async ({ destination, startDate, endDate }) => {
    const forecast = await getWeatherForecast(destination, startDate, endDate)
    if (!forecast) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Could not get forecast. Check OPENWEATHER_API_KEY or destination name.",
            }),
          },
        ],
      }
    }
    return {
      content: [{ type: "text", text: JSON.stringify(forecast, null, 2) }],
    }
  }
)

// ── Yelp ──────────────────────────────────────────────────────────────────────

server.tool(
  "search_restaurants",
  "Search Yelp for family-friendly restaurants in a destination. Supports dietary filters.",
  {
    destination: z.string().describe("City or neighborhood (e.g. 'Kyoto, Japan')"),
    query: z
      .string()
      .optional()
      .describe("Search term (e.g. 'ramen', 'pizza', 'vegan breakfast')"),
    dietary: z
      .array(z.string())
      .optional()
      .describe("Dietary restrictions (e.g. ['vegetarian', 'gluten-free'])"),
  },
  async ({ destination, query, dietary }) => {
    const results = await searchRestaurants(destination, query, dietary)
    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "No results. Check YELP_API_KEY or try a different query." }),
          },
        ],
      }
    }
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    }
  }
)

server.tool(
  "find_nearby_food",
  "Find top-rated food/cafe options near a destination using Yelp.",
  {
    destination: z.string(),
    query: z.string().describe("e.g. 'coffee shop', 'ice cream', 'quick lunch'"),
    limit: z.number().optional().default(5),
  },
  async ({ destination, query, limit }) => {
    const results = await searchNearby(destination, query, limit)
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    }
  }
)

// ── Viator ────────────────────────────────────────────────────────────────────

server.tool(
  "search_tours",
  "Search Viator for bookable tours, activities, and experiences. Good for finding guided tours, day trips, and experiences.",
  {
    destination: z.string().describe("City or region (e.g. 'Rome')"),
    query: z.string().optional().describe("Activity type (e.g. 'cooking class', 'museum tour')"),
    minChildAge: z.number().optional().describe("Minimum child age for filtering family-friendly tours"),
  },
  async ({ destination, query, minChildAge }) => {
    const results = await searchTours(destination, query, {
      minAge: minChildAge,
    })
    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "No tours found. Check VIATOR_API_KEY or try broader search." }),
          },
        ],
      }
    }
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    }
  }
)

// ── Expedia / Hotels.com ───────────────────────────────────────────────────────

server.tool(
  "search_hotels",
  "Search Hotels.com (via Expedia/RapidAPI) for available hotels. Returns price, rating, amenities.",
  {
    destination: z.string().describe("City name (e.g. 'Paris, France')"),
    checkin: z.string().describe("Check-in date YYYY-MM-DD"),
    checkout: z.string().describe("Check-out date YYYY-MM-DD"),
    budget: z
      .enum(["$", "$$", "$$$", "any"])
      .optional()
      .default("any")
      .describe("Budget tier to filter by star rating"),
    adults: z.number().optional().default(2),
    children: z.number().optional().default(0),
  },
  async ({ destination, checkin, checkout, budget, adults, children }) => {
    const results = await searchHotels(destination, checkin, checkout, budget, adults, children)
    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "No hotels found. Check EXPEDIA_RAPID_API_KEY or try different dates.",
            }),
          },
        ],
      }
    }
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    }
  }
)

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Vibe Travel MCP server running (stdio)")
}

main().catch((err) => {
  console.error("MCP server error:", err)
  process.exit(1)
})
