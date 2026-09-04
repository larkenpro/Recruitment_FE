/**
 * Hides development-only affordances (Fill Test Data buttons, debug panels) from
 * production builds.
 *
 *   <DevOnly><Button onClick={fillTestData}>Fill Test Data</Button></DevOnly>
 *
 * `import.meta.env.DEV` is true under `npm run dev` and false in `npm run build`,
 * so wrapped controls never reach a deployed site. Note this stops them being
 * rendered — it does not strip the handler they call from the bundle, so don't
 * use it to hide anything secret.
 */
export default function DevOnly({ children }) {
  return import.meta.env.DEV ? children : null
}
