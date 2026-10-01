import { fireEvent, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('application shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
    document.documentElement.classList.remove('dark')
  })

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

  it('switches between curated light and dark themes', () => {
    render(<App />)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    const toggle = screen.getByRole('button', { name: /switch to light theme/i })
    fireEvent.click(toggle)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument()
  })
})
