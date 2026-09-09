// Execute only caller-defined actions. Values are never copied to step results or errors.
export async function performStep(page, step, timeout) {
  const locator = page.locator(step.selector);
  switch (step.action) {
    case 'click':
      return locator.click({ timeout });
    case 'fill':
      return locator.fill(step.value, { timeout });
    case 'press':
      return locator.press(step.key, { timeout });
    case 'select':
      return locator.selectOption(step.value, { timeout });
    case 'waitFor':
      return locator.waitFor({ state: step.state || 'visible', timeout });
    case 'expectText': {
      const deadline = Date.now() + timeout;
      await locator.waitFor({ state: 'visible', timeout });
      do {
        if (
          (await locator.textContent({ timeout: Math.max(1, deadline - Date.now()) }))?.includes(
            step.value,
          )
        )
          return;
        await page.waitForTimeout(50);
      } while (Date.now() < deadline);
      throw new Error('Expected text was not observed.');
    }
    default:
      throw new Error('Unsupported interaction action.');
  }
}
