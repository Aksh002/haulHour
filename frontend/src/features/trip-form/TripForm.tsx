import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Info, LocateFixed, MapPinned, Route, TriangleAlert, X } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ApiError, autocompleteLocations, reverseGeocode } from '../../api/client'
import type { Coordinate, TripPlanRequest } from '../../types/tripPlan'
import { MapLocationPicker, type PinCoordinate } from './MapLocationPicker'

type LocationFieldName = 'current_location' | 'pickup_location' | 'dropoff_location'
type LocationCoordinates = Partial<Record<LocationFieldName, Coordinate>>

const locationLabels: Record<LocationFieldName, string> = {
  current_location: 'Current location',
  pickup_location: 'Pickup',
  dropoff_location: 'Drop-off',
}

const DULLES_AIRPORT = 'Washington Dulles International Airport, Dulles, VA, USA'
const DULLES_COORDINATE = { latitude: 38.9531, longitude: -77.4565 }

const coordinatesFrom = (values?: TripPlanRequest | null): LocationCoordinates => ({
  ...(values?.current_location_coordinate ? { current_location: values.current_location_coordinate } : {}),
  ...(values?.pickup_location_coordinate ? { pickup_location: values.pickup_location_coordinate } : {}),
  ...(values?.dropoff_location_coordinate ? { dropoff_location: values.dropoff_location_coordinate } : {}),
})

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
  const [locationCoordinates, setLocationCoordinates] = useState<LocationCoordinates>(() =>
    coordinatesFrom(initialValues),
  )
  useEffect(() => setLocationCoordinates(coordinatesFrom(initialValues)), [initialValues])
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
    setLocationCoordinates({})
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
          setLocationCoordinates((current) => ({ ...current, current_location: coords }))
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
    setLocationCoordinates((current) => ({ ...current, current_location: DULLES_COORDINATE }))
    setValue('demo_mode', false)
    setGeoError(null)
    setOfferDulles(false)
  }
  const usePinnedLocation = async (coordinate: PinCoordinate) => {
    if (!pickerField) return null
    try {
      const label = await reverseGeocode(coordinate.latitude, coordinate.longitude)
      setValue(pickerField, label, { shouldValidate: true })
      setLocationCoordinates((current) => ({ ...current, [pickerField]: coordinate }))
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
  const updateLocationText = (field: LocationFieldName, value: string) => {
    setValue(field, value, { shouldValidate: true })
    setLocationCoordinates((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }
  return (
    <form
      onSubmit={handleSubmit((value) =>
        onSubmit({
          ...value,
          start_at: offsetStart(value.start_at, value.terminal_timezone),
          ...(locationCoordinates.current_location
            ? { current_location_coordinate: locationCoordinates.current_location }
            : {}),
          ...(locationCoordinates.pickup_location
            ? { pickup_location_coordinate: locationCoordinates.pickup_location }
            : {}),
          ...(locationCoordinates.dropoff_location
            ? { dropoff_location_coordinate: locationCoordinates.dropoff_location }
            : {}),
        }),
      )}
      noValidate
      className="trip-form"
      aria-busy={loading}
    >
      <div className="form-intro">
        <span className="form-label">Plan a run</span>
        <h2>Three stops. One compliant timeline.</h2>
        <p>Enter US locations in route order and tell us how much of the 70-hour cycle is already used.</p>
      </div>
      {apiError && (
        <Alert variant="destructive" className="app-alert">
          <TriangleAlert />
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}
      {loading && (
        <div className="planning-loader" role="progressbar" aria-label="Planning progress">
          <span />
        </div>
      )}
      {geoError && (
        <Alert className="app-alert info dismissible">
          <Info />
          <AlertDescription>{geoError}</AlertDescription>
          <AlertAction>
            {offerDulles && (
              <Button type="button" variant="ghost" size="sm" onClick={useDullesAirport}>
                Use Washington Dulles Airport
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss location message"
              onClick={() => {
                setGeoError(null)
                setOfferDulles(false)
              }}
            >
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}
      <div className="form-stack">
        <div className="location-field">
          <span>01</span>
          <AddressField
            label="Current location"
            placeholder="Chicago, IL"
            value={watch('current_location')}
            demo={demoMode}
            error={errors.current_location?.message}
            inputRef={register('current_location').ref}
            onChange={(value) => updateLocationText('current_location', value)}
          />
          <Button
            type="button"
            variant="ghost"
            className="location-action"
            onClick={useLocation}
            aria-label="Use my current location"
          >
            <LocateFixed data-icon="inline-start" />
            Locate
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="location-action"
            onClick={() => setPickerField('current_location')}
            aria-label="Choose current location on map"
          >
            <MapPinned data-icon="inline-start" />
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
            onChange={(value) => updateLocationText('pickup_location', value)}
          />
          <Button
            type="button"
            variant="ghost"
            className="location-action"
            onClick={() => setPickerField('pickup_location')}
            aria-label="Choose pickup on map"
          >
            <MapPinned data-icon="inline-start" />
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
            onChange={(value) => updateLocationText('dropoff_location', value)}
          />
          <Button
            type="button"
            variant="ghost"
            className="location-action"
            onClick={() => setPickerField('dropoff_location')}
            aria-label="Choose drop-off on map"
          >
            <MapPinned data-icon="inline-start" />
            Map
          </Button>
        </div>
        <div>
          <Field data-invalid={!!errors.current_cycle_used_hours} className="cycle-field">
            <FieldLabel htmlFor="current-cycle-used">Current cycle used</FieldLabel>
            <Input
              id="current-cycle-used"
              type="number"
              min={0}
              max={70}
              step={0.25}
              aria-invalid={!!errors.current_cycle_used_hours}
              {...register('current_cycle_used_hours', { valueAsNumber: true })}
            />
            {errors.current_cycle_used_hours ? (
              <FieldError errors={[errors.current_cycle_used_hours]} />
            ) : (
              <FieldDescription>{Math.max(0, 70 - cycle).toFixed(2)} hours remain</FieldDescription>
            )}
            <Progress value={Math.min(100, (cycle / 70) * 100)} aria-label="Cycle hours used" />
          </Field>
        </div>
      </div>
      <Accordion type="single" collapsible className="trip-options">
        <AccordionItem value="trip-options">
          <AccordionTrigger>Trip and log options</AccordionTrigger>
          <AccordionContent>
            <div className="advanced-grid">
              <Field data-invalid={!!errors.start_at}>
                <FieldLabel htmlFor="trip-start">Trip start</FieldLabel>
                <Input
                  id="trip-start"
                  type="datetime-local"
                  aria-invalid={!!errors.start_at}
                  {...register('start_at')}
                />
                <FieldError errors={[errors.start_at]} />
              </Field>
              <Field data-invalid={!!errors.terminal_timezone}>
                <FieldLabel htmlFor="terminal-timezone">Home-terminal timezone</FieldLabel>
                <Input
                  id="terminal-timezone"
                  aria-invalid={!!errors.terminal_timezone}
                  {...register('terminal_timezone')}
                />
                <FieldError errors={[errors.terminal_timezone]} />
              </Field>
              <Field data-invalid={!!errors.driver_name}>
                <FieldLabel htmlFor="driver-name">Driver name</FieldLabel>
                <Input id="driver-name" aria-invalid={!!errors.driver_name} {...register('driver_name')} />
                <FieldError errors={[errors.driver_name]} />
              </Field>
              <Field data-invalid={!!errors.carrier_name}>
                <FieldLabel htmlFor="carrier-name">Carrier</FieldLabel>
                <Input id="carrier-name" aria-invalid={!!errors.carrier_name} {...register('carrier_name')} />
                <FieldError errors={[errors.carrier_name]} />
              </Field>
              <Field data-invalid={!!errors.main_office_address}>
                <FieldLabel htmlFor="office-address">Main office address</FieldLabel>
                <Input
                  id="office-address"
                  aria-invalid={!!errors.main_office_address}
                  {...register('main_office_address')}
                />
                <FieldError errors={[errors.main_office_address]} />
              </Field>
              <Field data-invalid={!!errors.vehicle_number}>
                <FieldLabel htmlFor="vehicle-number">Tractor / vehicle</FieldLabel>
                <Input id="vehicle-number" aria-invalid={!!errors.vehicle_number} {...register('vehicle_number')} />
                <FieldError errors={[errors.vehicle_number]} />
              </Field>
              <Field data-invalid={!!errors.trailer_number}>
                <FieldLabel htmlFor="trailer-number">Trailer</FieldLabel>
                <Input id="trailer-number" aria-invalid={!!errors.trailer_number} {...register('trailer_number')} />
                <FieldError errors={[errors.trailer_number]} />
              </Field>
              <Field data-invalid={!!errors.shipping_document_number}>
                <FieldLabel htmlFor="shipping-document">Shipping document</FieldLabel>
                <Input
                  id="shipping-document"
                  aria-invalid={!!errors.shipping_document_number}
                  {...register('shipping_document_number')}
                />
                <FieldError errors={[errors.shipping_document_number]} />
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="form-actions">
        <Button size="lg" type="submit" disabled={loading}>
          <Route data-icon="inline-start" />
          {loading ? 'Building route & logs…' : 'Build trip plan'}
        </Button>
        <Button variant="ghost" type="button" onClick={loadSample} disabled={loading}>
          Load sample trip
        </Button>
      </div>
      <MapLocationPicker
        open={pickerField !== null}
        title={pickerField ? locationLabels[pickerField] : 'Location'}
        onClose={() => setPickerField(null)}
        onConfirm={usePinnedLocation}
      />
    </form>
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
  const inputId = useId()
  const listboxId = `${inputId}-options`
  const [options, setOptions] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (value.trim().length < 2) {
      setOptions([])
      setOpen(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      autocompleteLocations(value, demo, controller.signal)
        .then((nextOptions) => {
          setOptions(nextOptions)
          setOpen(nextOptions.length > 0)
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setOptions([])
            setOpen(false)
          }
        })
    }, 350)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [value, demo])

  const chooseOption = (option: string) => {
    onChange(option)
    setOptions([])
    setOpen(false)
  }

  return (
    <Field className="address-field" data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div className="address-combobox">
        <Input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-invalid={Boolean(error)}
          aria-describedby={`${inputId}-help`}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setOpen(options.length > 0)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
          }}
        />
        {open && options.length > 0 ? (
          <div id={listboxId} className="address-options" role="listbox">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(option)}
              >
                <MapPinned aria-hidden="true" />
                <span>{option}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {error ? (
        <FieldError id={`${inputId}-help`}>{error}</FieldError>
      ) : (
        <FieldDescription id={`${inputId}-help`}>US locations only</FieldDescription>
      )}
    </Field>
  )
}
