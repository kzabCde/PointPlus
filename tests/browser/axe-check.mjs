import assert from 'node:assert/strict'

export async function verifyAccessibility(page, context) {
  const script = process.env.POINTPLUS_AXE
  if (!script) return
  await page.addScriptTag({ path: script })
  const violations = await page.evaluate(async () => {
    const results = await window.axe.run({
      exclude: ['nextjs-portal'],
    }, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })
    return results.violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) }))
  })
  assert.deepEqual(violations, [], context)
  console.log('axe passed:', context)
}
