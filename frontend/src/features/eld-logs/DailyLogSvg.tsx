import type { DailyLog, DutyStatus, EventSource } from '../../types/tripPlan'
import { minuteToX, statusToY } from './logGeometry'

const rows: DutyStatus[] = ['OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING']
const labels = ['Off duty', 'Sleeper berth', 'Driving', 'On duty (not driving)']
export function DailyLogSvg({ log, eventSources = {} }: { log: DailyLog; eventSources?: Record<string, EventSource> }) {
  return (
    <article className="log-sheet">
      <div className="log-heading">
        <div>
          <span className="log-label">Driver's daily log</span>
          <h3>{new Date(`${log.date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}</h3>
        </div>
        <div>
          <strong>{log.total_miles.toLocaleString()} mi</strong>
          <small>{log.timezone}</small>
        </div>
      </div>
      <dl className="log-metadata">
        <div>
          <dt>Driver</dt>
          <dd>{log.metadata.driver_name || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Carrier</dt>
          <dd>{log.metadata.carrier_name || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Main office</dt>
          <dd>{log.metadata.main_office_address || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Vehicle</dt>
          <dd>{log.metadata.vehicle_number || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Trailer</dt>
          <dd>{log.metadata.trailer_number || 'Not provided'}</dd>
        </div>
        <div>
          <dt>Shipping document</dt>
          <dd>{log.metadata.shipping_document_number || 'Not provided'}</dd>
        </div>
      </dl>
      <svg viewBox="0 0 980 280" role="img" aria-label={`ELD-style duty graph for ${log.date}`}>
        <rect x="130" y="41" width="720" height="168" fill="#fcfdfc" stroke="#17393d" />
        {Array.from({ length: 97 }, (_, index) => index * 15).map((minute) => (
          <line
            key={minute}
            x1={minuteToX(minute)}
            x2={minuteToX(minute)}
            y1="41"
            y2="209"
            stroke={minute % 60 === 0 ? '#769195' : '#d9e2e0'}
            strokeWidth={minute % 60 === 0 ? 1 : 0.5}
          />
        ))}
        {rows.map((status, index) => (
          <g key={status}>
            <text x="120" y={statusToY(status) + 4} textAnchor="end" fontSize="12" fill="#17393d">
              {labels[index]}
            </text>
            <line x1="130" x2="850" y1={statusToY(status)} y2={statusToY(status)} stroke="#769195" />
          </g>
        ))}
        {Array.from({ length: 25 }, (_, hour) => (
          <text key={hour} x={minuteToX(hour * 60)} y="30" textAnchor="middle" fontSize="10" fill="#53686b">
            {hour}
          </text>
        ))}
        {log.segments.map((segment, index) => (
          <g key={`${segment.start_minute}-${index}`}>
            <line
              data-kind="status-segment"
              x1={minuteToX(segment.start_minute)}
              x2={minuteToX(segment.end_minute)}
              y1={statusToY(segment.duty_status)}
              y2={statusToY(segment.duty_status)}
              stroke={segment.event_id && eventSources[segment.event_id] !== 'PROJECTED' ? '#c75334' : '#071f23'}
              strokeWidth="4"
              strokeDasharray={segment.event_id && eventSources[segment.event_id] !== 'PROJECTED' ? '7 3' : undefined}
            />
            {index > 0 && (
              <line
                data-kind="status-transition"
                x1={minuteToX(segment.start_minute)}
                x2={minuteToX(segment.start_minute)}
                y1={statusToY(log.segments[index - 1].duty_status)}
                y2={statusToY(segment.duty_status)}
                stroke="#071f23"
                strokeWidth="2"
              />
            )}
          </g>
        ))}
        {rows.map((status) => (
          <text key={`${status}-total`} x="870" y={statusToY(status) + 4} fontSize="12" fontWeight="700">
            {(log.totals_minutes[status] / 60).toFixed(2)}
          </text>
        ))}
      </svg>
      {Object.values(eventSources).some((source) => source !== 'PROJECTED') && (
        <div className="log-source-legend">
          <span>
            <i /> Driver-reported
          </span>
          <span>
            <i /> Projected
          </span>
        </div>
      )}
      <div className="remarks">
        <strong>Remarks</strong>
        {log.remarks.map((remark, index) => (
          <p key={`${remark.minute}-${index}`}>
            <time>
              {String(Math.floor(remark.minute / 60)).padStart(2, '0')}:{String(remark.minute % 60).padStart(2, '0')}
            </time>{' '}
            {remark.text}
            {remark.location ? ` - ${remark.location}` : ''}
          </p>
        ))}
      </div>
      <p className="log-disclaimer">
        Projected log for assessment demonstration; not an electronic record of actual duty activity.
      </p>
    </article>
  )
}
