import { useEffect, useMemo, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { Download, History, Info, Moon, Printer, RefreshCw, Sun, TriangleAlert, Truck } from 'lucide-react'
import { ApiError, createTripPlan, replanTrip } from './api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EncryptedText } from '@/components/ui/encrypted-text'
import { DailyLogSvg } from './features/eld-logs/DailyLogSvg'
import { RouteMap } from './features/route-map/RouteMap'
import { TripForm } from './features/trip-form/TripForm'
import { ReplanDialog } from './features/replan/ReplanDialog'
import type { ReplanRequest, ScheduleEvent, TripPlan, TripPlanRequest } from './types/tripPlan'
import './design.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })
const minutes = (value: number) => `${Math.floor(value / 60)}h ${value % 60}m`
const enter = { opacity: 0, y: 22 }
const visible = { opacity: 1, y: 0 }
type ThemeMode = 'light' | 'dark'

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
      <motion.div
        className="results-head"
        initial={enter}
        animate={visible}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div>
          <span className="plan-meta">
            <EncryptedText
              text="Plan ready"
              charset="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
              revealDelayMs={42}
              flipDelayMs={48}
              encryptedClassName="plan-meta-encrypted"
            />{' '}
            <i /> version {plan.plan_version} <i /> {plan.demo_mode ? 'demo route' : 'live route'}
          </span>
          <h2>
            {plan.locations[0].label} <span>via</span> {plan.locations[1].label} <span>to</span>{' '}
            {plan.locations[2].label}
          </h2>
        </div>
        <div className="result-actions">
          <Button variant="ghost" onClick={onEdit}>
            Edit trip
          </Button>
          <Button variant="ghost" onClick={onReplan}>
            <RefreshCw data-icon="inline-start" />
            Replan from progress
          </Button>
          {plan.plan_id !== originalPlan.plan_id && (
            <Button variant="ghost" onClick={onViewOriginal}>
              <History data-icon="inline-start" />
              View original
            </Button>
          )}
          {plan.plan_id === originalPlan.plan_id && latestPlan.plan_id !== originalPlan.plan_id && (
            <Button variant="ghost" onClick={onViewLatest}>
              <RefreshCw data-icon="inline-start" />
              View updated
            </Button>
          )}
          <Button variant="ghost" onClick={download}>
            <Download data-icon="inline-start" />
            Download JSON
          </Button>
          <Button onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Print logs
          </Button>
        </div>
      </motion.div>
      {plan.warnings.map((warning) => (
        <Alert className="app-alert info" key={warning}>
          <Info />
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ))}
      {plan.replan && (
        <Alert className="app-alert success replan-summary">
          <Info />
          <AlertDescription>
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
          </AlertDescription>
        </Alert>
      )}
      <motion.div
        className="metrics"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}
      >
        {metrics.map(([label, value]) => (
          <motion.div
            className="metric"
            key={label}
            variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </motion.div>
        ))}
      </motion.div>
      <div className="compliance">
        <strong>HOS boundary checks</strong>
        {Object.entries(plan.summary.compliance).map(([rule, passed]) => (
          <Badge
            key={rule}
            variant={passed ? 'secondary' : 'destructive'}
            className={passed ? 'compliance-badge passed' : 'compliance-badge'}
          >
            {rule.replaceAll('_', ' ')}: {passed ? 'passed' : 'review'}
          </Badge>
        ))}
      </div>
      <div className="result-panel">
        <Tabs value={String(tab)} onValueChange={(value) => setTab(Number(value))} aria-label="Trip plan sections">
          <TabsList variant="line" className="plan-tabs">
            <TabsTrigger value="0">Route</TabsTrigger>
            <TabsTrigger value="1">Itinerary</TabsTrigger>
            <TabsTrigger value="2">Directions</TabsTrigger>
            <TabsTrigger value="3">Daily logs</TabsTrigger>
            <TabsTrigger value="4">Assumptions</TabsTrigger>
          </TabsList>
        </Tabs>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="tab-content"
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
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
                      {leg.distance_miles.toLocaleString()} miles, {minutes(leg.duration_minutes)}
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
                  value={String(logIndex)}
                  onValueChange={(value) => setLogIndex(Number(value))}
                  aria-label="Daily log dates"
                >
                  <TabsList variant="line" className="log-tabs">
                    {plan.daily_logs.map((log, index) => (
                      <TabsTrigger key={log.date} value={String(index)}>
                        {log.date}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Button variant="outline" className="inspect-log" onClick={() => setLogExpanded(true)}>
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
                <Alert className="app-alert warning">
                  <TriangleAlert />
                  <AlertDescription>{plan.disclaimer}</AlertDescription>
                </Alert>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="print-logs" aria-hidden="true">
        {plan.daily_logs.map((log) => (
          <DailyLogSvg key={`print-${log.date}`} log={log} eventSources={eventSources} />
        ))}
      </div>
      <Dialog open={logExpanded} onOpenChange={setLogExpanded}>
        <DialogContent className="full-log-dialog" showCloseButton={false} aria-describedby={undefined}>
          <DialogHeader className="full-log-title">
            <DialogTitle>Daily log inspection</DialogTitle>
            <Button variant="outline" onClick={() => setLogExpanded(false)}>
              Close
            </Button>
          </DialogHeader>
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
          {events.map((event, eventIndex) => (
            <motion.button
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
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: Math.min(eventIndex * 0.025, 0.2) }}
              whileTap={{ scale: 0.99 }}
            >
              <time>
                {new Date(event.start_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: timezone,
                })}
                <small>
                  {' - '}
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
                  {event.display_location}, {minutes(event.duration_minutes)}
                </p>
                <small>{event.reason}</small>
              </div>
              {event.event_type === 'DRIVE' && (
                <b>{(event.route_distance_end_miles - event.route_distance_start_miles).toFixed(0)} mi</b>
              )}
            </motion.button>
          ))}
        </section>
      ))}
    </div>
  )
}

