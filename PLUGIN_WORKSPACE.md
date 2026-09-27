# Connected storefront plugin

In **Studio → Versions and rules → Connected plugin**, choose an existing plugin
folder (extract ZIP files first), a name and WooCommerce, Shopify, Magento or
Custom. The folder is copied into the project's saved source workspace, including
binary assets. It is not replaced with the generic generated widget. Git,
node_modules and environment files are excluded. Limits: 500 files / 8 MB,
ASCII archive-safe paths, 12 source revisions and 20 release records.

The conversation agent sees the attachment in workspace context. Its
`plugin_files`, `plugin_search`, `plugin_read`, `plugin_patch`, `plugin_validate` tools read and
patch the attached source: search finds lines (with line numbers), read returns numbered lines, and patch edits a
line range (or one unique literal substring). Hash and revision checks reject stale edits. These
tools never execute uploaded code. Changes occur on the agent's working copy and
are persisted only when the turn completes successfully. Plugin-only changes
do not publish a new search module or pretend a search test validates checkout.

Files can also be viewed and edited in the connected-plugin panel. Each change
creates a new draft. Rollback restores an available source snapshot as a new
revision. Original files, including binary images, remain byte-preserved unless
explicitly edited or replaced during import. Importing a folder again replaces
the current snapshot; earlier snapshots remain in the bounded history.

**Package and download update** validates platform markers, JSON and classic
JavaScript syntax, then downloads the current files as ZIP and records their
hash, plugin revision and current search revision. PHP, module JavaScript,
Liquid, XML and actual commerce behavior need the platform's staging checks.
The archive itself contains only the source files; release metadata stays in
Studio. Validation is not a platform certification or malware scan.

New adapters from the existing generator can also be saved using **Create and
connect to project**. A connected existing plugin cannot accidentally be
overwritten by this button; use explicit import/update instead.

## Deployment boundary

This connects source maintenance and release packaging to Studio. It does not
push code automatically to a merchant's running store. WooCommerce installs the
plugin folder ZIP; Shopify deploys an app/theme extension through its app
project; Magento deploys through its normal module release process; Custom uses
the site's existing deployment. Credentials and a platform deployment connector
would be required for remotely managed installations. Source changes do not
modify existing store settings, databases, or the local source directory.

## API (Studio session required)

- GET `/api/projects/:id/plugin`: metadata, files, history, validation.
- GET `/api/projects/:id/plugin/file?path=...`: file content and hash.
- POST `.../plugin/import`: `{name,platform,files:[{path,encoding,content}],expectedRevision?}`.
- POST `.../plugin/edit`: `{expectedRevision,edits:[{path,expectedHash,content}],note}`.
  New files require `expectedHash:null`; deletion uses `remove:true`.
- POST `.../plugin/rollback`: `{expectedRevision,revision}`.
- POST `.../plugin/release`: `{expectedRevision,note?}` returns ZIP.
- POST `.../plugin/generate`: generator options; attaches the resulting source.

Tests: `node --test plugin-workspace.test.mjs plugin-workspace-api.test.mjs`.
