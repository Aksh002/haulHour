import { render, screen } from '@testing-library/react'
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
})
