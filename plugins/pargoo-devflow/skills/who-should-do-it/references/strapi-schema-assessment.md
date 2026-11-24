# Strapi Schema Assessment

Use this guide during read-only evidence gathering. Apply the findings through the main skill's complexity, risk, controllability, decision, and missing-evidence rules.

## Establish project context

- Confirm the installed Strapi version from the manifest and lockfile or deployment evidence. Inspect the database engine, environment overrides, and deployment order without reading secrets. Check when schema sync and migrations run. Consult official documentation for the installed version when project evidence leaves a material behavior uncertain.
- Compare current and planned definitions. Trace shared and nested components to all Content Types and Dynamic Zones that use them. Check how the change affects editors, APIs, frontends, and integrations that read, write, or render the content. Include affected locales and draft or published variants where relevant.

## Assess schema changes

The levels below illustrate possible consequences. Classify the actual change using project evidence and the main skill's criteria.

| Schema change | Potential risk | Assessment guidance |
| --- | --- | --- |
| Add a Content Type or Component | Normal when isolated. Elevated if introducing it materially changes existing contracts. | Check generated APIs and where the new model is wired into existing types, components, or consumers. |
| Delete a Content Type or Component | Elevated if consumers or references break. Critical if important production content would be lost irreversibly. | Find stored records or component instances and inbound references. Check what deployment removes and how affected content will be preserved or retired. |
| Switch between collection and single type | Elevated if entry counts or API contracts change. | Check how many entries exist, which can be retained, and how consumers access them. |
| Change a schema identifier (`collectionName`, singular or plural API ID, model or component UID) | Elevated if storage, routes, or references change. Critical if the change would irreversibly lose important production data. | Compare effective identifiers and their references. Distinguish a display label edit or file move from a change to storage or public identifiers. |
| Add a field or change its default | Normal if existing records and consumers stay compatible. Elevated if old writers break or new writes change meaning. | Check omitted fields in current writes, what existing entries return, and whether the default applies to new writes, stored records, or both. |
| Rename or move a field | Elevated if reads, writes, or stored values are affected. Critical if important production values would be lost irreversibly. | Check whether the installed version and deployment treat the change as removal plus addition. Trace the source and destination, including moves across types or components. |
| Remove a field | Elevated if consumers rely on it. Critical if important production values would be lost irreversibly. | Check which records contain values, which consumers use them, and whether removal is intended or data must be retained. |
| Change a field type | Elevated if values or API payloads need conversion. Critical if conversion would cause severe irreversible loss or corruption. | Check whether existing values can be converted without truncation or loss and whether consumers accept the new shape. |
| Add or tighten a required or unique constraint | Elevated if existing records, writes, or deployment can fail. | Check nulls, missing values, and duplicates in the relevant scope. Distinguish application validation from database enforcement and identify any backfill or deduplication needed. |
| Change validation rules (enum, format, range, or length) | Elevated if existing values or writes become invalid, or newly accepted values break consumers. | Check stored values, current writers, and consumer assumptions against the new rules. |
| Add, remove, or retarget a relation, or change its inverse | Normal for a compatible addition. Elevated if links, writes, or payloads break. | Inspect both ends, ownership and inverse fields, existing links, and how consumers read or update them. |
| Change relation cardinality or Component repeatability | Elevated if stored links or instances no longer fit, or a payload changes between a list and a single value. | Check counts and ordering. If several values must become one, verify how the surviving value is chosen and what happens to the rest. |
| Add or remove a Dynamic Zone or change its allowed Components or limits | Normal if existing content and consumers remain compatible. Elevated if stored blocks no longer fit or consumers cannot handle new shapes. | Check which blocks are in use, their order, and whether editors and consumers can save or render the resulting content. |

## Inspect safeguards and remaining uncertainty

- Determine whether a migration, backfill, or compatibility step is needed and where it fits in deployment. Inspect what any proposed migration actually preserves or transforms. A matching migration name is insufficient evidence of data preservation.
- Look for representative data, consumer checks, and recovery evidence where needed. Identify decisions or operations requiring a developer or data owner, such as resolving ambiguous mappings, approving intentional data removal, or handling protected access. If project evidence or documentation cannot resolve a material question, name the gap and apply the main skill's existing rules.
