import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { ScheduleEvent, TripPlan } from '../../types/tripPlan'
import 'leaflet/dist/leaflet.css'

const eventColors: Record<string, string> = {
  CURRENT_LOCATION: '#e06b48',
  PICKUP: '#276fbf',
  DROPOFF: '#142b2e',
  FUEL: '#e06b48',
  BREAK_30_MIN: '#7856a8',
  DAILY_REST_10_HOUR: '#0b5d65',
  CYCLE_RESTART_34_HOUR: '#9c3f54',
}

function FitRoute({ plan, selectedId }: { plan: TripPlan; selectedId: string | null }) {
  const map = useMap()
  useEffect(() => {
    const points = plan.route_legs.flatMap((leg) => leg.geometry.map((p) => L.latLng(p.latitude, p.longitude)))
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [28, 28] })
  }, [map, plan])
  useEffect(() => {
    const selected = plan.stops.find((stop) => stop.id === selectedId)
    if (selected?.coordinate) map.panTo([selected.coordinate.latitude, selected.coordinate.longitude])
  }, [map, plan, selectedId])
  return null
}

export function RouteMap({
  plan,
  selectedId,
  onSelect,
}: {
  plan: TripPlan
  selectedId: string | null
  onSelect: (event: ScheduleEvent) => void
}) {
  const center = plan.locations[0]?.coordinate ?? { latitude: 39.8, longitude: -98.5 }
  const timezone = plan.daily_logs[0]?.timezone
  return (
    <section aria-labelledby="route-map-title">
      <h2 id="route-map-title" className="sr-only">
        Interactive route map
      </h2>
      <MapContainer center={[center.latitude, center.longitude]} zoom={5} scrollWheelZoom={false} className="route-map">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {plan.route_legs.map((leg, index) => (
          <Polyline
            key={leg.id}
            positions={leg.geometry.map((p) => [p.latitude, p.longitude])}
            pathOptions={{ color: index ? '#e06b48' : '#0b5d65', weight: 5, opacity: 0.86 }}
          />
        ))}
        <CircleMarker
          center={[center.latitude, center.longitude]}
          radius={8}
          pathOptions={{ color: '#fffaf7', weight: 3, fillColor: eventColors.CURRENT_LOCATION, fillOpacity: 1 }}
        >
          <Popup>
            <strong>Current location</strong>
            <br />
            {plan.locations[0]?.label}
          </Popup>
        </CircleMarker>
        {plan.stops
          .filter((stop) => stop.coordinate)
          .map((stop) => (
            <CircleMarker
              key={stop.id}
              center={[stop.coordinate!.latitude, stop.coordinate!.longitude]}
              radius={selectedId === stop.id ? 11 : 8}
              pathOptions={{
                color: '#fffaf7',
                weight: 3,
                fillColor: eventColors[stop.event_type] || '#142b2e',
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelect(stop) }}
            >
              <Popup>
                <strong>{stop.event_type.replaceAll('_', ' ')}</strong>
                <br />
                {stop.display_location}
                <br />
                {new Date(stop.start_at).toLocaleString([], { timeZone: timezone })} -{' '}
                {new Date(stop.end_at).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: timezone,
                })}
                <br />
                {stop.duration_minutes} minutes
                <br />
                {stop.reason}
              </Popup>
            </CircleMarker>
          ))}
        <FitRoute plan={plan} selectedId={selectedId} />
      </MapContainer>
      <div className="map-legend" aria-label="Map legend">
        {Object.entries(eventColors).map(([label, color]) => (
          <span key={label}>
            <i style={{ background: color }} />
            {label.replaceAll('_', ' ').toLowerCase()}
          </span>
        ))}
      </div>
    </section>
  )
}
