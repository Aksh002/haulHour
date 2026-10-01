import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="map-picker-title">
      <DialogTitle id="map-picker-title">Choose {title.toLowerCase()} on the map</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          US locations only. Click the map or drag the pin to a facility entrance, then confirm the position.
        </Typography>
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
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
        <Box className="coordinate-fields">
          <TextField
            label="Latitude"
            type="number"
            value={coordinate.latitude}
            inputProps={{ min: -90, max: 90, step: 0.0001 }}
            onChange={(event) => setCoordinate((current) => ({ ...current, latitude: Number(event.target.value) }))}
          />
          <TextField
            label="Longitude"
            type="number"
            value={coordinate.longitude}
            inputProps={{ min: -180, max: 180, step: 0.0001 }}
            onChange={(event) => setCoordinate((current) => ({ ...current, longitude: Number(event.target.value) }))}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={resolving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={confirm} disabled={resolving}>
          {resolving ? 'Checking US location…' : 'Use this position'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
