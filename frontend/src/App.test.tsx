import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('application shell', () => {
  it('shows the required planning inputs and disclaimer', () => {
    render(<App />)
    expect(screen.getByRole('combobox', { name: /^current location$/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /^pickup$/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /^drop-off$/i })).toBeInTheDocument()
    expect(screen.getByText(/not a certified ELD/i)).toBeInTheDocument()
  })

  it('has no automatically detectable critical accessibility violations', async () => {
    const { container } = render(<App />)
    const results = await axe.run(container, {
      resultTypes: ['violations'],
      rules: { 'color-contrast': { enabled: false } },
    })
    const critical = results.violations.filter((violation) => violation.impact === 'critical')
    expect(critical).toEqual([])
  })
})
