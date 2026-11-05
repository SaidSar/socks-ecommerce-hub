import { expect, test } from '@playwright/test'

// Ningún ancho entre teléfono chico y escritorio debe tener scroll horizontal (header con cuatro líneas, búsqueda,
// favoritos, cuenta y bolsa incluidos).
const WIDTHS = [320, 390, 640, 768, 900, 1023, 1024, 1280, 1920]
const PAGES = ['/', '/linea/sokko', '/producto/tabi-origami-noche', '/checkout']

for (const width of WIDTHS) {
  test(`sin scroll horizontal a ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of PAGES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(scrollWidth, `${path} a ${width} px`).toBeLessThanOrEqual(innerWidth)
    }
  })
}

test('entre 640 y 1023 px las líneas van en la fila compacta, a partir de 1024 en el header', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await page.goto('/')
  const navs = page.locator('nav[aria-label="Líneas"]')
  await expect(navs).toHaveCount(2)
  await expect(navs.nth(1)).toBeVisible()
  await expect(navs.nth(0)).toBeHidden()

  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(navs.nth(0)).toBeVisible()
  await expect(navs.nth(1)).toBeHidden()
})
