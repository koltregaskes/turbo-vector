# Turbo Vector

`Turbo Vector` is now a Phaser + TypeScript + Vite career-season build for a top-down arcade racer in the spirit of *Super Cars*.

The production direction lives in [DESIGN-BIBLE.md](./DESIGN-BIBLE.md).

The current web build is built around:

- a title/menu shell
- a seven-round season across `Southport Marina`, `Breaker Point`, and `Vector Mile`
- recurring named rivals
- a stronger first-career crew briefing and rival dossier layer
- damage, prize money, repairs, upgrades, sponsor contracts, and crew trims
- a garage loop, standings table, and season summary
- quick `Single Race` and `Time Trial` modes
- first-pass synthetic audio and responsive HUD work

## Local run

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Review URL

Stable review entry:

- public: `https://koltregaskes.github.io/turbo-vector/?autostart=1&review=1`
- preferred local preview: `http://127.0.0.1:4177/?autostart=1&review=1`

Additional deterministic review surfaces:

- briefing: `http://127.0.0.1:4177/?review=1&surface=briefing`
- garage: `http://127.0.0.1:4177/?review=1&surface=garage`
- results: `http://127.0.0.1:4177/?review=1&surface=results`
- standings: `http://127.0.0.1:4177/?review=1&surface=standings`
- later-season pressure garage: `http://127.0.0.1:4177/?review=1&surface=season-pressure`
- later-season aftermath results: `http://127.0.0.1:4177/?review=1&surface=season-aftermath`
- later-season recovery garage: `http://127.0.0.1:4177/?review=1&surface=season-recovery`
- season-complete cup summary: `http://127.0.0.1:4177/?review=1&surface=season-summary`

`review=1` boots a fresh non-persistent season state. `autostart=1` or `surface=race` drops straight into the first career event, while `surface=briefing|garage|results|standings|season-pressure|season-aftermath|season-recovery|season-summary` opens deterministic review checkpoints without menu setup or save-file interference. `surface=season-pressure` is the later-season management beat route, seeded to show money, upgrades, rivalry pressure, and the next-event decision in one garage state. `surface=season-aftermath` lands on the authored late-season result so the review flow can inspect the fallout: rival outcome, standings swing, garage cash, and the next race context. `surface=season-recovery` carries that same authored fallout into the following garage so the review flow can inspect the next management decision with the consequence still visible. `surface=season-summary` goes one step further and opens the season-complete cup summary with the final pressure ledger already present. The same query contract works on any free local preview port if `4177` is already occupied on the machine.

Use the browser build to evaluate handling readability, UI clarity, rival identity, the garage loop, and whether the season structure makes you want another full run.
