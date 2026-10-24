# Documents

Index of the maintained notes in this folder. Every example is synthetic. Real
statements stay in `statements/`, which Git ignores.

| File | Contents |
|---|---|
| `docs/API.md` | Environment variables, authentication, import endpoints, duplicate and anomaly scoring, local development |
| `docs/DATA-MODEL.md` | Tables and fields for the Tier 1 and Tier 2 features |
| `docs/FEATURES.md` | Prioritized feature list with the rationale for each tier |
| `docs/KEYCLOAK-CLIENT.md` | Whether the KeycloakOIDCClient CRD can create the app client, and what must be enabled first |
| `docs/PARSING-NOTES.md` | Format gotchas per bank, with synthetic examples that keep the real layout |
| `docs/PARSING-PARITY.md` | Commands and results of the Alinma Go parser against the Python reference |
| `docs/README.md` | This index |

Wiki pages are generated from the Markdown files in this folder after every
merge to main. Edit the file here, never the wiki page.

The workflow skips with a warning while the repository stays private, because a
private repository on the free plan has no wiki. Enable the wiki and create one
page, then rerun the workflow.
