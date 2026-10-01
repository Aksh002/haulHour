export type DutyStatus = 'OFF_DUTY' | 'SLEEPER_BERTH' | 'DRIVING' | 'ON_DUTY_NOT_DRIVING'
export type EventType =
  | 'DRIVE'
  | 'PICKUP'
  | 'DROPOFF'
  | 'FUEL'
  | 'BREAK_30_MIN'
  | 'DAILY_REST_10_HOUR'
  | 'CYCLE_RESTART_34_HOUR'
  | 'REPORTED_DELAY'
export type EventSource = 'REPORTED_COMPLETE' | 'REPORTED_VARIANCE' | 'PROJECTED'
export interface Coordinate {
  latitude: number
  longitude: number
}
export interface Location {
  role: string
  label: string
  coordinate: Coordinate
}
export interface RouteStep {
  instruction: string
  distance_miles: number
  duration_minutes: number
}
export interface RouteLeg {
  id: string
  start_name: string
  end_name: string
  distance_miles: number
  duration_minutes: number
  geometry: Coordinate[]
  steps: RouteStep[]
}
export interface ScheduleEvent {
  id: string
  event_type: EventType
  duty_status: DutyStatus
  start_at: string
  end_at: string
  duration_minutes: number
  route_leg_id: string | null
  route_distance_start_miles: number
  route_distance_end_miles: number
  coordinate: Coordinate | null
  display_location: string
  reason: string
  remarks: string
  counts_toward_cycle: boolean
  source: EventSource
  original_event_id: string | null
}
export interface LogSegment {
  start_minute: number
  end_minute: number
  duty_status: DutyStatus
  event_id: string | null
  reason: string
}
export interface DailyLog {
  date: string
  timezone: string
  segments: LogSegment[]
  totals_minutes: Record<DutyStatus, number>
  remarks: { minute: number; event_id: string | null; text: string; location?: string }[]
  metadata: Record<string, string>
  total_miles: number
}
export interface Summary {
  total_route_miles: number
  raw_driving_minutes: number
  planned_elapsed_minutes: number
  estimated_arrival: string
  fuel_stops: number
  daily_rests: number
  cycle_restarts: number
  log_sheets: number
  ending_cycle_used_hours: number
  compliance: Record<string, boolean>
}
export interface TripPlan {
  plan_id: string
  plan_version: number
  parent_plan_id: string | null
  demo_mode: boolean
  locations: Location[]
  route_legs: RouteLeg[]
  events: ScheduleEvent[]
  stops: ScheduleEvent[]
  daily_logs: DailyLog[]
  summary: Summary
  assumptions: string[]
  warnings: string[]
  disclaimer: string
  replan?: {
    last_completed_event_id: string
    checkpoint_at: string
    planned_checkpoint_at: string
    delay_minutes: number
    pickup_complete: boolean
  }
}

export interface ReplanRequest {
  plan_id: string
  last_completed_event_id: string
  checkpoint_at: string
  current_location: string
  delay_duty_status?: DutyStatus
}
export interface TripPlanRequest {
  current_location: string
  pickup_location: string
  dropoff_location: string
  current_cycle_used_hours: number
  start_at: string
  terminal_timezone: string
  demo_mode: boolean
  driver_name?: string
  carrier_name?: string
  main_office_address?: string
  vehicle_number?: string
  trailer_number?: string
  shipping_document_number?: string
}
