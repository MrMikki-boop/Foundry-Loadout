const url = "https://foundryvtt.com/article/branding/";
const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
const html = await response.text();
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
console.log(JSON.stringify({
  url,
  status: response.status,
  bytes: Buffer.byteLength(html),
  mentionsAvoidShortFoundry: /avoid shortening the name to Foundry/i.test(text),
  mentionsFoundryVttAlternative: /Foundry VTT/i.test(text),
  forbidsFullOfficialNameInTitle: /Can I use .Foundry Virtual Tabletop. in the title[\s\S]{0,500}?No,/i.test(text),
  warnsAgainstEndorsement: /suggests Foundry endorses/i.test(text),
  warnsAgainstVerificationClaim: /suggest that we have verified or examined your content/i.test(text),
}));