function Application({ mode, onToggleMode }: { mode: ThemeMode; onToggleMode: () => void }) {
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
    <div className="app-shell antialiased" data-theme={mode}>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="HaulHour home">
            <span aria-hidden="true">H</span>
            <strong>HaulHour</strong>
          </a>
          <div className="header-context">
            <Badge variant="outline">HOS planner</Badge>
            <p>Route decisions and regulatory time in one driver plan.</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="theme-toggle"
                onClick={onToggleMode}
                aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={mode}
                    initial={{ opacity: 0, rotate: -40, scale: 0.7 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 40, scale: 0.7 }}
                    transition={{ duration: 0.18 }}
                    className="theme-icon"
                  >
                    {mode === 'dark' ? <Sun /> : <Moon />}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Switch to {mode === 'dark' ? 'light' : 'dark'} theme</TooltipContent>
          </Tooltip>
        </div>
      </header>
      <section className="hero" aria-labelledby="hero-title">
        <motion.div
          className="hero-copy"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
        >
          <motion.span className="eyebrow" variants={{ hidden: enter, show: visible }}>
            Projected HOS-aware planning
          </motion.span>
          <motion.h1 id="hero-title" variants={{ hidden: enter, show: visible }}>
            Make every mile <em>account for time.</em>
          </motion.h1>
          <motion.p variants={{ hidden: enter, show: visible }}>
            Plan the route, surface HOS boundaries, and inspect projected logs before the wheels turn.
          </motion.p>
          <motion.div variants={{ hidden: enter, show: visible }}>
            <Button asChild size="lg">
              <a href="#planner">
                <Truck data-icon="inline-start" />
                Plan a trip
              </a>
            </Button>
          </motion.div>
        </motion.div>
        <motion.div
          className="hero-instrument"
          aria-label="Hours of service planning limits"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="route-signal" aria-hidden="true">
            <span className="route-line" />
            <motion.span
              className="truck-signal"
              animate={{ x: [0, 92, 190] }}
              transition={{ duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            >
              <Truck />
            </motion.span>
            <i className="route-node node-one" />
            <i className="route-node node-two" />
            <i className="route-node node-three" />
          </div>
          <div className="hero-rule">
            {[
              ['8', 'hour break'],
              ['11', 'hour drive'],
              ['14', 'hour window'],
              ['70', 'hour cycle'],
            ].map(([value, label]) => (
              <div key={label}>
                <span>{value}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <p className="instrument-caption">Federal property-carrying limits, modeled across the full route.</p>
        </motion.div>
      </section>
      <main className="page" id="planner">
        <AnimatePresence mode="wait">
          {!plan && (
            <motion.div
              key="planner-form"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <AnimatePresence mode="wait">
        {plan && originalPlan && latestPlan && (
          <motion.div key={plan.plan_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
          </motion.div>
        )}
      </AnimatePresence>
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
        <div className="footer-brand">
          <strong>HaulHour</strong>
          <span>Plan the route. Protect the clock.</span>
        </div>
        <p>
          Projected planning demonstration, not a certified ELD. Routing data © OpenStreetMap contributors and
          OpenRouteService.
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = window.localStorage.getItem('haulhour-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return 'dark'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = mode
    document.documentElement.classList.toggle('dark', mode === 'dark')
    document.documentElement.style.colorScheme = mode
    window.localStorage.setItem('haulhour-theme', mode)
  }, [mode])
  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Application mode={mode} onToggleMode={() => setMode((value) => (value === 'dark' ? 'light' : 'dark'))} />
        </TooltipProvider>
      </QueryClientProvider>
    </MotionConfig>
  )
}
