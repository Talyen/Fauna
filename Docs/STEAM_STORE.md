# Steam Store preparation

[Release readiness](RELEASE.md) owns artifact verification and native qualification. This document records current Store preparation; it is not evidence of submitted or approved Steamworks settings.

[Steam setup](RELEASE.md#steam-setup) owns partner status, App/depot configuration, Cloud and controller setup. This guide owns the content survey, Store claims and media.

## AI content disclosure draft

Owner confirmation on October 23, 2026: all player-facing content was created by the project owner using AI. The [provenance declaration](../assets/content-provenance.json) and [asset manifest](../assets/manifest.json) retain the scope and individual source locations.

Suggested wording for the pre-generated AI section of the Steam Content Survey:

> Fauna's artwork, music, sound effects and written game content were created by the developer using AI tools during development. The game ships prepared content and does not generate content with AI during gameplay.

Review the final survey wording against the actual release candidate. Valve requires disclosure of shipped AI-generated player-facing content; ordinary development-assistance tooling is not the focus. Answer live generation as absent while the shipped application remains entirely offline and has no generation service. See Valve's [Content Survey](https://partner.steamgames.com/doc/gettingstarted/contentsurvey).

All games need adequate rights to distributed content. Valve does not describe a routine requirement to submit a license dossier with every game. Retain applicable service terms and any required attribution with original source materials; request service names or terms only if a concrete license restriction or attribution question remains. Existing project provenance and technical asset checks do not grant rights or establish legal clearance.

## Accurate Store claims and media

Advertise only current, qualified functionality. Current packaging targets Windows x64; native Linux/macOS builds and Steam achievements are not implemented. Proton/Deck compatibility requires separate device testing. Cloud and controller claims need completed external configuration and live acceptance. A browser test or successful package check does not establish those claims.

Use real gameplay screenshots. Base Store capsules contain game artwork, the title and any official subtitle; omit review scores, awards, discounts, other products and promotional calls to action. Library hero artwork has no text; library capsule includes the game logo; library logo uses transparency. Keep external URLs out of the written description and use the supported link fields. Check current dimensions and requirements at upload time.

Valve references: [build and Store review](https://partner.steamgames.com/doc/store/review_process), [graphical asset rules](https://partner.steamgames.com/doc/store/assets/rules), [written descriptions](https://partner.steamgames.com/doc/store/page/description), [controller guidance](https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_devs), [Steam Cloud](https://partner.steamgames.com/doc/features/cloud) and [Deck compatibility](https://partner.steamgames.com/doc/steamhardware/compat).
