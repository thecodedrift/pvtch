export const paramToInt = (param: string | undefined, defaultValue: number) => {
  if (!param) {
    return defaultValue;
  }
  const parsed = Number.parseInt(param, 10);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }
  return parsed;
};

export const paramToFloat = (
  param: string | undefined,
  defaultValue: number,
) => {
  if (!param) {
    return defaultValue;
  }
  const parsed = Number.parseFloat(param);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }
  return parsed;
};

export const paramToBool = (
  param: string | undefined,
  defaultValue: boolean,
) => {
  if (!param) {
    return defaultValue;
  }
  if (param.toLowerCase() === 'true') {
    return true;
  }
  if (param.toLowerCase() === 'false') {
    return false;
  }
  return defaultValue;
};

/** Converts a string to a url/kv friendly key */
export const paramToKey = (param: string | undefined, defaultValue: string) => {
  if (!param) {
    return defaultValue;
  }

  return `${param}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
};

type ConverterCallback = (value: string | undefined) => string | undefined;

export const objectToParams = (
  obj: Record<string, string | undefined>,
  handlers: Record<string, ConverterCallback>,
) => {
  const params = new URLSearchParams();
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      const intent = handlers[key] ? handlers[key](value) : value;
      if (intent) {
        params.set(key, value);
      }
    }
  });

  return params;
};

export const paramsToObject = <T extends Record<string, unknown>>(
  params: URLSearchParams,
  defaults: T,
  handlers: Record<string, ConverterCallback>,
): T => {
  const result: T = { ...defaults };
  Object.keys(defaults).forEach((key) => {
    const paramValue = params.get(key) ?? undefined;
    if (handlers[key]) {
      result[key as keyof T] = (handlers[key](paramValue) ??
        defaults[key]) as T[keyof T];
    } else {
      result[key as keyof T] = (paramValue ?? defaults[key]) as T[keyof T];
    }
  });
  return result;
};
