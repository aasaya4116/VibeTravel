"use client"

import { useEffect } from "react"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"
import type { DestinationBrowseCard } from "@/lib/destination-browse"
import "leaflet/dist/leaflet.css"

function destinationIcon(selected: boolean) {
  return L.divIcon({
    html: `<div class="destination-map-marker${selected ? " is-selected" : ""}"><span></span></div>`,
    className: "",
    iconSize: selected ? [44, 44] : [36, 36],
    iconAnchor: selected ? [22, 22] : [18, 18],
    popupAnchor: [0, -18],
  })
}

function FocusDestination({ destination }: { destination: DestinationBrowseCard }) {
  const map = useMap()

  useEffect(() => {
    map.flyTo([destination.latitude, destination.longitude], 4, {
      animate: true,
      duration: 0.8,
    })
  }, [destination, map])

  return null
}

interface DestinationMapLeafletProps {
  destinations: DestinationBrowseCard[]
  selected: DestinationBrowseCard
  onSelect: (destination: DestinationBrowseCard) => void
  onExplore: (destination: DestinationBrowseCard) => void
}

export function DestinationMapLeaflet({
  destinations,
  selected,
  onSelect,
  onExplore,
}: DestinationMapLeafletProps) {
  return (
    <MapContainer
      center={[24, 15]}
      zoom={2}
      minZoom={2}
      maxZoom={8}
      scrollWheelZoom={false}
      className="h-full min-h-[440px] w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FocusDestination destination={selected} />
      {destinations.map((destination) => (
        <Marker
          key={destination.name}
          position={[destination.latitude, destination.longitude]}
          icon={destinationIcon(selected.name === destination.name)}
          eventHandlers={{
            click: () => onSelect(destination),
          }}
        >
          <Popup>
            <div className="min-w-[210px] font-sans">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                Why it fits
              </p>
              <h3 className="mt-1 font-serif text-lg text-foreground">
                {destination.name}, {destination.country}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {destination.familyFitReason}
              </p>
              <button
                type="button"
                onClick={() => onExplore(destination)}
                className="mt-3 min-h-10 w-full rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
              >
                Explore {destination.name}
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

