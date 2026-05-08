export async function sendEmail(from, to, subject, message, apiKey) {
  const url = `https://api.eu.mailgun.net/v3/mg.framecore.se/messages`;

  try {
    return await $fetch(url, {
      method: "POST",
      body: new URLSearchParams({
        from: from,
        to: to,
        subject: subject,
        text: message,
      }),
      headers: {
        Accept: "*/*",
        Authorization: "Basic " + btoa("api" + ":" + apiKey),
      },

      retry: 3,
      retryDelay: 1000,
      retryStatusCodes: [408, 429, 500, 502, 503, 504],
    });
  } catch (error) {
    throw new Error(`Network error: ${error.message}`);
  }
}
