import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TripPlanRequest } from '../../types/tripPlan'
import { TripForm } from './TripForm'

const request: TripPlanRequest = {
  current_location: 'Chicago, IL',
  pickup_location: 'Denver, CO',
  dropoff_location: 'Los Angeles, CA',
  current_cycle_used_hours: 18,
  start_at: '2026-10-05T06:00:00-05:00',
  terminal_timezone: 'America/Chicago',
  demo_mode: true,
  main_office_address: '100 Main St, Chicago, IL',
}

describe('TripForm', () => {
  it('restores the previous request when editing and exposes office metadata', () => {
    render(<TripForm onSubmit={vi.fn()} loading={false} apiError={null} initialValues={request} />)
    expect(screen.getByRole('combobox', { name: /^current location$/i })).toHaveValue('Chicago, IL')
    expect(screen.getByLabelText('Current cycle used')).toHaveValue(18)
    fireEvent.click(screen.getByText('Trip and log options'))
    expect(screen.getByLabelText('Main office address')).toHaveValue('100 Main St, Chicago, IL')
  })

  it('places a backend field error beside and focuses the affected input', async () => {
    render(
      <TripForm
        onSubmit={vi.fn()}
        loading={false}
        apiError="Please correct the highlighted fields."
        apiFieldErrors={{ current_location: ['Choose a supported US location.'] }}
      />,
    )
    const field = screen.getByRole('combobox', { name: /^current location$/i })
    expect(screen.getByText('Choose a supported US location.')).toBeInTheDocument()
    await waitFor(() => expect(field).toHaveFocus())
  })

  it('prevents duplicate submissions while planning', () => {
    render(<TripForm onSubmit={vi.fn()} loading apiError={null} initialValues={request} />)
    expect(screen.getByRole('button', { name: /Building route & logs/ })).toBeDisabled()
  })

  it('preserves a coordinate selected for a location when submitting', async () => {
    const onSubmit = vi.fn()
    const pickup = { latitude: 39.73925, longitude: -104.99035 }
    render(
      <TripForm
        onSubmit={onSubmit}
        loading={false}
        apiError={null}
        initialValues={{ ...request, pickup_location_coordinate: pickup }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Build trip plan' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].pickup_location_coordinate).toEqual(pickup)
  })
})
