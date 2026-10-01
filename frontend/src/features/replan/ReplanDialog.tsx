import { useEffect, useMemo, useState } from 'react'
import { Info, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
    <Dialog open={open} onOpenChange={(next) => !next && !loading && onClose()}>
      <DialogContent className="replan-dialog">
        <DialogHeader>
          <DialogTitle>Replan from reported progress</DialogTitle>
          <DialogDescription>Update the remaining projection from a driver-reported checkpoint.</DialogDescription>
        </DialogHeader>
        <div className="dialog-form-stack">
          <Alert className="app-alert info">
            <Info />
            <AlertDescription>
              Select the last event you completed. This is driver-reported progress, not a verified ELD record. The
              original plan remains available in this browser session.
            </AlertDescription>
          </Alert>
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="completed-event">Last completed event</FieldLabel>
            <Select value={eventId} onValueChange={chooseEvent}>
              <SelectTrigger id="completed-event" className="w-full">
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {selectableEvents.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.event_type.replaceAll('_', ' ')}, {new Date(event.end_at).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field data-invalid={earlyCheckpoint}>
            <FieldLabel htmlFor="reported-checkpoint">Reported checkpoint time</FieldLabel>
            <Input
              id="reported-checkpoint"
              type="datetime-local"
              value={checkpoint}
              aria-invalid={earlyCheckpoint}
              onChange={(event) => setCheckpoint(event.target.value)}
            />
            <FieldDescription>
              {earlyCheckpoint
                ? "The checkpoint cannot be before the selected event's planned end."
                : delayMinutes > 0
                  ? `${delayMinutes} minutes later than planned`
                  : 'At the selected event’s planned completion time'}
            </FieldDescription>
          </Field>
          <AddressField
            label="Current US location"
            placeholder="Denver, CO"
            value={location}
            demo={plan.demo_mode}
            onChange={setLocation}
          />
          {delayMinutes > 0 && (
            <Field data-invalid={!status}>
              <FieldLabel htmlFor="variance-status">Duty status during unplanned time</FieldLabel>
              <Select value={status} onValueChange={(value) => setStatus(value as DutyStatus)}>
                <SelectTrigger id="variance-status" className="w-full" aria-invalid={!status}>
                  <SelectValue placeholder="Select duty status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFF_DUTY">Off duty</SelectItem>
                  <SelectItem value="SLEEPER_BERTH">Sleeper berth</SelectItem>
                  <SelectItem value="DRIVING">Driving</SelectItem>
                  <SelectItem value="ON_DUTY_NOT_DRIVING">On duty, not driving</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Required because this time changes the 8, 11, 14, and 70-hour clocks.</FieldDescription>
              {!status && <FieldError>Choose the duty status for the unplanned time.</FieldError>}
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={
              loading ||
              !selected ||
              !location.trim() ||
              !checkpoint ||
              earlyCheckpoint ||
              (delayMinutes > 0 && !status)
            }
          >
            {loading ? 'Replanning…' : 'Build updated plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
