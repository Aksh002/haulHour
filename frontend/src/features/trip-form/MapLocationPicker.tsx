import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export interface PinCoordinate {
  latitude: number
  longitude: number
}

const US_CENTER: PinCoordinate = { latitude: 39.8283, longitude: -98.5795 }

function MapInteractions({ onChange }: { onChange: (coordinate: PinCoordinate) => void }) {
  useMapEvents({
    click: ({ latlng }) => onChange({ latitude: latlng.lat, longitude: latlng.lng }),
  })
  return null
}

function ResizeMap({ open }: { open: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => map.invalidateSize(), 100)
    return () => window.clearTimeout(timer)
  }, [map, open])
  return null
}

export function MapLocationPicker({
  open,
  title,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  onClose: () => void
  onConfirm: (coordinate: PinCoordinate) => Promise<string | null>
}) {
  const [coordinate, setCoordinate] = useState<PinCoordinate>(US_CENTER)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setCoordinate(US_CENTER)
      setError(null)
    }
  }, [open])
  const icon = useMemo(
    () =>
      L.divIcon({
        className: 'location-pin-wrap',
        html: '<span class="location-pin" aria-hidden="true"></span>',
        iconSize: [30, 38],
        iconAnchor: [15, 36],
      }),
    [],
  )
  const confirm = async () => {
    setResolving(true)
    try {
      setError(await onConfirm(coordinate))
    } finally {
      setResolving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="map-picker-dialog">
        <DialogHeader>
          <DialogTitle>Choose {title.toLowerCase()} on the map</DialogTitle>
          <DialogDescription>
            US locations only. Click the map or drag the pin to a facility entrance, then confirm the position.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert className="app-alert warning">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <MapContainer center={[US_CENTER.latitude, US_CENTER.longitude]} zoom={4} className="location-picker-map">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={[coordinate.latitude, coordinate.longitude]}
            draggable
            icon={icon}
            eventHandlers={{
              dragend: (event) => {
                const point = (event.target as L.Marker).getLatLng()
                setCoordinate({ latitude: point.lat, longitude: point.lng })
              },
            }}
          />
          <MapInteractions onChange={setCoordinate} />
          <ResizeMap open={open} />
        </MapContainer>
        <div className="coordinate-fields">
          <Field>
            <FieldLabel htmlFor="pin-latitude">Latitude</FieldLabel>
            <Input
              id="pin-latitude"
              type="number"
              value={coordinate.latitude}
              min={-90}
              max={90}
              step={0.0001}
              onChange={(event) => setCoordinate((current) => ({ ...current, latitude: Number(event.target.value) }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pin-longitude">Longitude</FieldLabel>
            <Input
              id="pin-longitude"
              type="number"
              value={coordinate.longitude}
              min={-180}
              max={180}
              step={0.0001}
              onChange={(event) => setCoordinate((current) => ({ ...current, longitude: Number(event.target.value) }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={resolving}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={resolving}>
            {resolving ? 'Checking US location…' : 'Use this position'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
