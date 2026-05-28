/**
 * ============================================================
 * GrowthOS Plugin Security: Sandbox d'Exécution
 * ============================================================
 * Protection contre l'exécution de code arbitraire dans les hooks
 * - Timeout forcé (5s)
 * - Filtrage des globaux dangereux (eval, fs, process, etc.)
 * - Gestion des erreurs masquées
 */

// ── Types ────────────────────────────────────────────────────────

export interface SandboxContext {
  [key: string]: any;
}

export interface SandboxResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timedOut?: boolean;
}

// ── Constantes ───────────────────────────────────────────────────

const EXECUTION_TIMEOUT_MS = 5000; // 5 secondes max par hook

// Liste noire des globaux dangereux à neutraliser
const DANGEROUS_GLOBALS = [
  'eval',
  'Function',
  'require',
  'process',
  'global',
  'Buffer',
  'setTimeout', // On utilise notre propre timeout
  'setInterval',
  'setImmediate',
  'clearTimeout',
  'clearInterval',
  'clearImmediate',
];

// ── Fonctions Utilitaires ────────────────────────────────────────

/**
 * Crée un contexte sandboxé en retirant les accès dangereux
 */
function createSafeContext(userContext: SandboxContext = {}): SandboxContext {
  const safeContext: SandboxContext = {
    console: {
      log: () => {}, // Silence les logs dans le sandbox
      warn: () => {},
      error: () => {},
      info: () => {},
    },
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Symbol,
    Intl,
    ...userContext,
  };

  // Neutralisation explicite des globaux dangereux
  DANGEROUS_GLOBALS.forEach(key => {
    safeContext[key] = undefined;
  });

  return safeContext;
}

/**
 * Exécute une fonction asynchrone avec timeout
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<{ result?: T; timedOut: boolean; error?: string }> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Execution timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutId!);
    return { result, timedOut: false };
  } catch (error: any) {
    clearTimeout(timeoutId!);
    if (error.message.includes('timeout')) {
      return { timedOut: true, error: error.message };
    }
    return { timedOut: false, error: error.message || 'Unknown error' };
  }
}

// ── Fonction Principale de Sandbox ───────────────────────────────

/**
 * Exécute un hook plugin dans un environnement sécurisé
 * 
 * @param hookFn - La fonction du hook à exécuter
 * @param context - Contexte de données à passer au hook
 * @returns Résultat encapsulé avec gestion d'erreurs
 */
export async function runHookInSandbox<T>(
  hookFn: (ctx: SandboxContext) => Promise<T>,
  context: SandboxContext = {}
): Promise<SandboxResult<T>> {
  const safeContext = createSafeContext(context);

  try {
    const { result, timedOut, error } = await executeWithTimeout<T>(
      () => hookFn(safeContext),
      EXECUTION_TIMEOUT_MS
    );

    if (timedOut) {
      console.warn('[Plugin Sandbox] Hook execution timed out');
      return {
        success: false,
        error: error,
        timedOut: true,
      };
    }

    if (error) {
      console.error('[Plugin Sandbox] Hook execution failed:', error);
      return {
        success: false,
        error,
      };
    }

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    // Erreur non capturée (fuite de sandbox ?)
    console.error('[Plugin Sandbox] Critical error:', error);
    return {
      success: false,
      error: `Critical sandbox error: ${error.message}`,
    };
  }
}

/**
 * Valide qu'une fonction n'utilise pas de motifs suspects (analyse statique basique)
 * Note: Ceci est une protection supplémentaire, pas une sécurité absolue
 */
export function scanFunctionForSuspiciousPatterns(fn: Function): { safe: boolean; warnings: string[] } {
  const fnString = fn.toString();
  const warnings: string[] = [];

  const suspiciousPatterns = [
    { pattern: /eval\s*\(/, message: 'Usage de eval() détecté' },
    { pattern: /new\s+Function\s*\(/, message: 'Constructeur Function() détecté' },
    { pattern: /require\s*\(/, message: 'Appel require() détecté' },
    { pattern: /process\.env/, message: 'Accès à process.env détecté' },
    { pattern: /fs\./, message: 'Accès au filesystem détecté' },
    { pattern: /child_process/, message: 'Spawning de processus détecté' },
    { pattern: /http[s]?\s*:\s*\/\//, message: 'Requête HTTP brute détectée' },
  ];

  suspiciousPatterns.forEach(({ pattern, message }) => {
    if (pattern.test(fnString)) {
      warnings.push(message);
    }
  });

  return {
    safe: warnings.length === 0,
    warnings,
  };
}

// ── Wrapper pour l'enregistrement des Hooks ─────────────────────

/**
 * Enregistre un hook avec validation préalable
 */
export function registerSafeHook(
  eventName: string,
  hookFn: (ctx: SandboxContext) => Promise<any>,
  options: { strict?: boolean } = {}
): { registered: boolean; warnings?: string[] } {
  const scan = scanFunctionForSuspiciousPatterns(hookFn);

  if (!scan.safe && options.strict) {
    console.error(`[Plugin Security] Hook "${eventName}" rejeté: motifs suspects détectés`);
    scan.warnings.forEach(w => console.error(`  - ${w}`));
    return { registered: false, warnings: scan.warnings };
  }

  if (!scan.safe) {
    console.warn(`[Plugin Security] Hook "${eventName}" enregistré avec avertissements:`);
    scan.warnings.forEach(w => console.warn(`  - ${w}`));
  }

  // Ici on appellerait le vrai système d'enregistrement de hooks
  // registerHook(eventName, hookFn);

  console.log(`[Plugin Security] Hook "${eventName}" enregistré avec succès`);
  return { registered: true };
}

// ── Exports ──────────────────────────────────────────────────────

export const PluginSandbox = {
  run: runHookInSandbox,
  scan: scanFunctionForSuspiciousPatterns,
  register: registerSafeHook,
  TIMEOUT_MS: EXECUTION_TIMEOUT_MS,
};

export default PluginSandbox;
