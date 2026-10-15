declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AMap?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AMapLoader?: any;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let amapLoadPromise: Promise<any> | null = null;

/**
 * Loads the official AMap JS API 2.0 (`https://webapi.amap.com/loader.js`)
 * with optional `_AMapSecurityConfig.securityJsCode`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadAMapSdk(options: {
  key: string;
  securityJsCode?: string;
  version?: string;
  plugins?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not available'));
  }
  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }
  if (amapLoadPromise) {
    return amapLoadPromise;
  }

  if (options.securityJsCode) {
    window._AMapSecurityConfig = {
      securityJsCode: options.securityJsCode,
    };
  }

  amapLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('amap-jsapi-loader-script');
    const onLoaderReady = () => {
      if (!window.AMapLoader) {
        amapLoadPromise = null;
        reject(new Error('AMapLoader failed to initialize'));
        return;
      }
      window.AMapLoader.load({
        key: options.key,
        version: options.version ?? '2.0',
        plugins: options.plugins ?? ['AMap.Scale'],
      })
        .then(resolve)
        .catch((err: unknown) => {
          amapLoadPromise = null;
          reject(err);
        });
    };

    if (existingScript) {
      onLoaderReady();
      return;
    }

    const script = document.createElement('script');
    script.id = 'amap-jsapi-loader-script';
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://webapi.amap.com/loader.js';
    script.onload = onLoaderReady;
    script.onerror = () => {
      amapLoadPromise = null;
      reject(new Error('Failed to load https://webapi.amap.com/loader.js'));
    };
    document.head.appendChild(script);
  });

  return amapLoadPromise;
}
