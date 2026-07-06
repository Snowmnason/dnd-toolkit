# Desktop App Note

Short operational note for the Electron desktop build.

## Build Flow

Desktop builds depend on the web export first.

1. Run `npm run predeploy:desktop`.
2. Build the Electron wrapper from `desktop/`.
3. Package the desktop app with the prepared web output.

The important part is the order. The exported web files are hardened and rewritten for the desktop wrapper before packaging.

## What Makes Desktop Different

- The desktop app serves the bundled web build through the custom `app://` protocol.
- CSP rules for Electron need `app:` as the protocol source inside the policy.
- Desktop path rewriting is required so bundled assets load correctly.
- Desktop packaging depends on the desktop-specific predeploy script, not the normal web export alone.

## Important Constraints

- Do not skip the desktop path-fixing step.
- Do not treat desktop CSP like the plain web CSP without checking the custom protocol rules.
- Keep desktop troubleshooting focused on build order, CSP behavior, and rewritten asset paths.

## Debugging Reminder

If a desktop build opens to a blank or broken screen, check these first:

- the `predeploy:desktop` output finished successfully
- the Electron build used the prepared desktop web output
- CSP changes still match the current `app://` loading model
- asset paths were rewritten for desktop