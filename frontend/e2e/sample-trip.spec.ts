import { expect, test } from '@playwright/test'

test('sample trip reaches map, itinerary, and daily logs', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Choose pickup on map' }).click()
  const picker = page.getByRole('dialog', { name: /choose pickup on the map/i })
  await expect(picker).toBeVisible()
  await expect(picker.getByText(/US locations only/i)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Load sample trip' }).click()
  await page.getByRole('button', { name: 'Build trip plan' }).click()
  await expect(page.getByText(/Plan ready/)).toBeVisible()
  await expect(page.getByLabel('Trip plan sections')).toBeVisible()
  await page.getByRole('tab', { name: 'Itinerary' }).click()
  await expect(page.getByText('PICKUP', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Daily logs' }).click()
  await expect(page.locator('.logs').getByText(/Driver's daily log/)).toBeVisible()
  await expect(page.locator('.print-logs article')).toHaveCount(3)
})
