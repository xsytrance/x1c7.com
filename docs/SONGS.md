# Songs — stem-mixer rollout tracker

The list that used to live in a session scratchpad, now somewhere reboots can't
eat it. One line per track: checked = separated stems live in the mixer
(Supabase `tracks.planet->assets->stemAudio` + audio in R2 `planets/<slug>/stems/`).

Status as of **2026-07-09 (night)** — **THE FULL ROLLOUT SHIPPED** (see docs/2026-07-09-CATALOG-ROLLOUT.md): 54/54 public tracks have Sonic Dossiers, full shows, planet analyses, and ⚡ DYNAMIC+ choreographies; **50/54 live stem mixers**. Remaining mixers wait on Suno stem zips: Rum Pon Gold, Still Got 5 On It, Music Is My Drug (Rooklyn Mix) (+ hidden tracks). New mixers today: Different This Summer, Feverbreak, International Heat, My Soul Lives In Seoul, Paper That Cut You, Who's That Snake.

Verify / regenerate against the live DB:

```sql
SELECT id, title, (planet->'assets' ? 'stemAudio') AS stems_live,
       coalesce(k.n, 0) AS stem_count
FROM tracks
LEFT JOIN LATERAL (SELECT count(*) AS n
  FROM jsonb_object_keys(coalesce(planet->'assets'->'stemAudio','{}'::jsonb))) k ON true
ORDER BY title;
```

## Live in the mixer (43)

- [x] 1st of the Month (Walk It Out) — 8 stems
- [x] Different This Summer — 8 (2026-07-09: first SONIC DOSSIER track; 123 BPM verified onto the cover)
- [x] Days Drift By — 9 (full onboard 2026-07-09: planet, art, official lyrics)
- [x] Say It With Your Body — 9 (full onboard 2026-07-09: planet, art, official lyrics)
- [x] The Big Top Has Wi-Fi Now — 11 (brass + strings)
- [x] 23 Respuestas — 9
- [x] AI Interlude — 12
- [x] Amor De Verdad — 8
- [x] Between The Stations — 9
- [x] Brooms in the Boiler Room — 9
- [x] Cairo Still Dancing — 7
- [x] Ceasefire in the Static (Data Storm Version) — 10
- [x] Cocktails && Code — 8
- [x] Drink Drink [Don't Save Me] — 7
- [x] Fast Enough — 9
- [x] Going Crazy (Hiligaynon Fusion Mix) — 8
- [x] Heaven & Hell (Honey & Venom Remix) — 7
- [x] Honey N Venom (Rude Wine Riddim) — 7
- [x] I Don't Quit Right Now — 7
- [x] I Said No! — 7
- [x] I Won't Be Your Fire — 9
- [x] I Won't Be Your Fire (Japanese Mix) — 9
- [x] I'm That Somebody — 8
- [x] In Love With The Party — 6
- [x] Jayodeed - Going Crazy (Rooklyn Mix) — 7
- [x] Light It Myself (불은 내가) — 12
- [x] Low Lights Tokyo: 君がいないNight — 8
- [x] Membrane Still Insane — 7
- [x] Mi Gente — 7
- [x] Move Over (Minimal Groove Mix) — 7
- [x] Music Is My Drug — 8
- [x] One More Breath [Back To Myself] — 8
- [x] One Tap Away — 9
- [x] One Tap Away (Riverboat Bad Boys Remix) — 7
- [x] Oro De La Presión — 9
- [x] Push It On Me — 5
- [x] Red Flags From The Beginning — 9
- [x] Say It With Your Eyes — 8
- [x] Still Me: Still You — 9
- [x] Under The Elevated — 9
- [x] Veneno Y Miel — 7
- [x] Void Into Gold — 8
- [x] Void Into Gold (Forged Above Gold Mix) — 9
- [x] Whistle on the River — 7

## On the site, waiting on a Suno stems zip (9 + Summer Drip onboarding)

Drop the zip in `assets/suno/stems/` and run the pipeline
(docs/STEM-MIXER.md § Shipping a song's stems).

- [ ] Another Year Looks Good on You [Happy Birthday Song]
- [ ] Coffee (Josh Woodward cover — hidden)
- [ ] Feverbreak
- [ ] Let It In (hidden)
- [ ] Music Is My Drug (Rooklyn Mix)
- [ ] My Soul Lives In Seoul
- [ ] Paper That Cut You
- [ ] Who's That Snake (Funky Slow-Jam Mix)
- [ ] Summer Drip — LIVE on the site 2026-07-09 (full planet, official lyrics, 858 synced words); stems zip pending for the mixer
- [ ] International Heat — LIVE 2026-07-09 (assets pulled via Suno API); stems zip pending
- [ ] Rum Pon Gold — LIVE 2026-07-09 (assets pulled via Suno API); stems zip pending
- [ ] Still Got 5 On It — LIVE 2026-07-09 (Rooklyn B&W+gold art rule applied); stems zip pending
