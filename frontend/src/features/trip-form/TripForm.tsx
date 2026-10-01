import { zodResolver } from '@hookform/resolvers/zod'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import MapIcon from '@mui/icons-material/Map'
import RouteIcon from '@mui/icons-material/Route'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError, autocompleteLocations, reverseGeocode } from '../../api/client'
import type { TripPlanRequest } from '../../types/tripPlan'
import { MapLocationPicker, type PinCoordinate } from './MapLocationPicker'

type LocationFieldName = 'current_location' | 'pickup_location' | 'dropoff_location'

const locationLabels: Record<LocationFieldName, string> = {
  current_location: 'Current location',
  pickup_location: 'Pickup',
  dropoff_location: 'Drop-off',
}

const DULLES_AIRPORT = 'Washington Dulles International Airport, Dulles, VA, USA'

const schema = z.object({
  current_location: z.string().trim().min(3, 'Enter a current location.'),
  pickup_location: z.string().trim().min(3, 'Enter a pickup location.'),
  dropoff_location: z.string().trim().min(3, 'Enter a drop-off location.'),
  current_cycle_used_hours: z.number().min(0).max(70),
  start_at: z.string().min(1),
  terminal_timezone: z.string().min(1),
  demo_mode: z.boolean(),
  driver_name: z.string().optional(),
  carrier_name: z.string().optional(),
  main_office_address: z.string().optional(),
  vehicle_number: z.string().optional(),
  trailer_number: z.string().optional(),
  shipping_document_number: z.string().optional(),
})

