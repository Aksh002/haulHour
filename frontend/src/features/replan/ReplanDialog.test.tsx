import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TripPlan } from '../../types/tripPlan'
import { ReplanDialog } from './ReplanDialog'

const plan: TripPlan = {
  plan_id: 'plan-original',
  plan_version: 1,
  parent_plan_id: null,
  demo_mode: true,
  locations: [
    { role: 'current', label: 'Chicago, IL', coordinate: { latitude: 41.8, longitude: -87.6 } },
    { role: 'pickup', label: 'Denver, CO', coordinate: { latitude: 39.7, longitude: -104.9 } },
    { role: 'dropoff', label: 'Los Angeles, CA', coordinate: { latitude: 34, longitude: -118.2 } },
  ],
  route_legs: [],
  events: [
    {
      id: 'event-001',
      event_type: 'DRIVE',
      duty_status: 'DRIVING',
      start_at: '2026-10-05T06:00:00-05:00',
      end_at: '2026-10-05T07:00:00-05:00',
      duration_minutes: 60,
      route_leg_id: 'leg-1',
      route_distance_start_miles: 0,
      route_distance_end_miles: 50,
      coordinate: null,
      display_location: 'Route',
      reason: 'Drive',
      remarks: 'Drive',
      counts_toward_cycle: true,
      source: 'PROJECTED',
      original_event_id: null,
    },
  ],
  stops: [],
  daily_logs: [],
  summary: {
    total_route_miles: 50,
    raw_driving_minutes: 60,
    planned_elapsed_minutes: 60,
    estimated_arrival: '2026-10-05T07:00:00-05:00',
    fuel_stops: 0,
    daily_rests: 0,
    cycle_restarts: 0,
    log_sheets: 0,
    ending_cycle_used_hours: 1,
    compliance: {},
  },
  assumptions: [],
  warnings: [],
  disclaimer: 'Projected only',
}

const localInput = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

describe('ReplanDialog', () => {
  it('shows an API failure without mutating the active plan', () => {
    const snapshot = JSON.stringify(plan)
    render(
      <ReplanDialog
        open
        plan={plan}
        loading={false}
        error="That plan has expired."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByText('That plan has expired.')).toBeInTheDocument()
    expect(JSON.stringify(plan)).toBe(snapshot)
  })

  it('requires a duty status when the checkpoint is later than planned', () => {
    render(<ReplanDialog open plan={plan} loading={false} error={null} onClose={vi.fn()} onSubmit={vi.fn()} />)
    const checkpoint = screen.getByLabelText('Reported checkpoint time') as HTMLInputElement
    const delayed = new Date(checkpoint.value)
    delayed.setHours(delayed.getHours() + 1)
    fireEvent.change(checkpoint, { target: { value: localInput(delayed) } })

    expect(screen.getByText('60 minutes later than planned')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Duty status during unplanned time/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Build updated plan' })).toBeDisabled()
  })
})
