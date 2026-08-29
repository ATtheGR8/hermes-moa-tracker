# Security

MoA Tracker stores only sanitized advisor metrics (no reference bodies or prompts).

- Do not paste tokens, private keys, or session contents into issues or PRs.
- Review the plugin before enabling it, as you would any third-party Hermes plugin.
- Plugin HTTP routes (`/current`, `/history`) do not listen on their own. They mount on the Hermes dashboard as `/api/plugins/moa-tracker/` and inherit that dashboard's session-token auth. This plugin does not add a second auth layer.

See LICENSE (MIT).
