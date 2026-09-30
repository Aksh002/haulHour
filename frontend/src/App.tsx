import { useRef, useState } from 'react'
import { Alert, Box, Button, Chip, CssBaseline, Tab, Tabs, ThemeProvider } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import PrintIcon from '@mui/icons-material/Print'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { ApiError, createTripPlan } from './api/client'
import { theme } from './app/theme'
import { DailyLogSvg } from './features/eld-logs/DailyLogSvg'
import { RouteMap } from './features/route-map/RouteMap'
import { TripForm } from './features/trip-form/TripForm'
import type { ScheduleEvent, TripPlan, TripPlanRequest } from './types/tripPlan'
import './styles.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })
const minutes = (value: number) => `${Math.floor(value / 60)}h ${value % 60}m`

function Results({ plan, onEdit }: { plan: TripPlan; onEdit: () => void }) {
  const [tab, setTab] = useState(0)
  const [logIndex, setLogIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
    ['Fuel / daily rests', `${plan.summary.fuel_stops} / ${plan.summary.daily_rests}`],
    ['Daily logs', String(plan.summary.log_sheets)],
  ]
  return (
    <main className="results" id="results" tabIndex={-1}>
      <div className="results-head">
        <div>
          <span className="eyebrow">Plan ready · {plan.demo_mode ? 'demo route' : 'live route'}</span>
          <h2>
            {plan.locations[0].label} <span>via</span> {plan.locations[1].label} <span>to</span>{' '}
            {plan.locations[2].label}
          </h2>
        </div>
        <div className="result-actions">
          <Button onClick={onEdit}>Edit trip</Button>
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
              <DailyLogSvg log={plan.daily_logs[logIndex]} />
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
          <DailyLogSvg key={`print-${log.date}`} log={log} />
        ))}
      </div>
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
  plan.events.forEach((event) => {
    const day = new Date(event.start_at).toLocaleDateString()
    days.set(day, [...(days.get(day) ?? []), event])
  })
  return (
    <div className="itinerary">
      {Array.from(days.entries()).map(([day, events]) => (
        <section key={day}>
          <h3>{day}</h3>
          {events.map((event) => (
            <button
              id={event.id}
              key={event.id}
              className={selectedId === event.id ? 'event selected' : 'event'}
              onClick={() => onSelect(event)}
            >
              <time>{new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
              <span className={`status ${event.duty_status}`} />{' '}
              <div>
                <strong>{event.event_type.replaceAll('_', ' ')}</strong>
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
  const activeRequest = useRef<AbortController | null>(null)
  const mutation = useMutation({
    mutationFn: (input: TripPlanRequest) => {
      activeRequest.current?.abort()
      activeRequest.current = new AbortController()
      return createTripPlan(input, activeRequest.current.signal)
    },
    onSuccess: (result) => {
      setPlan(result)
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
            onSubmit={(input) => mutation.mutate(input)}
            loading={mutation.isPending}
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
      {plan && (
        <Results
          plan={plan}
          onEdit={() => {
            activeRequest.current?.abort()
            setPlan(null)
          }}
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
