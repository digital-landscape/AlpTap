# Supplied SIOUSA / SOIUSA geographic framework

Inspected before implementation on 2026-09-29. The directory is named `SIOUSA`; the classification described by its files is SOIUSA. Original files are preserved unchanged.

## Inventory and interpretation

- `SIOUSA/SOIUSA 36 SECTIONS.kml`: XML KML, WGS84 longitude/latitude coordinates, UTF-8. One folder named Area Features, 39 placemarks, no ExtendedData or explicit hierarchy.
- `SIOUSA/parte_pt_shp/Area Features.{shp,shx,dbf,prj}`: 39 polygon features, WGS84 geographic CRS (EPSG:4326 equivalent). DBF fields: id, Name, descriptio, timestamp, begin, end, altitudeMo, tessellate, extrude, visibility, drawOrder, icon. IDs are empty; description strings are truncated at 254 bytes and have legacy character encoding. These fields are KML export artefacts, not hierarchy levels.
- KML description includes Number, Code, Name, Perimeter, Enclosed_Area, Island_Area, creator and source URL. Stable section codes are SZ.1 through SZ.36. Names include several languages, but do not carry explicit language tags. Preserve the complete recorded string; only reviewed mappings receive language tags.
- SZ.36 has three separate placemarks. They form one multipart section, not duplicate sections. SZ.11 and SZ.14 already have multiple polygons. Retain holes and islands.
- One polygon has no code or number: Klagenfurt Becken. Preserve as auxiliary `aux:klagenfurt-basin`; do not invent a section assignment.
- No supplied Western/Eastern parent records, sectors, subsections, supergroups, groups, or subgroups exist. The complete usable supplied hierarchy is sections.

## Derived parents

The referenced author page, https://www.homoalpinus.com/alpes/subdivisions/soiusa/, places sections 1–14 in Western Alps and 15–36 in Eastern Alps. The app adds explicit `alps`, `western-alps`, and `eastern-alps` parent nodes with provenance `derived-parent-mapping`. Their geometries are unions of supplied sections, never hand-drawn boundaries. Section identifiers remain separate from display text. Finer levels can later be added when authoritative inputs exist.

Point assignment uses polygon covers (including boundary points). Multiple matching sections are retained and reported; no arbitrary first-match choice. The uncoded basin is retained in preprocessing and reported separately. Spatial repair, invalid features, out-of-domain peaks, and suspicious source records are reported.

The supplied files contain author/source attribution but no explicit redistribution license. The prototype loads only the current summit’s section geometry, on demand, for area scoring and post-guess outlines. Confirm boundary redistribution rights before public release; this is not a claim that the source is public domain.

## Static multilingual display names

`data/config/area-names.json` is the checked-in naming catalogue for every supplied unit and the three derived parents. Section codes are matched to the [SOIUSA multilingual nomenclature table](https://www.homoalpinus.com/alpes/subdivisions/soiusa/tab_de/index.html), checked on 2026-09-29. Localized labels normalize capitalization, spelling and accents; broad-sense sections retain their wider scope or use the table’s explicit compound equivalent. KML original names, including recorded spelling errors, remain unchanged. The uncoded Klagenfurt Basin translations are separately marked editorial.

Display is original name followed by the selected language in parentheses, unless identical apart from case. One shared static file feeds the name resolver and the geography importer; cached older manifests also receive the names through the bundled resolver. No live translation service is involved. A source-name change fails the importer’s review check rather than silently mismatching a translation.
