import type { TripPlan, TripPlanRequest } from '../types/tripPlan'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public fieldErrors: Record<string, string[]> = {},
    public code = 'REQUEST_FAILED',
  ) {
    super(message)
  }
}

export async function createTripPlan(input: TripPlanRequest, signal?: AbortSignal): Promise<TripPlan> {
  const response = await fetch(`${API_BASE}/trips/plan/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const error = payload as {
      error?: { code?: string; message?: string; field_errors?: Record<string, string[]> }
    }
    throw new ApiError(
      error.error?.message || 'The trip could not be planned.',
      error.error?.field_errors,
      error.error?.code,
    )
  }
  return payload as TripPlan
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const response = await fetch(`${API_BASE}/locations/reverse/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude, longitude }),
  })
  const payload = (await response.json()) as {
    label?: string
    error?: { code?: string; message?: string; field_errors?: Record<string, string[]> }
  }
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message || 'Your location could not be converted to an address.',
      payload.error?.field_errors,
      payload.error?.code,
    )
  }
  if (!payload.label) throw new ApiError('Your location could not be converted to an address.')
  return payload.label
}

export async function autocompleteLocations(query: string, demo = false, signal?: AbortSignal): Promise<string[]> {
  if (query.trim().length < 3) return []
  const params = new URLSearchParams({ q: query.trim(), demo: String(demo) })
  const response = await fetch(`${API_BASE}/locations/autocomplete/?${params}`, { signal })
  if (!response.ok) return []
  const payload = (await response.json()) as { results: { label: string }[] }
  return payload.results.map((result) => result.label)
}
