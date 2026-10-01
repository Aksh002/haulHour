import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CssBaseline,
  Dialog,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  ThemeProvider,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import PrintIcon from '@mui/icons-material/Print'
import HistoryIcon from '@mui/icons-material/History'
import UpdateIcon from '@mui/icons-material/Update'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { ApiError, createTripPlan, replanTrip } from './api/client'
import { theme } from './app/theme'
import { DailyLogSvg } from './features/eld-logs/DailyLogSvg'
import { RouteMap } from './features/route-map/RouteMap'
import { TripForm } from './features/trip-form/TripForm'
import { ReplanDialog } from './features/replan/ReplanDialog'
import type { ReplanRequest, ScheduleEvent, TripPlan, TripPlanRequest } from './types/tripPlan'
import './styles.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })
const minutes = (value: number) => `${Math.floor(value / 60)}h ${value % 60}m`

function Results({
  plan,
  originalPlan,
  latestPlan,
  onEdit,
  onReplan,
  onViewOriginal,
  onViewLatest,
}: {
  plan: TripPlan
  originalPlan: TripPlan
  latestPlan: TripPlan
  onEdit: () => void
  onReplan: () => void
  onViewOriginal: () => void
  onViewLatest: () => void
}) {
  const [tab, setTab] = useState(0)
  const [logIndex, setLogIndex] = useState(0)
  const [logExpanded, setLogExpanded] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const eventSources = useMemo(
    () => Object.fromEntries(plan.events.map((event) => [event.id, event.source])),
    [plan.events],
  )
  useEffect(() => {
    setLogIndex(0)
    setSelectedId(null)
  }, [plan.plan_id])
  const download = () => {
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }))
    anchor.download = `${plan.plan_id}.json`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }
  const selectFromMap = (event: ScheduleEvent) => {
    setSelectedId(event.id)
    setTab(1)
    window.setTimeout(() => document.getElementById(event.id)?.focus(), 50)
  }
  const selectFromItinerary = (event: ScheduleEvent) => {
    setSelectedId(event.id)
    setTab(0)
  }
  const metrics = [
    ['Route distance', `${plan.summary.total_route_miles.toLocaleString()} mi`],
    ['Wheel time', minutes(plan.summary.raw_driving_minutes)],
    ['Planned elapsed', minutes(plan.summary.planned_elapsed_minutes)],
    [
      'Arrival',
      new Date(plan.summary.estimated_arrival).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
    ],
    ['Fuel stops', String(plan.summary.fuel_stops)],
    ['Daily rests', String(plan.summary.daily_rests)],
    ['Cycle restarts', String(plan.summary.cycle_restarts)],
    ['Ending cycle used', `${plan.summary.ending_cycle_used_hours.toFixed(2)}h`],
    ['Daily logs', String(plan.summary.log_sheets)],
  ]
  return (
    <main className="results" id="results" tabIndex={-1}>
      <div className="results-head">
        <div>
          <span className="eyebrow">
            Plan ready · version {plan.plan_version} · {plan.demo_mode ? 'demo route' : 'live route'}
          </span>
          <h2>
            {plan.locations[0].label} <span>via</span> {plan.locations[1].label} <span>to</span>{' '}
            {plan.locations[2].label}
          </h2>
        </div>
        <div className="result-actions">
          <Button onClick={onEdit}>Edit trip</Button>
          <Button startIcon={<UpdateIcon />} onClick={onReplan}>
            Replan from progress
          </Button>
          {plan.plan_id !== originalPlan.plan_id && (
            <Button startIcon={<HistoryIcon />} onClick={onViewOriginal}>
              View original
            </Button>
          )}
          {plan.plan_id === originalPlan.plan_id && latestPlan.plan_id !== originalPlan.plan_id && (
            <Button startIcon={<UpdateIcon />} onClick={onViewLatest}>
              View updated
            </Button>
          )}
          <Button startIcon={<DownloadIcon />} onClick={download}>
            Download JSON
          </Button>
          <Button startIcon={<PrintIcon />} variant="contained" onClick={() => window.print()}>
            Print logs
          </Button>
        </div>
      </div>
      {plan.warnings.map((warning) => (
        <Alert severity="info" key={warning} sx={{ mb: 2 }}>
          {warning}
        </Alert>
      ))}
      {plan.replan && (
        <Alert severity="success" className="replan-summary" sx={{ mb: 2 }}>
          <strong>Version {plan.plan_version}</strong> from parent {plan.parent_plan_id}.{' '}
          <strong>Driver-reported checkpoint:</strong> {plan.replan.delay_minutes >= 0 ? '+' : ''}
          {minutes(plan.replan.delay_minutes)} against the selected event. Remaining route:{' '}
          {plan.summary.total_route_miles.toLocaleString()} mi; projected arrival shifted by{' '}
          {minutes(
            Math.abs(
              Math.round(
                (new Date(plan.summary.estimated_arrival).getTime() -
                  new Date(originalPlan.summary.estimated_arrival).getTime()) /
                  60000,
              ),
            ),
          )}{' '}
          {new Date(plan.summary.estimated_arrival) >= new Date(originalPlan.summary.estimated_arrival)
            ? 'later'
            : 'earlier'}{' '}
          than the original. The remaining projection includes {plan.summary.daily_rests} daily rest(s) and{' '}
          {plan.summary.cycle_restarts} cycle restart(s).
        </Alert>
      )}
      <div className="metrics">
        {metrics.map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="compliance">
        <strong>HOS boundary checks</strong>
        {Object.entries(plan.summary.compliance).map(([rule, passed]) => (
          <Chip
            key={rule}
            color={passed ? 'success' : 'error'}
            size="small"
            label={`${rule.replaceAll('_', ' ')} · ${passed ? 'passed' : 'review'}`}
          />
        ))}
      </div>
      <Box className="result-panel">
        <Tabs
          value={tab}
          onChange={(_, value: number) => setTab(value)}
          variant="scrollable"
          aria-label="Trip plan sections"
        >
          <Tab label="Route" />
          <Tab label="Itinerary" />
          <Tab label="Directions" />
          <Tab label="Daily logs" />
          <Tab label="Assumptions" />
        </Tabs>
        <div className="tab-content">
          {tab === 0 && <RouteMap plan={plan} selectedId={selectedId} onSelect={selectFromMap} />}
          {tab === 1 && <Itinerary plan={plan} selectedId={selectedId} onSelect={selectFromItinerary} />}
          {tab === 2 && (
            <div className="directions">
              {plan.route_legs.map((leg) => (
                <section key={leg.id}>
                  <h3>
                    {leg.start_name} → {leg.end_name}
                  </h3>
                  <p>
                    {leg.distance_miles.toLocaleString()} miles · {minutes(leg.duration_minutes)}
                  </p>
                  <ol>
                    {leg.steps.map((step, index) => (
                      <li key={`${leg.id}-${index}`}>
                        <span>{step.instruction}</span>
                        <small>{step.distance_miles.toFixed(1)} mi</small>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
          {tab === 3 && (
            <div className="logs">
              <Tabs
                value={logIndex}
                onChange={(_, value: number) => setLogIndex(value)}
                variant="scrollable"
                aria-label="Daily log dates"
              >
                {plan.daily_logs.map((log) => (
                  <Tab key={log.date} label={log.date} />
                ))}
              </Tabs>
              <Button onClick={() => setLogExpanded(true)} sx={{ mt: 1 }}>
                Inspect log full screen
              </Button>
              <DailyLogSvg log={plan.daily_logs[logIndex]} eventSources={eventSources} />
            </div>
          )}
          {tab === 4 && (
            <div className="assumptions">
              <h3>Planning assumptions & limitations</h3>
              <ul>
                {plan.assumptions.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
              <Alert severity="warning">{plan.disclaimer}</Alert>
            </div>
          )}
        </div>
      </Box>
      <div className="print-logs" aria-hidden="true">
        {plan.daily_logs.map((log) => (
          <DailyLogSvg key={`print-${log.date}`} log={log} eventSources={eventSources} />
        ))}
      </div>
      <Dialog fullScreen open={logExpanded} onClose={() => setLogExpanded(false)} aria-labelledby="full-log-title">
        <DialogTitle id="full-log-title" className="full-log-title">
          Daily log inspection
          <Button onClick={() => setLogExpanded(false)}>Close</Button>
        </DialogTitle>
        <DialogContent>
          {plan.daily_logs[logIndex] && <DailyLogSvg log={plan.daily_logs[logIndex]} eventSources={eventSources} />}
        </DialogContent>
      </Dialog>
    </main>
  )
}

function Itinerary({
  plan,
  selectedId,
  onSelect,
}: {
  plan: TripPlan
  selectedId: string | null
  onSelect: (event: ScheduleEvent) => void
}) {
  const days = new Map<string, ScheduleEvent[]>()
  const timezone = plan.daily_logs[0]?.timezone ?? 'UTC'
  const dateKey = (value: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(value))
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
    return `${part('year')}-${part('month')}-${part('day')}`
  }
  plan.events.forEach((event) => {
    const day = dateKey(event.start_at)
    days.set(day, [...(days.get(day) ?? []), event])
  })
  return (
    <div className="itinerary">
      {Array.from(days.entries()).map(([day, events]) => (
        <section key={day}>
          <h3>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}</h3>
          {plan.daily_logs.find((log) => log.date === day) && (
            <div className="day-totals" aria-label={`Duty totals for ${day}`}>
              {Object.entries(plan.daily_logs.find((log) => log.date === day)!.totals_minutes).map(
                ([status, total]) => (
                  <span key={status}>
                    {status.replaceAll('_', ' ').toLowerCase()}: {minutes(total)}
                  </span>
                ),
              )}
            </div>
          )}
          {events.map((event) => (
            <button
              id={event.id}
              key={event.id}
              className={`${selectedId === event.id ? 'event selected' : 'event'} ${
                ['PICKUP', 'DROPOFF', 'FUEL'].includes(event.event_type)
                  ? 'operational'
                  : ['BREAK_30_MIN', 'DAILY_REST_10_HOUR', 'CYCLE_RESTART_34_HOUR'].includes(event.event_type)
                    ? 'regulatory'
                    : ''
              }`}
              onClick={() => onSelect(event)}
            >
              <time>
                {new Date(event.start_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: timezone,
                })}
                <small>
                  –
                  {new Date(event.end_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: timezone,
                  })}
                </small>
              </time>
              <span className={`status ${event.duty_status}`} />{' '}
              <div>
                <strong>{event.event_type.replaceAll('_', ' ')}</strong>{' '}
                <span className={`event-source ${event.source}`}>
                  {event.source.replaceAll('_', ' ').toLowerCase()}
                </span>
                <p>
                  {event.display_location} · {minutes(event.duration_minutes)}
                </p>
                <small>{event.reason}</small>
              </div>
              {event.event_type === 'DRIVE' && (
                <b>{(event.route_distance_end_miles - event.route_distance_start_miles).toFixed(0)} mi</b>
              )}
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}

function Application() {
  const [plan, setPlan] = useState<TripPlan | null>(null)
  const [originalPlan, setOriginalPlan] = useState<TripPlan | null>(null)
  const [latestPlan, setLatestPlan] = useState<TripPlan | null>(null)
  const [lastRequest, setLastRequest] = useState<TripPlanRequest | null>(null)
  const [replanOpen, setReplanOpen] = useState(false)
  const activeRequest = useRef<AbortController | null>(null)
  const mutation = useMutation({
    mutationFn: (input: TripPlanRequest) => {
      activeRequest.current?.abort()
      activeRequest.current = new AbortController()
      return createTripPlan(input, activeRequest.current.signal)
    },
    onSuccess: (result) => {
      setPlan(result)
      setOriginalPlan(result)
      setLatestPlan(result)
      setTimeout(() => document.getElementById('results')?.focus(), 50)
    },
  })
  const replanMutation = useMutation({
    mutationFn: (input: ReplanRequest) => replanTrip(input),
    onSuccess: (result) => {
      setPlan(result)
      setLatestPlan(result)
      setReplanOpen(false)
      setTimeout(() => document.getElementById('results')?.focus(), 50)
    },
  })
  return (
    <>
      <header>
        <a className="brand" href="/" aria-label="HaulHour home">
          <span>H</span>HaulHour
        </a>
        <Chip label="Planning demo" size="small" />
        <p>Route decisions and hours-of-service logic, translated into one clear driver plan.</p>
      </header>
      <div className="hero">
        <div>
          <span className="eyebrow">Projected HOS-aware planning</span>
          <h1>
            Make every mile
            <br />
            <em>account for time.</em>
          </h1>
          <p>
            Build a route through pickup, find the regulatory boundaries, and inspect every projected daily log—all from
            one timeline.
          </p>
        </div>
        <div className="hero-rule">
          <span>8</span>
          <small>hour break</small>
          <span>11</span>
          <small>hour drive</small>
          <span>14</span>
          <small>hour window</small>
          <span>70</span>
          <small>hour cycle</small>
        </div>
      </div>
      <main className="page">
        {!plan && (
          <TripForm
            onSubmit={(input) => {
              setLastRequest(input)
              mutation.mutate(input)
            }}
            loading={mutation.isPending}
            initialValues={lastRequest}
            apiFieldErrors={mutation.error instanceof ApiError ? mutation.error.fieldErrors : {}}
            apiError={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : mutation.error
                  ? 'Something unexpected happened.'
                  : null
            }
          />
        )}
      </main>
      {plan && originalPlan && latestPlan && (
        <Results
          plan={plan}
          originalPlan={originalPlan}
          latestPlan={latestPlan}
          onReplan={() => {
            replanMutation.reset()
            setReplanOpen(true)
          }}
          onViewOriginal={() => setPlan(originalPlan)}
          onViewLatest={() => setPlan(latestPlan)}
          onEdit={() => {
            activeRequest.current?.abort()
            setPlan(null)
            setOriginalPlan(null)
            setLatestPlan(null)
            setReplanOpen(false)
            mutation.reset()
            replanMutation.reset()
          }}
        />
      )}
      {plan && (
        <ReplanDialog
          open={replanOpen}
          plan={plan}
          loading={replanMutation.isPending}
          error={
            replanMutation.error instanceof ApiError
              ? replanMutation.error.message
              : replanMutation.error
                ? 'Something unexpected happened.'
                : null
          }
          onClose={() => setReplanOpen(false)}
          onSubmit={(input) => replanMutation.mutate(input)}
        />
      )}
      <footer>
        <strong>HaulHour</strong>
        <p>
          Projected planning demonstration—not a certified ELD. Routing data © OpenStreetMap contributors and
          OpenRouteService.
        </p>
      </footer>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <Application />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