export function TripForm({
  onSubmit,
  loading,
  apiError,
  apiFieldErrors = {},
  initialValues,
}: {
  onSubmit: (data: TripPlanRequest) => void
  loading: boolean
  apiError: string | null
  apiFieldErrors?: Record<string, string[]>
  initialValues?: TripPlanRequest | null
}) {
  const defaults = useMemo<TripPlanRequest>(
    () => ({
      current_location: '',
      pickup_location: '',
      dropoff_location: '',
      current_cycle_used_hours: 0,
      start_at: '2026-10-05T06:00',
      terminal_timezone: 'America/Chicago',
      demo_mode: false,
      ...initialValues,
      ...(initialValues ? { start_at: initialValues.start_at.slice(0, 16) } : {}),
    }),
    [initialValues],
  )
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    setFocus,
    watch,
    formState: { errors },
  } = useForm<TripPlanRequest>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })
  const cycle = Number(watch('current_cycle_used_hours')) || 0
  const demoMode = watch('demo_mode')
  const [geoError, setGeoError] = useState<string | null>(null)
  const [offerDulles, setOfferDulles] = useState(false)
  const [pickerField, setPickerField] = useState<LocationFieldName | null>(null)
  useEffect(() => {
    const supported = new Set<keyof TripPlanRequest>([
      'current_location',
      'pickup_location',
      'dropoff_location',
      'current_cycle_used_hours',
      'start_at',
      'terminal_timezone',
      'driver_name',
      'carrier_name',
      'main_office_address',
      'vehicle_number',
      'trailer_number',
      'shipping_document_number',
    ])
    const fields = Object.entries(apiFieldErrors).filter(([name]) => supported.has(name as keyof TripPlanRequest))
    fields.forEach(([name, messages]) => {
      setError(name as keyof TripPlanRequest, { type: 'server', message: messages.join(' ') })
    })
    if (fields[0]) setFocus(fields[0][0] as keyof TripPlanRequest)
  }, [apiFieldErrors, setError, setFocus])
  const loadSample = () => {
    setValue('current_location', 'Chicago, IL')
    setValue('pickup_location', 'Denver, CO')
    setValue('dropoff_location', 'Los Angeles, CA')
    setValue('current_cycle_used_hours', 18)
    setValue('demo_mode', true)
  }
  const useLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('This browser does not provide location access.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setGeoError(null)
        setOfferDulles(false)
        try {
          setValue('current_location', await reverseGeocode(coords.latitude, coords.longitude), {
            shouldValidate: true,
          })
          setValue('demo_mode', false)
        } catch (error) {
          if (error instanceof ApiError && error.code === 'LOCATION_OUTSIDE_US') {
            setGeoError('Your detected location is outside the United States, which this FMCSA planning demo supports.')
            setOfferDulles(true)
          } else {
            setGeoError('Your location could not be converted to a supported US address. Enter it manually instead.')
          }
        }
      },
      () => {
        setOfferDulles(false)
        setGeoError('Location permission was denied. Enter your current location instead.')
      },
    )
  }
  const useDullesAirport = () => {
    setValue('current_location', DULLES_AIRPORT, { shouldValidate: true })
    setValue('demo_mode', false)
    setGeoError(null)
    setOfferDulles(false)
  }
  const usePinnedLocation = async (coordinate: PinCoordinate) => {
    if (!pickerField) return null
    try {
      const label = await reverseGeocode(coordinate.latitude, coordinate.longitude)
      setValue(pickerField, label, { shouldValidate: true })
      setValue('demo_mode', false)
      setGeoError(null)
      setOfferDulles(false)
      setPickerField(null)
      return null
    } catch (error) {
      if (error instanceof ApiError && error.code === 'LOCATION_OUTSIDE_US') {
        return 'That pin is outside the United States. Move it to a supported US location.'
      }
      return 'The pin could not be converted to an address. Move it or enter the address manually.'
    }
  }
  const offsetStart = (local: string, timezone: string) => {
    const probe = new Date(`${local}:00Z`)
    const zone =
      new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
        .formatToParts(probe)
        .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT-05:00'
    return `${local}:00${zone.replace('GMT', '')}`
  }
  return (
    <Box
      component="form"
      onSubmit={handleSubmit((value) =>
        onSubmit({ ...value, start_at: offsetStart(value.start_at, value.terminal_timezone) }),
      )}
      noValidate
      className="trip-form"
      aria-busy={loading}
    >
      <div className="form-intro">
        <span className="eyebrow">Plan a run</span>
        <Typography variant="h2">Three stops. One compliant timeline.</Typography>
        <Typography color="text.secondary">
          Enter US locations in route order and tell us how much of the 70-hour cycle is already used.
        </Typography>
      </div>
      {apiError && <Alert severity="error">{apiError}</Alert>}
      {loading && <LinearProgress aria-label="Planning progress" sx={{ mb: 2 }} />}
      {geoError && (
        <Alert
          severity="info"
          onClose={() => {
            setGeoError(null)
            setOfferDulles(false)
          }}
          action={
            offerDulles ? (
              <Button color="inherit" size="small" onClick={useDullesAirport}>
                Use Washington Dulles Airport
              </Button>
            ) : undefined
          }
        >
          {geoError}
        </Alert>
      )}
      <Stack spacing={2.25}>
        <div className="location-field">
          <span>01</span>
          <AddressField
            label="Current location"
            placeholder="Chicago, IL"
            value={watch('current_location')}
            demo={demoMode}
            error={errors.current_location?.message}
            inputRef={register('current_location').ref}
            onChange={(value) => setValue('current_location', value, { shouldValidate: true })}
          />
          <Button onClick={useLocation} startIcon={<MyLocationIcon />} aria-label="Use my current location">
            Locate
          </Button>
          <Button
            onClick={() => setPickerField('current_location')}
            startIcon={<MapIcon />}
            aria-label="Choose current location on map"
          >
            Map
          </Button>
        </div>
        <div className="location-field">
          <span>02</span>
          <AddressField
            label="Pickup"
            placeholder="Denver, CO"
            value={watch('pickup_location')}
            demo={demoMode}
            error={errors.pickup_location?.message}
            inputRef={register('pickup_location').ref}
            onChange={(value) => setValue('pickup_location', value, { shouldValidate: true })}
          />
          <Button
            onClick={() => setPickerField('pickup_location')}
            startIcon={<MapIcon />}
            aria-label="Choose pickup on map"
          >
            Map
          </Button>
        </div>
        <div className="location-field">
          <span>03</span>
          <AddressField
            label="Drop-off"
            placeholder="Los Angeles, CA"
            value={watch('dropoff_location')}
            demo={demoMode}
            error={errors.dropoff_location?.message}
            inputRef={register('dropoff_location').ref}
            onChange={(value) => setValue('dropoff_location', value, { shouldValidate: true })}
          />
          <Button
            onClick={() => setPickerField('dropoff_location')}
            startIcon={<MapIcon />}
            aria-label="Choose drop-off on map"
          >
            Map
          </Button>
        </div>
        <div>
          <TextField
            label="Current cycle used"
            type="number"
            inputProps={{ min: 0, max: 70, step: 0.25 }}
            error={!!errors.current_cycle_used_hours}
            helperText={
              errors.current_cycle_used_hours?.message ?? `${Math.max(0, 70 - cycle).toFixed(2)} hours remain`
            }
            {...register('current_cycle_used_hours', { valueAsNumber: true })}
          />
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (cycle / 70) * 100)}
            sx={{ mt: 1, maxWidth: 260, height: 7, borderRadius: 8 }}
          />
        </div>
      </Stack>
      <Accordion disableGutters elevation={0} sx={{ my: 2, bgcolor: 'transparent' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <strong>Trip and log options</strong>
        </AccordionSummary>
        <AccordionDetails>
          <div className="advanced-grid">
            <TextField
              label="Trip start"
              type="datetime-local"
              InputLabelProps={{ shrink: true }}
              {...register('start_at')}
              error={!!errors.start_at}
              helperText={errors.start_at?.message}
            />
            <TextField
              label="Home-terminal timezone"
              {...register('terminal_timezone')}
              error={!!errors.terminal_timezone}
              helperText={errors.terminal_timezone?.message}
            />
            <TextField
              label="Driver name"
              {...register('driver_name')}
              error={!!errors.driver_name}
              helperText={errors.driver_name?.message}
            />
            <TextField
              label="Carrier"
              {...register('carrier_name')}
              error={!!errors.carrier_name}
              helperText={errors.carrier_name?.message}
            />
            <TextField
              label="Main office address"
              {...register('main_office_address')}
              error={!!errors.main_office_address}
              helperText={errors.main_office_address?.message}
            />
            <TextField
              label="Tractor / vehicle"
              {...register('vehicle_number')}
              error={!!errors.vehicle_number}
              helperText={errors.vehicle_number?.message}
            />
            <TextField
              label="Trailer"
              {...register('trailer_number')}
              error={!!errors.trailer_number}
              helperText={errors.trailer_number?.message}
            />
            <TextField
              label="Shipping document"
              {...register('shipping_document_number')}
              error={!!errors.shipping_document_number}
              helperText={errors.shipping_document_number?.message}
            />
          </div>
        </AccordionDetails>
      </Accordion>
      <div className="form-actions">
        <Button variant="contained" size="large" type="submit" disabled={loading} startIcon={<RouteIcon />}>
          {loading ? 'Building route & logs…' : 'Build trip plan'}
        </Button>
        <Button type="button" onClick={loadSample} disabled={loading}>
          Load sample trip
        </Button>
      </div>
      <MapLocationPicker
        open={pickerField !== null}
        title={pickerField ? locationLabels[pickerField] : 'Location'}
        onClose={() => setPickerField(null)}
        onConfirm={usePinnedLocation}
      />
    </Box>
  )
}

export function AddressField({
  label,
  placeholder,
  value,
  demo,
  error,
  inputRef,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  demo: boolean
  error?: string
  inputRef?: (instance: HTMLInputElement | null) => void
  onChange: (value: string) => void
}) {
  const [options, setOptions] = useState<string[]>([])
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      autocompleteLocations(value, demo, controller.signal)
        .then(setOptions)
        .catch(() => {
          if (!controller.signal.aborted) setOptions([])
        })
    }, 350)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [value, demo])
  return (
    <Autocomplete
      freeSolo
      fullWidth
      options={options}
      inputValue={value}
      onInputChange={(_, next) => onChange(next)}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          error={!!error}
          helperText={error ?? 'US locations only'}
          inputRef={inputRef}
        />
      )}
    />
  )
}
