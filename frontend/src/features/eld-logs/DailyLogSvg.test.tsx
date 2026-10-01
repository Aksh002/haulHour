import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DailyLog, DutyStatus } from '../../types/tripPlan'
import { DailyLogSvg } from './DailyLogSvg'
import { minuteToX, statusToY } from './logGeometry'

const log: DailyLog = {
  date: '2026-10-05',
  timezone: 'America/Chicago',
  segments: [
    { start_minute: 0, end_minute: 720, duty_status: 'OFF_DUTY', event_id: null, reason: 'Before trip' },
    { start_minute: 720, end_minute: 1440, duty_status: 'DRIVING', event_id: 'event-1', reason: 'Drive' },
  ],
  totals_minutes: { OFF_DUTY: 720, SLEEPER_BERTH: 0, DRIVING: 720, ON_DUTY_NOT_DRIVING: 0 },
  remarks: [{ minute: 720, event_id: 'event-1', text: 'Drive', location: 'Chicago, IL' }],
  metadata: {
    driver_name: 'Alex Driver',
    carrier_name: 'HaulHour Freight',
    main_office_address: '100 Main St',
    vehicle_number: 'T-12',
    trailer_number: 'R-8',
    shipping_document_number: 'SHIP-1',
  },
  total_miles: 500,
}

describe('DailyLogSvg', () => {
  it('maps midnight, noon, 24:00, and all status rows deterministically', () => {
    expect(minuteToX(0)).toBe(130)
    expect(minuteToX(720)).toBe(490)
    expect(minuteToX(1440)).toBe(850)
    const statuses: DutyStatus[] = ['OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING']
    expect(statuses.map(statusToY)).toEqual([62, 104, 146, 188])
  })

  it('renders metadata, location-aware remarks, and status transitions', () => {
    const { container } = render(<DailyLogSvg log={log} />)
    expect(screen.getByText('Alex Driver')).toBeInTheDocument()
    expect(screen.getByText('HaulHour Freight')).toBeInTheDocument()
    expect(screen.getByText(/Drive — Chicago, IL/)).toBeInTheDocument()
    const graph = screen.getByRole('img', { name: /ELD-style duty graph/ })
    expect(graph).toBeInTheDocument()
    expect(container.querySelectorAll('svg line').length).toBeGreaterThan(100)
    expect(container.querySelectorAll('[data-kind="status-segment"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-kind="status-transition"]')).toHaveLength(1)
  })
})
