import type { DutyStatus } from '../../types/tripPlan'

const rows: DutyStatus[] = ['OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING']

export const minuteToX = (minute: number) => 130 + minute * (720 / 1440)
export const statusToY = (status: DutyStatus) => 62 + rows.indexOf(status) * 42
