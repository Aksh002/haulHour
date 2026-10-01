import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import type { DutyStatus, ReplanRequest, TripPlan } from '../../types/tripPlan'
import { AddressField } from '../trip-form/TripForm'

const toLocalInput = (iso: string) => {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function ReplanDialog({
  open,
  plan,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
  plan: TripPlan
  loading: boolean
  error: string | null
  onClose: () => void
  onSubmit: (request: ReplanRequest) => void
}) {
  const selectableEvents = useMemo(() => plan.events.filter((event) => event.event_type !== 'DROPOFF'), [plan])
  const defaultEvent = selectableEvents.at(-1)
  const [eventId, setEventId] = useState(defaultEvent?.id ?? '')
  const [checkpoint, setCheckpoint] = useState(defaultEvent ? toLocalInput(defaultEvent.end_at) : '')
  const [location, setLocation] = useState(plan.locations[0]?.label ?? '')
  const [status, setStatus] = useState<DutyStatus | ''>('')
  const selected = selectableEvents.find((event) => event.id === eventId)
  const delayMinutes =
    selected && checkpoint
      ? Math.round((new Date(checkpoint).getTime() - new Date(selected.end_at).getTime()) / 60000)
      : 0
  const earlyCheckpoint = delayMinutes < 0

  useEffect(() => {
    if (!open || !defaultEvent) return
    setEventId(defaultEvent.id)
    setCheckpoint(toLocalInput(defaultEvent.end_at))
    setLocation(plan.locations[0]?.label ?? '')
    setStatus('')
  }, [open, plan, defaultEvent])

  const chooseEvent = (id: string) => {
    const event = selectableEvents.find((candidate) => candidate.id === id)
    setEventId(id)
    if (event) setCheckpoint(toLocalInput(event.end_at))
    setStatus('')
  }

  const submit = () => {
    if (!selected || !location.trim() || !checkpoint || earlyCheckpoint || (delayMinutes > 0 && !status)) return
    onSubmit({
      plan_id: plan.plan_id,
      last_completed_event_id: selected.id,
      checkpoint_at: new Date(checkpoint).toISOString(),
      current_location: location.trim(),
      ...(delayMinutes > 0 && status ? { delay_duty_status: status } : {}),
    })
  }

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="replan-title">
      <DialogTitle id="replan-title">Replan from reported progress</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          <Alert severity="info">
            Select the last event you completed. This is driver-reported progress, not a verified ELD record. The
            original plan remains available in this browser session.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <FormControl fullWidth>
            <InputLabel id="completed-event-label">Last completed event</InputLabel>
            <Select
              labelId="completed-event-label"
              label="Last completed event"
              value={eventId}
              onChange={(event) => chooseEvent(event.target.value)}
            >
              {selectableEvents.map((event) => (
                <MenuItem key={event.id} value={event.id}>
                  {event.event_type.replaceAll('_', ' ')}, {new Date(event.end_at).toLocaleString()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Reported checkpoint time"
            type="datetime-local"
            value={checkpoint}
            onChange={(event) => setCheckpoint(event.target.value)}
            error={earlyCheckpoint}
            helperText={
              earlyCheckpoint
                ? "The checkpoint cannot be before the selected event's planned end."
                : delayMinutes > 0
                  ? `${delayMinutes} minutes later than planned`
                  : 'At the selected event’s planned completion time'
            }
            InputLabelProps={{ shrink: true }}
          />
          <AddressField
            label="Current US location"
            placeholder="Denver, CO"
            value={location}
            demo={plan.demo_mode}
            onChange={setLocation}
          />
          {delayMinutes > 0 && (
            <FormControl fullWidth required error={!status}>
              <InputLabel id="variance-status-label">Duty status during unplanned time</InputLabel>
              <Select
                labelId="variance-status-label"
                label="Duty status during unplanned time"
                value={status}
                onChange={(event) => setStatus(event.target.value as DutyStatus)}
              >
                <MenuItem value="OFF_DUTY">Off duty</MenuItem>
                <MenuItem value="SLEEPER_BERTH">Sleeper berth</MenuItem>
                <MenuItem value="DRIVING">Driving</MenuItem>
                <MenuItem value="ON_DUTY_NOT_DRIVING">On duty, not driving</MenuItem>
              </Select>
              <FormHelperText>Required because this time changes the 8, 11, 14, and 70-hour clocks.</FormHelperText>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={
            loading || !selected || !location.trim() || !checkpoint || earlyCheckpoint || (delayMinutes > 0 && !status)
          }
        >
          {loading ? 'Replanning…' : 'Build updated plan'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
