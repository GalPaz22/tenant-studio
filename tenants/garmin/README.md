# Garmin tenant processor

`index.mjs` processes the complete connected public WooCommerce catalog and derives internal search attributes. It does not turn those attributes into display badges.

Rules separate product families from replacement bands, chargers and other accessories. Diacritics and trademark symbols are normalized for English/Hebrew retrieval. Explicit model names provide series, AMOLED, MicroLED, Solar, sapphire and Music-edition evidence. Product specifications may confirm on-watch music storage. A generic mention of music or phone music controls does not establish storage.

Square-screen recognition is restricted to the Venu Sq model family. Unrecognized screen shapes remain unknown. The September 16 public catalog import contains no product with that model name, so square-screen results cannot be claimed as verified matches.

`garmin-research.mjs` imports the public catalog to exhaustion, enriches descriptions/specification tables, retains previously collected site badges, and generates the tenant profile plus a coverage report. A failed import never replaces the current catalog. The Studio research button repeats this process. The artifact ZIP includes this processor and the report.

HTML badge scanning uses one request at a time with spacing and stops on HTTP 429, preserving earlier observations. The previous scan was incomplete; this processor does not claim badge coverage for every product. LLM candidate selection remains bounded, and fallback cards are alternatives rather than evidence of a requested feature.
