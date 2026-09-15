// Delivery adapter only. This is NOT a member-verification implementation.
export function smsSender(env, send = fetch) {
  if (!env.SMS_WEBHOOK_URL) return undefined;
  let url;
  try {
    url = new URL(env.SMS_WEBHOOK_URL);
  } catch {
    throw new Error("Invalid SMS_WEBHOOK_URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    !env.SMS_WEBHOOK_TOKEN ||
    !/^\+91[6-9]\d{9}$/.test(env.ADMIN_PHONE || "")
  ) {
    throw new Error(
      "SMS recovery requires an HTTPS webhook, bearer token and valid ADMIN_PHONE",
    );
  }
  return async (phone, code) => {
    const response = await send(url.href, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + env.SMS_WEBHOOK_TOKEN,
      },
      body: JSON.stringify({
        phone,
        message: `MVPMl password reset code: ${code}. Expires in 10 minutes.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("SMS delivery failed");
  };
}
