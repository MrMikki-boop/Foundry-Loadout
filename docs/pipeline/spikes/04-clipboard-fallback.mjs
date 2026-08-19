const manifestUrl = "https://example.invalid/module.json";

async function attemptCopy(clipboard) {
  if (!clipboard?.writeText) return { copied: false, fallback: "select-visible-url" };
  try {
    await clipboard.writeText(manifestUrl);
    return { copied: true, fallback: null };
  } catch (error) {
    return { copied: false, fallback: "select-visible-url", error: error.name };
  }
}

const scenarios = {
  success: { writeText: async (value) => value },
  missing: undefined,
  rejected: { writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); } },
};

for (const [scenario, clipboard] of Object.entries(scenarios)) {
  console.log(JSON.stringify({ scenario, ...await attemptCopy(clipboard), visibleUrl: manifestUrl }));
}
