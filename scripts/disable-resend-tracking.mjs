// One-off script: disable open/click tracking at the Resend domain level.
// Run with: node --env-file-if-exists=/vercel/share/.env.project scripts/disable-resend-tracking.mjs
const apiKey = process.env.RESEND_API_KEY

if (!apiKey) {
  console.error("[v0] RESEND_API_KEY is not set")
  process.exit(1)
}

console.log("[v0] key prefix:", apiKey.slice(0, 3), "len:", apiKey.length)

const listRes = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${apiKey}` },
})

if (!listRes.ok) {
  console.error("[v0] Failed to list domains:", listRes.status, await listRes.text())
  process.exit(1)
}

const { data: domains } = await listRes.json()
console.log(
  "[v0] Found domains:",
  domains.map((d) => d.name),
)

for (const domain of domains) {
  const updateRes = await fetch(`https://api.resend.com/domains/${domain.id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      click_tracking: false,
      open_tracking: false,
    }),
  })

  if (!updateRes.ok) {
    console.error(`[v0] Failed to update domain ${domain.name}:`, updateRes.status, await updateRes.text())
    continue
  }

  const updated = await updateRes.json()
  console.log(`[v0] Updated domain ${domain.name}:`, updated)
}
