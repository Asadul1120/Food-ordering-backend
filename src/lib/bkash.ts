import { config } from "../config/index.ts";

interface IBkashResponse {
  statusCode?: string;
  statusMessage?: string;
  errorCode?: string;
  errorMessage?: string;
  message?: string;
  id_token?: string;
  expires_in?: number | string;
  paymentID?: string;
  paymentId?: string;
  bkashURL?: string;
}

interface ICreateBkashPayment {
  amount: string;
  payerReference: string;
  merchantInvoiceNumber: string;
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

const getConfigValue = (value: string | undefined, key: string): string => {
  if (!value?.trim()) {
    throw new Error(`${key} is missing in config`);
  }

  return value.trim();
};

const getBaseUrl = () => {
  return getConfigValue(config.bkash_base_url, "BKASH_BASE_URL").replace(
    /\/+$/,
    "",
  );
};

const getBkashResponse = async (
  response: Response,
  action: string,
): Promise<IBkashResponse> => {
  const responseText = await response.text();

  let result: IBkashResponse;

  try {
    result = JSON.parse(responseText) as IBkashResponse;
  } catch {
    throw new Error(
      `${action}: HTTP ${response.status}. Invalid JSON response`,
    );
  }

  const errorMessage =
    result.statusMessage || result.errorMessage || result.message;

  if (
    !response.ok ||
    (result.statusCode !== undefined && result.statusCode !== "0000") ||
    result.errorCode
  ) {
    throw new Error(
      `${action}: HTTP ${response.status}, Code: ${result.errorCode || result.statusCode || "N/A"}, Message: ${errorMessage || "Unknown bKash error"}`,
    );
  }

  return result;
};

const getBkashToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const response = await fetch(
    `${getBaseUrl()}/tokenized/checkout/token/grant`,
    {
      method: "POST",
      headers: {
        username: getConfigValue(config.bkash_username, "BKASH_USERNAME"),
        password: getConfigValue(config.bkash_password, "BKASH_PASSWORD"),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        app_key: getConfigValue(config.bkash_app_key, "BKASH_APP_KEY"),
        app_secret: getConfigValue(config.bkash_app_secret, "BKASH_APP_SECRET"),
      }),
      signal: AbortSignal.timeout(30000),
    },
  );

  const result = await getBkashResponse(response, "bKash Grant Token");

  if (!result.id_token) {
    throw new Error("bKash access token was not returned");
  }

  cachedToken = result.id_token;

  const expiresIn = Number(result.expires_in) || 3600;

  tokenExpiresAt = Date.now() + expiresIn * 1000;

  return cachedToken;
};

export const createBkashPayment = async (payload: ICreateBkashPayment) => {
  const token = await getBkashToken();

  const response = await fetch(`${getBaseUrl()}/tokenized/checkout/create`, {
    method: "POST",
    headers: {
      Authorization: token,
      "x-app-key": getConfigValue(config.bkash_app_key, "BKASH_APP_KEY"),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      mode: "0011",
      payerReference: payload.payerReference,
      callbackURL: getConfigValue(
        config.bkash_callback_url,
        "BKASH_CALLBACK_URL",
      ),
      amount: payload.amount,
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: payload.merchantInvoiceNumber,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const result = await getBkashResponse(response, "bKash Create Payment");

  const paymentId = result.paymentID || result.paymentId;

  if (!paymentId || !result.bkashURL) {
    throw new Error("bKash payment URL or payment ID was not returned");
  }

  return {
    paymentId,
    bkashURL: result.bkashURL,
  };
};
