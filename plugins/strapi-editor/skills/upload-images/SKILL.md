---
name: upload-images
description: Upload original local JPEG, PNG or WebP images to the confirmed Strapi environment and use the returned asset IDs.
---

Use this chat's contextId; open `strapi_editor_open` if none exists. Obtain a readable original local file, or use `strapi_choose_image` to open the macOS picker. A visible attachment alone may not expose its bytes: do not invent a path or recreate it. If the picker is cancelled, stop the upload.

Read `strapi_editor_context` before uploading. If no environment is confirmed or it differs from the requested target, let the user select it in the panel. Apply that profile's file-size limit and the CMS limits. Credentials stay in the plugin; use `strapi_upload_image` rather than a shell uploader.

Omit folderId for the Media Library root unless a particular folder was requested. Resolve a named folder using the selected project's advertised tools; discover them if needed. Create a folder only when requested and supported. Never reuse another CMS's folder or asset IDs.

Call `strapi_upload_image` with contextId, a new UUID requestId, the absolute file path and optional folderId, name, alt and caption. Retain requestId for the same intended upload. Requested uploads need no extra panel confirmation in either Development or Production.

After a successful upload, use `result.asset.id` according to the content schema. A later content edit is a separate operation and needs the project's content instructions. If receipt or operation recording failed after upload, keep the returned asset rather than uploading another copy. If the result is unknown, inspect the same CMS before retrying that image; do not bypass its record with a new requestId. Uploading an image does not authorise publication.
