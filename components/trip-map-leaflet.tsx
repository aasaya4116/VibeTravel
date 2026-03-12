"use client"

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

export interface GeocodedPlace {
  name: string
  lat: number
  lng: number
  dayIndex: number
  time?: string
}

const DAY_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#eab308"]

function createMarkerIcon(dayIndex: number, label: string) {
  const color = DAY_COLORS[dayIndex % DAY_COLORS.length]
  return L.divIcon({
    html: `<div style="
      background:${color};
      width:28px;height:28px;
      border-radius:50%;
      border:2.5px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:700;color:white;line-height:1;
      font-family:system-ui,sans-serif;
    ">${label}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -18],
  })
}

/** Imperatively fits the map bounds whenever the visible places change */
function FitBounds({ places }: { places: GeocodedPlace[] }) {
  const map = useMap()
  useEffect(() => {
    if (places.length === 0) return
    if (places.length === 1) {
      map.setView([places[0].lat, places[0].lng], 15)
      return
    }
    const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [places, map])
  return null
}

interface LeafletMapProps {
  places: GeocodedPlace[]
}

export function LeafletMap({ places }: LeafletMapProps) {
  if (places.length === 0) return null

  return (
    <MapContainer
      center={[places[0].lat, places[0].lng]}
      zoom={13}
      style={{ height: "400px", width: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds places={places} />
      {places.map((place, i) => (
        <Marker
          key={`${place.name}-${i}`}
          position={[place.lat, place.lng]}
          icon={createMarkerIcon(place.dayIndex, String.fromCharCode(65 + (i % 26)))}
        >
          <Popup>
            <div style={{ minWidth: "130px", fontFamily: "system-ui, sans-serif" }}>
              <strong style={{ fontSize: "13px", display: "block", marginBottom: "3px" }}>
                {place.name}
              </strong>
              {place.time && (
                <div style={{ fontSize: "11px", color: "#555" }}>{place.time}</div>
              )}
              <div style={{ fontSize: "11px", color: "#888", marginTop: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{
                  display: "inline-block",
                  width: "8px", height: "8px",
                  borderRadius: "50%",
                  background: DAY_COLORS[place.dayIndex % DAY_COLORS.length],
                }} />
                Day {place.dayIndex + 1}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
